"""Notifications, costs, office, simulation, admin and system routers."""
import shutil
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy.orm import Session

from ..config import UPLOAD_DIR
from ..database import get_db
from ..models import (ActivityLog, Agent, AuthorizationRequest, Document,
                      Notification, Task)
from ..schemas import SimulateIn
from ..services import (backup_service, cost_service, office_service,
                        settings_service, simulation)
from ..services.activity import notify
from ..services.events import bus
from .deps import user_id

router = APIRouter(prefix="/api", tags=["misc"])


# ---------- notifications ----------
@router.get("/notifications")
def list_notifications(unread: bool = False, uid: int = Depends(user_id),
                       db: Session = Depends(get_db)):
    q = db.query(Notification).filter_by(user_id=uid)
    if unread:
        q = q.filter_by(read=False)
    rows = q.order_by(Notification.id.desc()).limit(200).all()
    return [{c.name: getattr(n, c.name) for c in n.__table__.columns}
            for n in rows]


@router.post("/notifications/{nid}/read")
def mark_read(nid: int, db: Session = Depends(get_db)):
    n = db.get(Notification, nid)
    if not n:
        raise HTTPException(404)
    n.read = True
    db.commit()
    return {"ok": True}


@router.post("/notifications/read-all")
def read_all(uid: int = Depends(user_id), db: Session = Depends(get_db)):
    db.query(Notification).filter_by(user_id=uid, read=False).update({"read": True})
    db.commit()
    return {"ok": True}


# ---------- costs ----------
@router.get("/costs")
def costs(db: Session = Depends(get_db)):
    s = cost_service.summary(db)
    s["spend_limit"] = settings_service.get(db, "spend_limit", 0.0)
    s["history"] = [{c.name: getattr(r, c.name) for c in r.__table__.columns}
                    for r in cost_service.history(db)]
    return s


@router.put("/costs/limit")
def set_limit(payload: dict, db: Session = Depends(get_db)):
    return {"spend_limit": settings_service.set_value(
        db, "spend_limit", float(payload.get("spend_limit", 0)))}


# ---------- office ----------
@router.get("/office")
def get_office(uid: int = Depends(user_id), db: Session = Depends(get_db)):
    cfg = office_service.get_or_create(db, uid)
    agents = db.query(Agent).filter_by(user_id=uid).all()
    return {
        "config": {c.name: getattr(cfg, c.name) for c in cfg.__table__.columns},
        "agents": [office_service.agent_visual_state(db, a) for a in agents],
    }


@router.put("/office")
def put_office(payload: dict, uid: int = Depends(user_id),
               db: Session = Depends(get_db)):
    cfg = office_service.get_or_create(db, uid)
    for k in ("scenario", "layout", "lighting", "cycle", "placements"):
        if k in payload:
            setattr(cfg, k, payload[k])
    db.commit()
    bus.publish("office", {"config": "updated"})
    return {"ok": True}


@router.post("/office/auto-layout")
def auto_layout(uid: int = Depends(user_id), db: Session = Depends(get_db)):
    """Suggest placements by role/team; user can override afterwards."""
    agents = db.query(Agent).filter_by(user_id=uid).all()
    zones = {"developer": "dev_area", "research": "library",
             "analyst": "dev_area", "marketing": "comms_area",
             "coordinator": "meeting_room", "writer": "library",
             "ceo": "ceo_desk", "generic": "open_space"}
    placements = {}
    i = 0
    for a in agents:
        zone = zones.get(a.role or "generic", "open_space")
        placements[str(a.id)] = {"zone": zone, "slot": i}
        i += 1
    cfg = office_service.get_or_create(db, uid)
    cfg.placements = placements
    db.commit()
    return {"placements": placements}


# ---------- simulation ----------
@router.post("/simulation")
def simulate(payload: SimulateIn, db: Session = Depends(get_db)):
    agents = {a.name.lower(): a for a in db.query(Agent).all()}
    steps = [s.model_dump() for s in payload.steps]
    result = simulation.simulate_plan(db, steps, agents,
                                      payload.use_real_llm)
    return result


