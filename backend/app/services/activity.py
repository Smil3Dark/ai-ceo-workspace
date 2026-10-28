"""Activity log + notification creation. Never logs secret values."""
from ..models import ActivityLog, Notification
from .events import bus


def log_action(db, action: str, agent_id=None, task_id=None, tool="",
               result="", permissions=None, auth_id=None, cost=0.0,
               error=""):
    entry = ActivityLog(
        action=action, agent_id=agent_id, task_id=task_id, tool=tool,
        result=result, permissions_used=permissions or [],
        auth_id=auth_id, cost=cost, error=str(error)[:2000],
    )
    db.add(entry)
    db.commit()
    return entry


def notify(db, user_id: int, title: str, body: str = "", level: str = "info",
           link: str = "", event_type: str = "", dedupe_key: str = ""):
    if dedupe_key:
        dup = (db.query(Notification)
               .filter_by(dedupe_key=dedupe_key, read=False).first())
        if dup:
            return dup
    n = Notification(user_id=user_id, title=title, body=body, level=level,
                     link=link, event_type=event_type, dedupe_key=dedupe_key)
    db.add(n)
    db.commit()
    bus.publish("notification", {"id": n.id, "title": title, "level": level,
                                 "link": link})
    return n
