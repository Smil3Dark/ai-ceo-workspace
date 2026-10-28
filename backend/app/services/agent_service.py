"""Agent CRUD, natural-language creation proposals and team proposals."""
import json

from ..models import Agent, Provider, Team
from . import permission_service, provider_service
from .activity import log_action

DEFAULT_TOOLSETS = {
    "research": ["memory_search", "memory_write", "doc_search", "doc_index",
                 "http_get", "file_read", "file_write", "report_result"],
    "writer": ["memory_search", "memory_write", "file_read", "file_write",
               "doc_search", "report_result"],
    "developer": ["memory_search", "memory_write", "file_read", "file_write",
                  "exec_code", "report_result"],
    "marketing": ["memory_search", "memory_write", "doc_search",
                  "file_write", "send_message", "publish_content",
                  "report_result"],
    "coordinator": ["memory_search", "memory_write", "delegate_task",
                    "file_read", "file_write", "report_result"],
    "analyst": ["memory_search", "memory_write", "doc_search", "file_read",
                "file_write", "report_result"],
    "generic": ["memory_search", "memory_write", "file_read", "file_write",
                "report_result"],
}

ROLE_KEYWORDS = {
    "research": ["investig", "research", "tendencia", "competenc"],
    "writer": ["redact", "escrib", "contenido", "copy", "document"],
    "developer": ["program", "código", "code", "desarroll", "software", "script"],
    "marketing": ["marketing", "publicidad", "anuncio", "social", "campañ"],
    "coordinator": ["coordin", "gestion", "administra", "supervis"],
    "analyst": ["anal", "datos", "ventas", "finanz", "métric"],
}


def guess_role(description: str) -> str:
    d = description.lower()
    for role, kws in ROLE_KEYWORDS.items():
        if any(k in d for k in kws):
            return role
    return "generic"


def propose_agent_config(db, user_id: int, description: str,
                         answers: dict | None = None) -> dict:
    """Rule-based draft the LLM may refine; the API layers LLM polish on top
    when a provider is configured. Deterministic so it always works."""
    answers = answers or {}
    role = guess_role(description + " " + json.dumps(answers, ensure_ascii=False))
    name = answers.get("name") or _suggest_name(description, role)
    provider, model = provider_service.resolve_for_agent(
        db, Agent(provider_id=None))
    tools = DEFAULT_TOOLSETS[role]
    proposal = {
        "name": name,
        "role": role,
        "specialty": answers.get("specialty", ""),
        "objective": answers.get("objective", description[:300]),
        "description": description,
        "instructions": answers.get("instructions") or (
            f"Eres {name}, un agente especializado. Objetivo: "
            f"{description[:300]}. Trabaja de forma verificable: declara tus "
            "resultados con report_result y guarda archivos en tu carpeta de "
            "trabajo. No ejecutes acciones fuera de tus permisos."),
        "tools": tools,
        "permissions": _default_permissions(tools),
        "model": model,
        "provider_id": provider.id if provider else None,
        "provider_name": provider.name if provider else None,
        "autonomy": answers.get("autonomy", "ask_first"),
        "budget": float(answers.get("budget", 0) or 0),
        "memory_scope": ["fact", "project", "verified_knowledge", "document"],
        "limitations": _limitations(role, provider),
        "external_connections": _needed_connections(tools),
        "avatar": {"color": _color_for(role), "style": "stylized",
                   "outfit": "casual", "accessories": []},
        "voice": {"enabled": False, "lang": "es-MX", "rate": 1.0, "pitch": 1.0},
    }
    return proposal


def _suggest_name(description: str, role: str) -> str:
    base = {"research": "Investigador", "writer": "Redactor",
            "developer": "Dev", "marketing": "Marketer",
            "coordinator": "Coordinador", "analyst": "Analista",
            "generic": "Agente"}[role]
    return base


def _color_for(role: str) -> str:
    return {"research": "#4f8ff7", "writer": "#a06df7", "developer": "#34c98e",
            "marketing": "#f76d6d", "coordinator": "#f7b84f",
            "analyst": "#4fd4f7", "generic": "#9aa5b1"}[role]


def _limitations(role: str, provider) -> list[str]:
    out = []
    if not provider:
        out.append("Sin proveedor de IA configurado: quedará pendiente de "
                   "configuración hasta conectar un modelo.")
    if role == "marketing":
        out.append("Enviar mensajes y publicar requieren confirmación humana.")
    return out


def _needed_connections(tools: list[str]) -> list[str]:
    need = []
    if "external_http" in tools or "http_get" in tools:
        need.append("Acceso HTTP externo (se configura por dominios permitidos)")
    if "send_message" in tools:
        need.append("Canal de envío de mensajes (pendiente de integración real)")
    return need


