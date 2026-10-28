"""Shared dependencies: DB session + the single local user."""
from fastapi import Depends
from sqlalchemy.orm import Session

from ..config import DEFAULT_USER_NAME
from ..database import get_db
from ..models import User


def current_user(db: Session = Depends(get_db)) -> User:
    user = db.query(User).order_by(User.id).first()
    if not user:
        user = User(name=DEFAULT_USER_NAME)
        db.add(user)
        db.commit()
    return user


def user_id(user: User = Depends(current_user)) -> int:
    return user.id
