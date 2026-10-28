"""Office config + derived visual state for each agent (consumed by the 3D
office via REST/WS; the office never controls execution)."""
from ..models import Agent, OfficeConfig, Task

DEFAULT_CONFIG = {
    "scenario": "corporate",
    "layout": {"desks": 6, "meeting_room": True, "leisure_zone": True,
               "plants": 4, "decor": []},
    "lighting": {"intensity": 1.0, "ambient": 0.5, "interior_lights": True},
    "cycle": {"mode": "auto", "speed": 60, "start_hour": 9},
    "placements": {},
}

STATUS_MAP = {  # task status -> avatar visual state
    "running": "trabajando", "verifying": "en_verificacion",
    "awaiting_authorization": "esperando_confirmacion",
    "blocked": "bloqueado", "failed": "error", "planned": "esperando",
    "pending": "esperando",
}


def get_or_create(db, user_id: int) -> OfficeConfig:
    cfg = db.query(OfficeConfig).filter_by(user_id=user_id).first()
    if not cfg:
        cfg = OfficeConfig(user_id=user_id, **{k: (dict(v) if isinstance(v, dict) else v)
                                               for k, v in DEFAULT_CONFIG.items()})
        db.add(cfg)
        db.commit()
    return cfg


def agent_visual_state(db, agent: Agent) -> dict:
    """State shown above each avatar — always derived from real task state."""
    if agent.status == "paused":
        state, task_title = "pausado", None
    elif agent.status == "pending_config":
        state, task_title = "sin_configurar", None
    else:
        t = (db.query(Task)
             .filter(Task.agent_id == agent.id,
                     Task.status.in_(["running", "verifying",
                                      "awaiting_authorization", "blocked"]))
             .order_by(Task.id.desc()).first())
        if t:
            state, task_title = STATUS_MAP.get(t.status, "trabajando"), t.title
        else:
            state, task_title = "sin_actividad", None
    return {"agent_id": agent.id, "name": agent.name, "role": agent.role,
            "state": state, "task": task_title,
            "avatar": agent.avatar or {}, "db_status": agent.status}
