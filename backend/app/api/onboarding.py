from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Agent, UserProfile
from ..schemas import OnboardingIn, ProfileIn
from ..services import conversation, settings_service
from .deps import user_id

router = APIRouter(prefix="/api/onboarding", tags=["onboarding"])


@router.get("/status")
def status(uid: int = Depends(user_id), db: Session = Depends(get_db)):
    return {"onboarding_done": settings_service.get(db, "onboarding_done", False),
            "ai_mode": settings_service.get(db, "ai_mode", "local")}


@router.post("")
def complete(payload: OnboardingIn, uid: int = Depends(user_id),
             db: Session = Depends(get_db)):
    prof = db.query(UserProfile).filter_by(user_id=uid).first()
    if not prof:
        prof = UserProfile(user_id=uid)
        db.add(prof)
    for k, v in payload.profile.model_dump().items():
        setattr(prof, k, v)
    settings_service.set_value(db, "ai_mode", payload.ai_mode)
    settings_service.set_value(db, "cost_pref", payload.cost_pref)
    settings_service.set_value(db, "priority_pref", payload.priority_pref)
    settings_service.set_value(db, "onboarding_done", True)
    ceo = conversation.get_or_create_ceo(db, uid)
    if payload.assistant_name and payload.assistant_name != ceo.name:
        ceo.name = payload.assistant_name
        db.commit()
    return {"ok": True, "ceo": {"id": ceo.id, "name": ceo.name,
                                "status": ceo.status}}


@router.put("/profile")
def update_profile(payload: ProfileIn, uid: int = Depends(user_id),
                   db: Session = Depends(get_db)):
    prof = db.query(UserProfile).filter_by(user_id=uid).first()
    if not prof:
        prof = UserProfile(user_id=uid)
        db.add(prof)
    for k, v in payload.model_dump().items():
        setattr(prof, k, v)
    db.commit()
    return {"ok": True}


@router.get("/profile")
def get_profile(uid: int = Depends(user_id), db: Session = Depends(get_db)):
    prof = db.query(UserProfile).filter_by(user_id=uid).first()
    if not prof:
        return {}
    return {c.name: getattr(prof, c.name) for c in prof.__table__.columns}


@router.delete("/profile")
def delete_profile(uid: int = Depends(user_id), db: Session = Depends(get_db)):
    db.query(UserProfile).filter_by(user_id=uid).delete()
    db.commit()
    return {"ok": True}
