"""Persistent structured memory. Categories per spec; keyword search baseline
(optional vector search can be layered later without changing callers)."""
from datetime import datetime

from ..models import Memory

CATEGORIES = ["profile", "preference", "goal", "project", "agent",
              "task_history", "document", "verified_knowledge", "fact"]
KINDS = ["fact", "preference", "hypothesis", "objective"]


def save(db, owner_type: str, owner_id: int, category: str, content: str,
         kind: str = "fact", source: str = "", tags=None, importance: int = 3,
         verified: bool = False) -> Memory:
    if category not in CATEGORIES:
        category = "fact"
    if kind not in KINDS:
        kind = "fact"
    # avoid near-duplicate writes
    dup = (db.query(Memory)
           .filter_by(owner_type=owner_type, owner_id=owner_id,
                      category=category, content=content.strip()).first())
    if dup:
        return dup
    m = Memory(owner_type=owner_type, owner_id=owner_id, category=category,
               kind=kind, content=content.strip(), source=source,
               tags=tags or [], importance=importance, verified=verified)
    db.add(m)
    db.commit()
    return m


def update(db, memory_id: int, **fields) -> Memory | None:
    m = db.get(Memory, memory_id)
    if not m:
        return None
    for k in ("content", "category", "kind", "source", "tags", "importance",
              "verified"):
        if k in fields:
            setattr(m, k, fields[k])
    m.updated_at = datetime.utcnow()
    db.commit()
    return m


def delete(db, memory_id: int) -> bool:
    m = db.get(Memory, memory_id)
    if not m:
        return False
    db.delete(m)
    db.commit()
    return True


def search(db, query: str, owner_type: str | None = None,
           owner_id: int | None = None, categories: list[str] | None = None,
           limit: int = 10) -> list[Memory]:
    q = db.query(Memory)
    if owner_type:
        q = q.filter_by(owner_type=owner_type)
    if owner_id is not None:
        q = q.filter_by(owner_id=owner_id)
    if categories:
        q = q.filter(Memory.category.in_(categories))
    if query:
        like = f"%{query.lower()}%"
        q = q.filter(Memory.content.ilike(like))
    return (q.order_by(Memory.importance.desc(), Memory.updated_at.desc())
            .limit(limit).all())


def context_for_user(db, user_id: int, query: str = "", limit: int = 12):
    """Memories the CEO may use: user-owned + system knowledge."""
    items = search(db, query, owner_type="user", owner_id=user_id, limit=limit)
    items += search(db, query, owner_type="system", limit=4)
    return items


def agent_can_read(agent, memory: Memory) -> bool:
    if memory.owner_type == "agent" and memory.owner_id != agent.id:
        return False  # private to its owner agent
    if memory.owner_type == "user":
        return memory.category in (agent.memory_scope or [])
    return True  # system knowledge is public


def export_all(db, user_id: int) -> dict:
    rows = db.query(Memory).filter_by(owner_type="user", owner_id=user_id).all()
    return {"memories": [
        {"category": m.category, "kind": m.kind, "content": m.content,
         "source": m.source, "tags": m.tags, "importance": m.importance,
         "verified": m.verified} for m in rows]}


def import_all(db, user_id: int, payload: dict) -> int:
    count = 0
    for m in payload.get("memories", []):
        save(db, "user", user_id, m.get("category", "fact"),
             m.get("content", ""), m.get("kind", "fact"), m.get("source", "import"),
             m.get("tags"), m.get("importance", 3), m.get("verified", False))
        count += 1
    return count
