from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Goal, Project
from ..schemas import GoalIn, ProjectIn
from .deps import user_id

router = APIRouter(prefix="/api", tags=["projects"])


@router.get("/projects")
def list_projects(uid: int = Depends(user_id), db: Session = Depends(get_db)):
    return [{c.name: getattr(p, c.name) for c in p.__table__.columns}
            for p in db.query(Project).filter_by(user_id=uid).all()]


@router.post("/projects")
def create_project(payload: ProjectIn, uid: int = Depends(user_id),
                   db: Session = Depends(get_db)):
    p = Project(user_id=uid, **payload.model_dump())
    db.add(p); db.commit()
    return {"id": p.id}


@router.put("/projects/{pid}")
def update_project(pid: int, payload: dict, uid: int = Depends(user_id),
                   db: Session = Depends(get_db)):
    p = db.get(Project, pid)
    if not p or p.user_id != uid:
        raise HTTPException(404)
    for k, v in payload.items():
        if hasattr(p, k):
            setattr(p, k, v)
    db.commit()
    return {"ok": True}


@router.delete("/projects/{pid}")
def delete_project(pid: int, uid: int = Depends(user_id),
                   db: Session = Depends(get_db)):
    p = db.get(Project, pid)
    if not p or p.user_id != uid:
        raise HTTPException(404)
    db.delete(p); db.commit()
    return {"ok": True}


@router.get("/goals")
def list_goals(uid: int = Depends(user_id), db: Session = Depends(get_db)):
    return [{c.name: getattr(g, c.name) for c in g.__table__.columns}
            for g in db.query(Goal).filter_by(user_id=uid).all()]


@router.post("/goals")
def create_goal(payload: GoalIn, uid: int = Depends(user_id),
                db: Session = Depends(get_db)):
    g = Goal(user_id=uid, **payload.model_dump())
    db.add(g); db.commit()
    return {"id": g.id}


@router.put("/goals/{gid}")
def update_goal(gid: int, payload: dict, uid: int = Depends(user_id),
                db: Session = Depends(get_db)):
    g = db.get(Goal, gid)
    if not g or g.user_id != uid:
        raise HTTPException(404)
    for k, v in payload.items():
        if hasattr(g, k):
            setattr(g, k, v)
    db.commit()
    return {"ok": True}


@router.delete("/goals/{gid}")
def delete_goal(gid: int, uid: int = Depends(user_id),
                db: Session = Depends(get_db)):
    g = db.get(Goal, gid)
    if not g or g.user_id != uid:
        raise HTTPException(404)
    db.delete(g); db.commit()
    return {"ok": True}