# ---------- admin ----------
@router.get("/admin/overview")
def overview(uid: int = Depends(user_id), db: Session = Depends(get_db)):
    agents = db.query(Agent).filter_by(user_id=uid).all()
    tasks = db.query(Task).all()
    def n(statuses):
        return len([t for t in tasks if t.status in statuses])
    return {
        "agents_total": len(agents),
        "agents_active": len([a for a in agents if a.status == "active"]),
        "agents_paused": len([a for a in agents if a.status == "paused"]),
        "agents_idle": len([a for a in agents if a.status == "active" and not any(
            t.agent_id == a.id and t.status in
            ("running", "verifying", "awaiting_authorization")
            for t in tasks)]),
        "tasks_pending": n(["pending", "planned"]),
        "tasks_running": n(["running", "verifying"]),
        "tasks_blocked": n(["blocked", "awaiting_authorization"]),
        "tasks_done": n(["completed"]),
        "tasks_failed": n(["failed"]),
        "approvals_pending": db.query(AuthorizationRequest)
        .filter_by(status="pending").count(),
        "paused": settings_service.is_paused(db),
        "costs": cost_service.summary(db)["total_cost_usd"],
    }


@router.post("/admin/pause-all")
def pause_all(payload: dict, db: Session = Depends(get_db)):
    paused = settings_service.set_paused(
        db, bool(payload.get("paused", True)),
        payload.get("reason", "manual"))
    bus.publish("system", {"paused": paused})
    return {"paused": paused,
            "note": "Las tareas en ejecución terminan su paso actual; no se "
                    "asignan nuevas mientras la pausa esté activa."}


@router.get("/admin/activity")
def activity(limit: int = 200, db: Session = Depends(get_db)):
    rows = (db.query(ActivityLog).order_by(ActivityLog.id.desc())
            .limit(limit).all())
    return [{c.name: getattr(r, c.name) for c in r.__table__.columns}
            for r in rows]


# ---------- system ----------
@router.get("/system/status")
def system_status(uid: int = Depends(user_id), db: Session = Depends(get_db)):
    return {"settings": settings_service.all_settings(db),
            "paused": settings_service.is_paused(db),
            "backups": backup_service.list_backups()[:10]}


@router.put("/system/settings")
def put_settings(payload: dict, db: Session = Depends(get_db)):
    for k, v in payload.items():
        settings_service.set_value(db, k, v)
    return settings_service.all_settings(db)


@router.post("/system/backup")
def backup(db: Session = Depends(get_db)):
    p = backup_service.backup_now()
    return {"backup": p.name}


@router.get("/system/export")
def export(uid: int = Depends(user_id), db: Session = Depends(get_db)):
    return backup_service.export_user_data(db, uid)


@router.post("/system/test-notify")
def test_notify(uid: int = Depends(user_id), db: Session = Depends(get_db)):
    notify(db, uid, "Notificación de prueba",
           "El sistema de notificaciones funciona.", event_type="test")
    return {"ok": True}


# ---------- documents ----------
@router.post("/documents")
async def upload_doc(file: UploadFile = File(...), uid: int = Depends(user_id),
                     db: Session = Depends(get_db)):
    dest = UPLOAD_DIR / file.filename
    with dest.open("wb") as f:
        shutil.copyfileobj(file.file, f)
    doc = Document(user_id=uid, name=file.filename, path=str(dest),
                   mime=file.content_type or "", size=dest.stat().st_size)
    db.add(doc); db.commit()
    return {"id": doc.id, "name": doc.name, "size": doc.size}


@router.get("/documents")
def list_docs(uid: int = Depends(user_id), db: Session = Depends(get_db)):
    return [{"id": d.id, "name": d.name, "size": d.size, "indexed": d.indexed,
             "created_at": d.created_at}
            for d in db.query(Document).filter_by(user_id=uid).all()]


@router.delete("/documents/{did}")
def delete_doc(did: int, uid: int = Depends(user_id),
               db: Session = Depends(get_db)):
    d = db.get(Document, did)
    if not d or d.user_id != uid:
        raise HTTPException(404)
    Path(d.path).unlink(missing_ok=True)
    db.delete(d); db.commit()
    return {"ok": True}
