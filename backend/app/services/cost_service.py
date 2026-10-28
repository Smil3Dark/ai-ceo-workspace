"""Cost accounting summaries. Distinguishes real provider-reported usage from
estimates (estimated flag on every record)."""
from sqlalchemy import func

from ..models import Agent, CostRecord


def summary(db) -> dict:
    rows = (db.query(CostRecord.agent_id, Agent.name,
                     func.sum(CostRecord.tokens_in),
                     func.sum(CostRecord.tokens_out),
                     func.sum(CostRecord.cost_usd),
                     func.count(CostRecord.id))
            .outerjoin(Agent, Agent.id == CostRecord.agent_id)
            .group_by(CostRecord.agent_id, Agent.name).all())
    by_agent = [{"agent_id": a, "agent": n or "(sistema)",
                 "tokens_in": int(ti or 0), "tokens_out": int(to or 0),
                 "cost_usd": round(c or 0, 6), "calls": cnt}
                for a, n, ti, to, c, cnt in rows]
    total = (db.query(func.sum(CostRecord.cost_usd)).scalar() or 0.0)
    return {"by_agent": by_agent,
            "total_cost_usd": round(total, 6),
            "total_records": db.query(CostRecord).count()}


def history(db, limit: int = 100):
    return (db.query(CostRecord).order_by(CostRecord.id.desc())
            .limit(limit).all())
