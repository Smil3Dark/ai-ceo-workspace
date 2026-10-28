"""Backend-enforced authorization. The LLM proposes; this layer decides.

Every tool call an agent attempts passes through check(). Missing or
confirmation-gated scopes create an AuthorizationRequest and the action is
NOT executed. A request is never an approval by itself."""
from datetime import datetime

from ..models import Agent, AuthorizationRequest, Permission

# scopes that always need a human decision when used (per spec 10.3)
SENSITIVE_SCOPES = {"send_message", "publish", "purchase", "exec_code",
                  "external_share", "grant_permissions", "file_delete"}

ALL_SCOPES = sorted({
    "file_read", "file_write", "file_delete", "memory_read", "memory_write",
    "doc_index", "doc_search", "external_http", "send_message", "publish",
    "purchase", "delegate", "grant_permissions", "create_agent", "exec_code",
    "external_share", "report_result",
})

TOOL_SCOPES = {  # tool name -> permission scope it needs
    "memory_search": "memory_read",
    "memory_write": "memory_write",
    "doc_index": "doc_index",
    "doc_search": "doc_search",
    "file_write": "file_write",
    "file_read": "file_read",
    "http_get": "external_http",
    "delegate_task": "delegate",
    "create_agent": "create_agent",
    "report_result": "report_result",
    "send_message": "send_message",
    "publish_content": "publish",
    "exec_code": "exec_code",
}


def _find_perm(db, agent_id: int, scope: str) -> Permission | None:
    perms = (db.query(Permission)
             .filter_by(agent_id=agent_id, scope=scope).all())
    if not perms:
        return None
    # deny wins over allow
    for p in perms:
        if p.effect == "deny":
            return p
    return perms[0]


def check(db, agent: Agent, scope: str, context: dict | None = None) -> dict:
    """Returns {allowed, needs_confirmation, reason, permission}."""
    perm = _find_perm(db, agent.id, scope)
    if perm is None:
        return {"allowed": False, "needs_confirmation": False,
                "reason": f"El agente no tiene el permiso '{scope}'.",
                "permission": None}
    if perm.effect == "deny":
        return {"allowed": False, "needs_confirmation": False,
                "reason": f"Permiso '{scope}' denegado explícitamente.",
                "permission": perm}
    if scope in SENSITIVE_SCOPES or perm.requires_confirmation:
        # sensitive ops always go through the confirmation inbox
        return {"allowed": False, "needs_confirmation": True,
                "reason": f"'{scope}' requiere confirmación del usuario.",
                "permission": perm}
    return {"allowed": True, "needs_confirmation": False, "reason": "",
            "permission": perm}


def request_authorization(db, agent: Agent, action_type: str, reason: str,
                          task_id=None, resources=None, payload=None,
                          cost_estimate=None, risk="medium",
                          user_id=None) -> AuthorizationRequest:
    req = AuthorizationRequest(
        agent_id=agent.id, task_id=task_id, action_type=action_type,
        reason=reason, resources=resources or {}, payload=payload or {},
        cost_estimate=cost_estimate, risk=risk, status="pending")
    db.add(req)
    db.commit()
    return req


def resolve(db, request_id: int, decision: str, note: str = "") -> AuthorizationRequest | None:
    req = db.get(AuthorizationRequest, request_id)
    if not req or req.status != "pending":
        return req
    if decision not in {"approved", "rejected", "modified", "postponed"}:
        raise ValueError("decisión inválida")
    req.status = decision
    req.resolution_note = note
    req.resolved_at = datetime.utcnow()
    db.commit()
    return req


def grant(db, agent_id: int, scope: str, effect="allow",
          constraints=None, requires_confirmation=False) -> Permission:
    p = Permission(agent_id=agent_id, scope=scope, effect=effect,
                   constraints=constraints or {},
                   requires_confirmation=requires_confirmation)
    db.add(p)
    db.commit()
    return p


def revoke(db, permission_id: int) -> bool:
    p = db.get(Permission, permission_id)
    if not p:
        return False
    db.delete(p)
    db.commit()
    return True


def matrix(db, agent_id: int) -> list[dict]:
    out = []
    perms = {p.scope: p for p in db.query(Permission).filter_by(agent_id=agent_id)}
    for scope in ALL_SCOPES:
        p = perms.get(scope)
        out.append({"scope": scope,
                    "effect": p.effect if p else "unset",
                    "requires_confirmation": p.requires_confirmation if p else False,
                    "constraints": p.constraints if p else {},
                    "permission_id": p.id if p else None,
                    "sensitive": scope in SENSITIVE_SCOPES})
    return out
