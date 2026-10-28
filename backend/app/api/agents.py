from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Agent, Task
from ..schemas import AgentIn, AgentProposalIn
from ..services import agent_service, permission_service
from .deps import user_id

router = APIRouter(prefix="/api/agents", tags=["agents"])


def serialize(a: Agent, db=None) -> dict:
    d = {c.name: getattr(a, c.name) for c in a.__table__.columns}
    if db is not None:
        d["permissions"] = permission_service.matrix(db, a.id)
    return d


@router.get("")
def list_agents(uid: int = Depends(user_id), db: Session = Depends(get_db)):
    agents = (db.query(Agent).filter_by(user_id=uid)
              .order_by(Agent.is_ceo.desc(), Agent.id).all())
    return [serialize(a) for a in agents]


@router.get("/{aid}")
def get_agent(aid: int, uid: int = Depends(user_id),
              db: Session = Depends(get_db)):
    a = db.get(Agent, aid)
    if not a or a.user_id != uid:
        raise HTTPException(404, "Agente no encontrado")
    out = serialize(a, db)
    running = db.query(Task).filter_by(agent_id=aid, status="running").count()
    out["running_tasks"] = running
    return out


@router.post("/propose")
def propose(payload: AgentProposalIn, uid: int = Depends(user_id),
            db: Session = Depends(get_db)):
    return agent_service.propose_agent_config(db, uid, payload.description,
                                              payload.answers)


@router.post("/create")
def create(proposal: dict, uid: int = Depends(user_id),
           db: Session = Depends(get_db)):
    a = agent_service.create_from_proposal(db, uid, proposal)
    return serialize(a, db)


@router.put("/{aid}")
def update(aid: int, payload: AgentIn, uid: int = Depends(user_id),
           db: Session = Depends(get_db)):
    a = db.get(Agent, aid)
    if not a or a.user_id != uid:
        raise HTTPException(404, "Agente no encontrado")
    fields = {k: v for k, v in payload.model_dump().items() if v is not None}
    running = db.query(Task).filter_by(agent_id=aid, status="running").count()
    agent_service.update_agent(db, a, fields)
    return {"agent": serialize(a, db),
            "warning": (f"{running} tarea(s) en ejecución pueden verse "
                        "afectadas por el cambio." if running else None)}


@router.post("/{aid}/pause")
def pause(aid: int, uid: int = Depends(user_id), db: Session = Depends(get_db)):
    a = db.get(Agent, aid)
    if not a or a.user_id != uid:
        raise HTTPException(404)
    a.status = "paused"; db.commit()
    return {"ok": True}


@router.post("/{aid}/resume")
def resume(aid: int, uid: int = Depends(user_id), db: Session = Depends(get_db)):
    a = db.get(Agent, aid)
    if not a or a.user_id != uid:
        raise HTTPException(404)
    a.status = "active" if a.provider_id else "pending_config"
    db.commit()
    return {"ok": True, "status": a.status}


@router.post("/{aid}/duplicate")
def duplicate(aid: int, uid: int = Depends(user_id),
              db: Session = Depends(get_db)):
    a = db.get(Agent, aid)
    if not a or a.user_id != uid:
        raise HTTPException(404)
    return serialize(agent_service.duplicate(db, a), db)


@router.get("/{aid}/export")
def export(aid: int, uid: int = Depends(user_id),
           db: Session = Depends(get_db)):
    a = db.get(Agent, aid)
    if not a or a.user_id != uid:
        raise HTTPException(404)
    return serialize(a, db)


@router.delete("/{aid}")
def delete(aid: int, confirm: bool = False, uid: int = Depends(user_id),
           db: Session = Depends(get_db)):
    a = db.get(Agent, aid)
    if not a or a.user_id != uid:
        raise HTTPException(404)
    if a.is_ceo:
        raise HTTPException(400, "El asistente CEO no se puede eliminar.")
    open_tasks = db.query(Task).filter(
        Task.agent_id == aid,
        Task.status.in_(["pending", "planned", "running",
                         "awaiting_authorization"])).count()
    if open_tasks and not confirm:
        return {"ok": False, "needs_confirm": True,
                "open_tasks": open_tasks,
                "message": f"El agente tiene {open_tasks} tareas abiertas. "
                           "Confirma para eliminarlo igualmente."}
    db.query(Task).filter(Task.agent_id == aid).update({"agent_id": None})
    from ..models import Permission
    db.query(Permission).filter_by(agent_id=aid).delete()
    db.delete(a)
    db.commit()
    return {"ok": True}


@router.post("/team-proposal")
def team_proposal(payload: dict, uid: int = Depends(user_id),
                  db: Session = Depends(get_db)):
    return agent_service.propose_team(db, uid, payload.get("project", ""))


@router.post("/team-create")
def team_create(payload: dict, uid: int = Depends(user_id),
                db: Session = Depends(get_db)):
    members = payload.get("members", [])
    created = [agent_service.create_from_proposal(db, uid, m) for m in members]
    from ..models import Team
    team = Team(name=payload.get("name", "Equipo"), description=payload.get("project", ""))
    db.add(team); db.flush()
    for a in created:
        a.team_id = team.id
    db.commit()
    return {"team_id": team.id, "agents": [serialize(a) for a in created]}