def _default_permissions(tools: list[str]) -> list[dict]:
    from ..tools.registry import TOOL_SPECS
    scopes = {t["scope"] for t in TOOL_SPECS if t["name"] in tools}
    return [{"scope": s, "effect": "allow",
             "requires_confirmation": s in
             permission_service.SENSITIVE_SCOPES} for s in sorted(scopes)]


def create_from_proposal(db, user_id: int, proposal: dict) -> Agent:
    agent = Agent(
        user_id=user_id, name=proposal["name"][:120],
        description=proposal.get("description", ""),
        role=proposal.get("role", "generic"),
        specialty=proposal.get("specialty", ""),
        instructions=proposal.get("instructions", ""),
        objective=proposal.get("objective", ""),
        provider_id=proposal.get("provider_id"),
        model=proposal.get("model", ""),
        autonomy=proposal.get("autonomy", "ask_first"),
        budget=float(proposal.get("budget", 0) or 0),
        avatar=proposal.get("avatar", {}),
        voice=proposal.get("voice", {}),
        memory_scope=proposal.get("memory_scope", ["fact", "project"]),
        tools=proposal.get("tools", []),
        team_id=proposal.get("team_id"),
        project_id=proposal.get("project_id"),
        status="active" if proposal.get("provider_id") else "pending_config",
        config_pending_reason="" if proposal.get("provider_id")
        else "Falta proveedor de IA",
    )
    db.add(agent)
    db.flush()
    for p in proposal.get("permissions", []):
        permission_service.grant(db, agent.id, p["scope"], p.get("effect", "allow"),
                                 p.get("constraints"), p.get("requires_confirmation", False))
    db.commit()
    log_action(db, "agent_created", agent.id, result="ok")
    return agent


def update_agent(db, agent: Agent, fields: dict) -> Agent:
    for k in ("name", "description", "role", "specialty", "instructions",
              "objective", "model", "provider_id", "autonomy", "budget",
              "priority", "avatar", "voice", "memory_scope", "tools",
              "team_id", "project_id", "status", "config_pending_reason"):
        if k in fields:
            setattr(agent, k, fields[k])
    if fields.get("provider_id") and agent.status == "pending_config":
        agent.status = "active"
        agent.config_pending_reason = ""
    db.commit()
    log_action(db, "agent_updated", agent.id, result="ok")
    return agent


def duplicate(db, agent: Agent) -> Agent:
    clone = Agent(
        user_id=agent.user_id, name=f"{agent.name} (copia)",
        description=agent.description, role=agent.role,
        specialty=agent.specialty, instructions=agent.instructions,
        objective=agent.objective, provider_id=agent.provider_id,
        model=agent.model, autonomy=agent.autonomy, budget=agent.budget,
        avatar=dict(agent.avatar or {}), voice=dict(agent.voice or {}),
        memory_scope=list(agent.memory_scope or []),
        tools=list(agent.tools or []), team_id=agent.team_id,
        project_id=agent.project_id, status=agent.status)
    db.add(clone)
    db.flush()
    for p in permission_service.matrix(db, agent.id):
        if p["effect"] != "unset":
            permission_service.grant(db, clone.id, p["scope"], p["effect"],
                                     p["constraints"], p["requires_confirmation"])
    db.commit()
    return clone


def propose_team(db, user_id: int, project_desc: str) -> dict:
    """Team recommendation per spec §7: explain why, three options later in UI."""
    desc = project_desc.lower()
    roles = []
    if any(k in desc for k in ["venta", "vender", "cliente", "tienda", "ropa",
                               "paletería", "negocio", "empresa", "marca"]):
        roles = ["research", "analyst", "marketing", "coordinator"]
    elif any(k in desc for k in ["software", "app", "web", "código", "api"]):
        roles = ["developer", "analyst", "coordinator"]
    elif any(k in desc for k in ["investiga", "mercado", "competencia"]):
        roles = ["research", "analyst"]
    else:
        roles = ["analyst", "coordinator"]
    # single agent when the problem is narrow (spec: no redundant agents)
    if len(desc.split()) < 12 and len(roles) > 2:
        roles = roles[:1]
    members = []
    for r in dict.fromkeys(roles):
        prop = propose_agent_config(db, user_id,
                                    f"{r} para el proyecto: {project_desc}")
        prop["reason"] = _why(r)
        members.append(prop)
    return {"project": project_desc, "members": members,
            "options": ["accept", "customize", "manual"]}


def _why(role: str) -> str:
    return {"research": "Reúne información externa y contexto del mercado.",
            "analyst": "Convierte datos en conclusiones y prioridades.",
            "marketing": "Prepara campañas y mensajes (requiere aprobación para publicar).",
            "coordinator": "Coordina al equipo, dependencias y seguimiento.",
            "developer": "Implementa y verifica cambios técnicos.",
            "writer": "Redacta los entregables finales.",
            "generic": "Apoyo general del proyecto."}[role]
