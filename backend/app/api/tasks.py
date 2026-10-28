from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Agent, Execution, Task
from ..schemas import TaskIn
from .deps import user_id

router = APIRouter(prefix="/api/tasks", tags=["tasks"])


def serialize(t: Task, db) -> dict:
    a = db.get(Agent, t.agent_id) if t.agent_id else None
    return {"id": t.id, "title": t.title, "description": t.description,
            "status": t.status, "priority": t.priority,
            "agent_id": t.agent_id, "agent_name": a.name if a else None,
            "project_id": t.project_id, "depends_on": t.depends_on,
            "result": t.result, "error": t.error, "attempts": t.attempts,
            "max_attempts": t.max_attempts, "cost_usd": t.cost_usd,
            "created_by": t.created_by, "created_at": t.created_at,
            "started_at": t.started_at, "finished_at": t.finished_at}


@router.get("")
def list_tasks(status: str | None = None, db: Session = Depends(get_db)):
    q = db.query(Task).order_by(Task.id.desc())
    if status:
        q = q.filter_by(status=status)
    return [serialize(t, db) for t in q.limit(300).all()]


@router.post("")
def create(payload: TaskIn, db: Session = Depends(get_db)):
    t = Task(**payload.model_dump(), status="pending", created_by="user")
    db.add(t); db.commit()
    return serialize(t, db)


@router.get("/{tid}")
def get_task(tid: int, db: Session = Depends(get_db)):
    t = db.get(Task, tid)
    if not t:
        raise HTTPException(404)
    out = serialize(t, db)
    out["executions"] = [
        {"id": e.id, "step": e.step, "kind": e.kind, "detail": e.detail,
         "tokens_in": e.tokens_in, "tokens_out": e.tokens_out,
         "cost": e.cost, "status": e.status, "created_at": e.created_at}
        for e in db.query(Execution).filter_by(task_id=tid).order_by(Execution.id)]
    return out


@router.post("/{tid}/cancel")
def cancel(tid: int, db: Session = Depends(get_db)):
    t = db.get(Task, tid)
    if not t:
        raise HTTPException(404)
    if t.status in ("completed", "failed", "cancelled"):
        return {"ok": False, "status": t.status}
    t.status = "cancelled"
    db.commit()
    return {"ok": True}


@router.post("/{tid}/retry")
def retry(tid: int, db: Session = Depends(get_db)):
    t = db.get(Task, tid)
    if not t:
        raise HTTPException(404)
    t.status, t.error, t.attempts = "pending", "", 0
    db.commit()
    return {"ok": True}
