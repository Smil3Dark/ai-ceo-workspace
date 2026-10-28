"""CEO conversation orchestration. The CEO is an Agent row (is_ceo=True) with
orchestration tools handled here — it can propose and delegate, but can never
grant permissions itself (spec rule 5)."""
import json

from ..models import (Agent, Conversation, Goal, Message, Task, UserProfile)
from . import (agent_service, memory_service, permission_service,
               provider_service, settings_service)
from .activity import log_action, notify
from .events import bus
from .llm_runner import record_cost
from ..tools.registry import parse_tool_call

CEO_SYSTEM = (
    "Eres {name}, el asistente CEO del usuario en AI CEO Workspace. "
    "Hablas español, eres conciso, honesto y verificable. Nunca afirmes haber "
    "hecho algo que no hiciste; si falta un permiso o conexión, dilo y pide "
    "autorización con request_permission.\n\n"
    "Perfil del usuario:\n{profile}\n\nObjetivos activos:\n{goals}\n\n"
    "Recuerdos relevantes:\n{memories}\n\nAgentes disponibles:\n{roster}\n\n"
    "Herramientas (responde SOLO un JSON {{\"tool\":..,\"args\":{{..}}}} para "
    "usarlas, o texto normal para responder al usuario):\n"
    "- recall: busca en la memoria. args {{query}}\n"
    "- remember: guarda un recuerdo del usuario. args {{category, kind, content}}\n"
    "- list_agents: lista agentes y estados. args {{}}\n"
    "- propose_team: propone un equipo para un proyecto. args {{project}}\n"
    "- propose_agent: propone configuración de UN agente. args {{description}}\n"
    "- delegate_task: asigna una tarea a un agente existente. args "
    "{{title, description, agent_name, depends_on?}}\n"
    "- task_status: estado de las tareas. args {{}}\n"
    "- request_permission: solicita al usuario un permiso. args {{scope, reason}}\n"
    "Distingue recomendar de ejecutar: propón equipos/agentes, no los crees "
    "sin aprobación. Al delegar, usa el nombre exacto del agente."
)

CEO_TOOLS = {"recall", "remember", "list_agents", "propose_team",
             "propose_agent", "delegate_task", "task_status",
             "request_permission"}


def get_or_create_ceo(db, user_id: int) -> Agent:
    ceo = db.query(Agent).filter_by(user_id=user_id, is_ceo=True).first()
    if ceo:
        return ceo
    provider, model = provider_service.resolve_for_agent(db, Agent(provider_id=None))
    ceo = Agent(
        user_id=user_id, name="Atlas", role="ceo",
        specialty="Coordinación general",
        instructions=("Eres el asistente CEO personal del usuario. Prioriza "
                      "sus objetivos, delega en agentes especializados y "
                      "verifica resultados antes de reportar."),
        is_ceo=True, status="active" if provider else "pending_config",
        provider_id=provider.id if provider else None, model=model,
        autonomy="balanced",
        memory_scope=["profile", "preference", "goal", "project", "fact",
                      "verified_knowledge", "document", "agent",
                      "task_history"],
        tools=["memory_search", "memory_write", "file_read", "file_write",
               "doc_search", "doc_index", "report_result"],
        avatar={"color": "#f7b84f", "style": "stylized", "outfit": "formal",
                "accessories": ["glasses"]},
        voice={"enabled": True, "lang": "es-MX", "rate": 1.0, "pitch": 1.0},
    )
    db.add(ceo)
    db.flush()
    for scope in ("memory_read", "memory_write", "doc_search", "doc_index",
                  "file_read", "file_write", "delegate", "create_agent",
                  "report_result"):
        permission_service.grant(db, ceo.id, scope, "allow",
                                 requires_confirmation=scope in {"create_agent"})
    db.commit()
    return ceo


def _ceo_ctx(db, user_id: int, query: str) -> dict:
    prof = db.query(UserProfile).filter_by(user_id=user_id).first()
    profile_txt = (f"Nombre: {prof.display_name}\nOcupación: {prof.occupation}\n"
                   f"Proyectos/empresas: {prof.companies}\n"
                   f"Resumen de objetivos: {prof.goals_summary}"
                   if prof else "(perfil vacío)")
    goals = db.query(Goal).filter_by(user_id=user_id, status="active").all()
    goals_txt = "\n".join(f"- [{g.horizon}] {g.title}" for g in goals) or "-"
    mems = memory_service.context_for_user(db, user_id, query, limit=10)
    mem_txt = "\n".join(f"- [{m.category}] {m.content[:200]}" for m in mems) or "-"
    agents = db.query(Agent).filter_by(user_id=user_id, is_ceo=False).all()
    roster = "\n".join(f"- {a.name} ({a.role}, {a.status})"
                       for a in agents) or "(sin agentes todavía)"
    return {"profile": profile_txt, "goals": goals_txt,
            "memories": mem_txt, "roster": roster}


