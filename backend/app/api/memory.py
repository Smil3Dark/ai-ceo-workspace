from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Memory
from ..schemas import MemoryIn
from ..services import memory_service
from .deps import user_id

router = APIRouter(prefix="/api/memory", tags=["memory"])


def serialize(m: Memory) -> dict:
    return {c.name: getattr(m, c.name) for c in m.__table__.columns}


@router.get("")
def list_memories(category: str | None = None, q: str = "",
                  uid: int = Depends(user_id), db: Session = Depends(get_db)):
    cats = [category] if category else None
    items = memory_service.search(db, q, owner_type="user", owner_id=uid,
                                  categories=cats, limit=200)
    return [serialize(m) for m in items]


@router.post("")
def create(payload: MemoryIn, uid: int = Depends(user_id),
           db: Session = Depends(get_db)):
    m = memory_service.save(db, "user", uid, payload.category,
                            payload.content, payload.kind, payload.source,
                            payload.tags, payload.importance, payload.verified)
    return serialize(m)


@router.put("/{mid}")
def update(mid: int, payload: dict, db: Session = Depends(get_db)):
    m = memory_service.update(db, mid, **payload)
    if not m:
        raise HTTPException(404)
    return serialize(m)


@router.delete("/{mid}")
def delete(mid: int, db: Session = Depends(get_db)):
    if not memory_service.delete(db, mid):
        raise HTTPException(404)
    return {"ok": True}


@router.get("/export")
def export(uid: int = Depends(user_id), db: Session = Depends(get_db)):
    return memory_service.export_all(db, uid)


@router.post("/import")
def import_mem(payload: dict, uid: int = Depends(user_id),
               db: Session = Depends(get_db)):
    n = memory_service.import_all(db, uid, payload)
    return {"imported": n}
