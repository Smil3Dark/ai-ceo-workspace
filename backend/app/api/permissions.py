from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Agent, AuthorizationRequest
from ..schemas import PermissionIn, ResolveAuthIn
from ..services import permission_service
from ..services.activity import notify
from ..tools.registry import run_approved_payload
from .deps import user_id

router = APIRouter(prefix="/api", tags=["permissions"])


@router.get("/agents/{aid}/permissions")
def matrix(aid: int, db: Session = Depends(get_db)):
    if not db.get(Agent, aid):
        raise HTTPException(404)
    return permission_service.matrix(db, aid)


@router.post("/agents/{aid}/permissions")
def grant(aid: int, payload: PermissionIn, uid: int = Depends(user_id),
          db: Session = Depends(get_db)):
    a = db.get(Agent, aid)
    if not a or a.user_id != uid:
        raise HTTPException(404)
    p = permission_service.grant(db, aid, payload.scope, payload.effect,
                                 payload.constraints,
                                 payload.requires_confirmation)
    return {"id": p.id}


@router.put("/permissions/{pid}")
def update_perm(pid: int, payload: PermissionIn,
                db: Session = Depends(get_db)):
    from ..models import Permission
    p = db.get(Permission, pid)
    if not p:
        raise HTTPException(404)
    p.effect = payload.effect
    p.constraints = payload.constraints
    p.requires_confirmation = payload.requires_confirmation
    db.commit()
    return {"ok": True}


@router.delete("/permissions/{pid}")
def revoke(pid: int, db: Session = Depends(get_db)):
    if not permission_service.revoke(db, pid):
        raise HTTPException(404)
    return {"ok": True, "note": "Permiso revocado: deja de funcionar "
                                 "inmediatamente."}


@router.get("/approvals")
def approvals(status: str = "pending", db: Session = Depends(get_db)):
    q = db.query(AuthorizationRequest)
    if status != "all":
        q = q.filter_by(status=status)
    rows = q.order_by(AuthorizationRequest.id.desc()).all()
    out = []
    for r in rows:
        a = db.get(Agent, r.agent_id)
        out.append({"id": r.id, "agent": a.name if a else "?",
                    "agent_id": r.agent_id, "task_id": r.task_id,
                    "action_type": r.action_type, "reason": r.reason,
                    "resources": r.resources, "cost_estimate": r.cost_estimate,
                    "risk": r.risk, "status": r.status,
                    "created_at": r.created_at})
    return out


@router.post("/approvals/{rid}/resolve")
def resolve(rid: int, payload: ResolveAuthIn, uid: int = Depends(user_id),
            db: Session = Depends(get_db)):
    req = permission_service.resolve(db, rid, payload.decision, payload.note)
    if not req:
        raise HTTPException(404)
    result = None
    if payload.decision in ("approved", "modified"):
        result = run_approved_payload(db, req, uid)
        # if the paused task existed, let the executor retry it
        from ..models import Task
        if req.task_id:
            t = db.get(Task, req.task_id)
            if t and t.status == "awaiting_authorization":
                t.status = "pending"
                db.commit()
    notify(db, uid, "Solicitud resuelta",
           f"{req.action_type}: {payload.decision}", event_type="auth_resolved")
    return {"ok": True, "execution": result}
