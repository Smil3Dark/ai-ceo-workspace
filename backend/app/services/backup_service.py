"""Export/import user data + SQLite backups."""
import json
import shutil
from datetime import datetime
from pathlib import Path

from ..config import BACKUP_DIR, DB_PATH
from ..models import (Agent, Goal, Memory, Project, Task, UserProfile)


def export_user_data(db, user_id: int) -> dict:
    prof = db.query(UserProfile).filter_by(user_id=user_id).first()
    agents = db.query(Agent).filter_by(user_id=user_id).all()
    return {
        "exported_at": datetime.utcnow().isoformat(),
        "profile": {c.name: getattr(prof, c.name) for c in prof.__table__.columns
                    if c.name != "id"} if prof else {},
        "goals": [{"title": g.title, "horizon": g.horizon,
                   "priority": g.priority, "status": g.status}
                  for g in db.query(Goal).filter_by(user_id=user_id)],
        "projects": [{"name": p.name, "description": p.description,
                      "status": p.status, "context": p.context}
                     for p in db.query(Project).filter_by(user_id=user_id)],
        "agents": [{"name": a.name, "role": a.role, "specialty": a.specialty,
                    "instructions": a.instructions, "objective": a.objective,
                    "model": a.model, "autonomy": a.autonomy, "budget": a.budget,
                    "avatar": a.avatar, "voice": a.voice, "tools": a.tools,
                    "memory_scope": a.memory_scope,
                    "is_ceo": a.is_ceo} for a in agents],
        "memories": [{"category": m.category, "kind": m.kind,
                      "content": m.content, "tags": m.tags}
                     for m in db.query(Memory).filter_by(owner_type="user",
                                                         owner_id=user_id)],
    }


def backup_now() -> Path:
    BACKUP_DIR.mkdir(parents=True, exist_ok=True)
    dest = BACKUP_DIR / f"app_{datetime.utcnow():%Y%m%d_%H%M%S}.db"
    shutil.copy2(DB_PATH, dest)
    return dest


def list_backups() -> list[dict]:
    return [{"file": p.name, "size": p.stat().st_size,
             "created": datetime.fromtimestamp(p.stat().st_mtime).isoformat()}
            for p in sorted(BACKUP_DIR.glob("*.db"), reverse=True)]


def write_export(db, user_id: int) -> Path:
    data = export_user_data(db, user_id)
    dest = BACKUP_DIR / f"export_{datetime.utcnow():%Y%m%d_%H%M%S}.json"
    dest.write_text(json.dumps(data, ensure_ascii=False, indent=2, default=str))
    return dest