def _run_ceo_tool(db, ceo: Agent, user_id: int, call: dict, conv_id: int) -> dict:
    name, args = call.get("tool", ""), call.get("args") or {}
    if name == "recall":
        items = memory_service.search(db, str(args.get("query", "")),
                                      owner_type="user", owner_id=user_id, limit=8)
        return {"results": [{"category": m.category, "content": m.content[:400]}
                            for m in items]}
    if name == "remember":
        m = memory_service.save(db, "user", user_id,
                                str(args.get("category", "fact")),
                                str(args.get("content", "")),
                                str(args.get("kind", "fact")),
                                source="ceo")
        return {"saved": m.id}
    if name == "list_agents":
        agents = db.query(Agent).filter_by(user_id=user_id, is_ceo=False).all()
        return {"agents": [{"name": a.name, "role": a.role, "status": a.status,
                            "id": a.id} for a in agents]}
    if name == "propose_team":
        return agent_service.propose_team(db, user_id,
                                          str(args.get("project", "")))
    if name == "propose_agent":
        return agent_service.propose_agent_config(
            db, user_id, str(args.get("description", "")))
    if name == "delegate_task":
        target = str(args.get("agent_name", "")).lower()
        agent = (db.query(Agent)
                 .filter(Agent.user_id == user_id, Agent.is_ceo == False)  # noqa: E712
                 .all())
        agent = next((a for a in agent if a.name.lower() == target), None)
        if not agent:
            return {"error": f"No existe un agente llamado '{target}'."}
        chk = permission_service.check(db, ceo, "delegate")
        if not chk["allowed"]:
            return {"error": "El CEO no tiene permiso 'delegate'. "
                    "Solicítalo con request_permission."}
        task = Task(project_id=agent.project_id, title=str(args.get("title", ""))[:300],
                    description=str(args.get("description", "")),
                    agent_id=agent.id, status="pending", created_by="ceo",
                    depends_on=args.get("depends_on") or [])
        db.add(task)
        db.commit()
        bus.publish("task", {"id": task.id, "status": task.status,
                             "agent_id": agent.id, "title": task.title})
        log_action(db, "task_delegated", ceo.id, task.id, result="pending")
        return {"task_id": task.id, "assigned_to": agent.name}
    if name == "task_status":
        tasks = (db.query(Task).order_by(Task.id.desc()).limit(15).all())
        return {"tasks": [{"id": t.id, "title": t.title, "status": t.status,
                           "agent_id": t.agent_id} for t in tasks]}
    if name == "request_permission":
        req = permission_service.request_authorization(
            db, ceo, str(args.get("scope", "")), str(args.get("reason", "")),
            risk="high", user_id=user_id)
        notify(db, user_id, "El CEO solicita un permiso",
               f"{args.get('scope')}: {args.get('reason')}",
               level="action_required", link="/approvals",
               event_type="auth_required", dedupe_key=f"ceo-req-{req.id}")
        return {"request_id": req.id, "status": "pending"}
    return {"error": f"Herramienta desconocida: {name}"}


async def handle_user_message(db, user_id: int, conv: Conversation,
                              text: str) -> Message:
    """Full CEO turn: context -> LLM loop with CEO tools -> assistant message."""
    db.add(Message(conversation_id=conv.id, role="user", content=text))
    db.commit()
    ceo = get_or_create_ceo(db, user_id)
    if ceo.status != "active":
        reply = ("Aún no hay un proveedor de IA configurado. Ve a "
                 "'Modelos y conexiones' para conectar Ollama (local) o un "
                 "proveedor en línea y podré responderte de verdad.")
        msg = Message(conversation_id=conv.id, role="assistant", content=reply,
                      meta={"blocked": "no_provider"})
        db.add(msg); db.commit()
        return msg
    provider_row, model = provider_service.resolve_for_agent(db, ceo)
    provider, live = provider_service.live_provider(db, provider_row.id)
    ctx = _ceo_ctx(db, user_id, text)
    sys = CEO_SYSTEM.format(name=ceo.name, **ctx)
    history = [{"role": m.role, "content": m.content}
               for m in db.query(Message)
               .filter_by(conversation_id=conv.id)
               .order_by(Message.id.desc()).limit(12).all()][::-1]
    convo = [{"role": "system", "content": sys}] + history
    meta = {"tool_runs": []}
    for _ in range(6):
        try:
            res = await live.chat(convo, model or provider_row.default_model)
        except Exception as e:  # noqa: BLE001
            reply = (f"No pude contactar al modelo ({provider_row.name}): {e}. "
                     "Revisa la conexión en 'Modelos y conexiones'.")
            msg = Message(conversation_id=conv.id, role="assistant",
                          content=reply, meta={"error": str(e)})
            db.add(msg); db.commit()
            return msg
        record_cost(db, ceo, provider_row, None, res.tokens_in, res.tokens_out)
        call = parse_tool_call(res.text)
        if not call or call.get("tool") not in CEO_TOOLS:
            msg = Message(conversation_id=conv.id, role="assistant",
                          content=res.text, meta=meta)
            db.add(msg); db.commit()
            bus.publish("chat", {"conversation_id": conv.id,
                                 "message_id": msg.id})
            return msg
        out = _run_ceo_tool(db, ceo, user_id, call, conv.id)
        meta["tool_runs"].append({"tool": call.get("tool"),
                                  "ok": "error" not in out})
        if call.get("tool") in {"propose_team", "propose_agent"}:
            meta.setdefault("proposal", out)
        if call.get("tool") == "delegate_task" and "task_id" in out:
            meta.setdefault("delegated_tasks", []).append(out["task_id"])
        convo.append({"role": "assistant", "content": res.text})
        convo.append({"role": "user", "content":
                      f"Resultado de {call.get('tool')}: "
                      f"{json.dumps(out, ensure_ascii=False)[:3000]}"})
    msg = Message(conversation_id=conv.id, role="assistant",
                  content="He encadenado varias acciones internas; dime si "
                          "quieres el resumen de lo que propuse o delegué.",
                  meta=meta)
    db.add(msg); db.commit()
    return msg
