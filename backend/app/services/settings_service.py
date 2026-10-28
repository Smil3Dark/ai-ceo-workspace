"""Global settings + global pause switch."""
from datetime import datetime

from ..models import PauseState, Setting

DEFAULTS = {
    "ai_mode": "local",          # local|online|hybrid
    "language": "es",
    "spend_limit": 0.0,          # 0 = unlimited
    "spend_limit_hit": False,
    "voice_enabled": True,
    "notifications": {"in_app": True, "sound": False, "spoken": False,
                      "min_level": "info"},
    "privacy": {"send_private_to_external": False},
    "onboarding_done": False,
    "ui": {"theme": "dark"},
}


def get(db, key: str, default=None):
    row = db.get(Setting, key)
    if row:
        return row.value
    return DEFAULTS.get(key, default)


def set_value(db, key: str, value):
    row = db.get(Setting, key)
    if row:
        row.value = value
    else:
        db.add(Setting(key=key, value=value))
    db.commit()
    return value


def all_settings(db) -> dict:
    out = dict(DEFAULTS)
    for row in db.query(Setting).all():
        out[row.key] = row.value
    return out


def is_paused(db) -> bool:
    row = db.query(PauseState).first()
    return bool(row and row.paused)


def set_paused(db, paused: bool, reason: str = "") -> bool:
    row = db.query(PauseState).first()
    if not row:
        row = PauseState(paused=paused, reason=reason)
        db.add(row)
    else:
        row.paused, row.reason, row.updated_at = paused, reason, datetime.utcnow()
    db.commit()
    return paused
