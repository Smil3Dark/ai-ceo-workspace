from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Conversation, Message
from ..schemas import ChatIn
from ..services import conversation as conv_service
from .deps import user_id

router = APIRouter(prefix="/api/chat", tags=["chat"])


@router.get("/conversations")
def list_convs(uid: int = Depends(user_id), db: Session = Depends(get_db)):
    convs = (db.query(Conversation).filter_by(user_id=uid)
             .order_by(Conversation.id.desc()).all())
    return [{"id": c.id, "title": c.title, "created_at": c.created_at}
            for c in convs]


@router.post("/conversations")
def new_conv(uid: int = Depends(user_id), db: Session = Depends(get_db)):
    c = Conversation(user_id=uid)
    db.add(c); db.commit()
    return {"id": c.id, "title": c.title}


@router.get("/conversations/{cid}/messages")
def messages(cid: int, uid: int = Depends(user_id),
             db: Session = Depends(get_db)):
    msgs = (db.query(Message).filter_by(conversation_id=cid)
            .order_by(Message.id).all())
    return [{"id": m.id, "role": m.role, "content": m.content,
             "meta": m.meta, "created_at": m.created_at} for m in msgs]


@router.post("/send")
async def send(payload: ChatIn, uid: int = Depends(user_id),
               db: Session = Depends(get_db)):
    conv = (db.get(Conversation, payload.conversation_id)
            if payload.conversation_id else None)
    if not conv:
        conv = Conversation(user_id=uid, title=payload.text[:60])
        db.add(conv); db.commit()
    msg = await conv_service.handle_user_message(db, uid, conv, payload.text)
    return {"conversation_id": conv.id, "message": {
        "id": msg.id, "role": msg.role, "content": msg.content,
        "meta": msg.meta, "created_at": msg.created_at}}


@router.post("/stop")
def stop_current(uid: int = Depends(user_id), db: Session = Depends(get_db)):
    """Cancel running tasks created by the CEO (best-effort stop)."""
    from ..models import Task
    n = 0
    for t in db.query(Task).filter(Task.status.in_(["pending", "planned"])):
        t.status = "cancelled"
        n += 1
    db.commit()
    return {"stopped": n}
