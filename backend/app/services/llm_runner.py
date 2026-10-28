"""Runs the tool-calling loop for one agent: LLM -> optional tool call ->
execute (permission-gated) -> feed result back, until a final answer or the
iteration limit. Records every step as an Execution and meters cost."""
from ..models import Agent, CostRecord, Execution, Task
from ..tools.registry import execute as run_tool, parse_tool_call, tool_specs_for
from . import provider_service, settings_service
from .activity import log_action

AGENT_SYSTEM = (
    "Eres {name}, un agente de IA dentro del sistema AI CEO Workspace.\n"
    "Rol: {role}. Especialidad: {specialty}.\n"
    "Instrucciones:\n{instructions}\n\n"
    "Tienes estas herramientas (úsalas SOLO si las necesitas):\n{tools}\n\n"
    "Para usar una herramienta responde EXACTAMENTE un objeto JSON:\n"
    '{{"tool": "<nombre>", "args": {{...}}}}\n'
    "Cuando tengas la respuesta final para la tarea, responde texto normal "
    "(sin JSON). Sé concreto y verificable. Si una herramienta devuelve que "
    "necesita autorización, explica al usuario que la acción quedó pendiente "
    "de aprobación y da por terminada tu parte."
)


def spend_ok(db, agent: Agent) -> tuple[bool, str]:
    limit = settings_service.get(db, "spend_limit", 0.0)
    if limit and (agent.spent or 0) >= limit:
        return False, "Límite de gasto global alcanzado."
    if agent.budget and (agent.spent or 0) >= agent.budget:
        return False, "Presupuesto del agente agotado."
    return True, ""


def record_cost(db, agent: Agent, provider, task_id, tokens_in, tokens_out):
    cost = round((tokens_in / 1000) * (provider.cost_per_1k_in or 0)
                 + (tokens_out / 1000) * (provider.cost_per_1k_out or 0), 6)
    db.add(CostRecord(agent_id=agent.id, provider_id=provider.id,
                      task_id=task_id, model=provider.default_model,
                      tokens_in=tokens_in, tokens_out=tokens_out,
                      cost_usd=cost, estimated=not provider.is_free))
    agent.spent = round((agent.spent or 0) + cost, 6)
    if task_id:
        t = db.get(Task, task_id)
        if t:
            t.cost_usd = round((t.cost_usd or 0) + cost, 6)
    db.commit()
    return cost


async def run_agent_turn(db, agent: Agent, task: Task | None,
                         messages: list[dict], user_id: int,
                         max_iters: int) -> dict:
    """Returns {text, iterations, awaiting_auth, stopped_reason}."""
    from ..config import MAX_TOOL_ITERATIONS
    max_iters = max_iters or MAX_TOOL_ITERATIONS
    provider_row, model = provider_service.resolve_for_agent(db, agent)
    if not provider_row:
        return {"text": "", "iterations": 0, "awaiting_auth": False,
                "stopped_reason": "no_provider",
                "error": "No hay proveedor de IA habilitado."}
    ok_budget, why = spend_ok(db, agent)
    if not ok_budget:
        return {"text": "", "iterations": 0, "awaiting_auth": False,
                "stopped_reason": "budget", "error": why}
    provider, live = provider_service.live_provider(db, provider_row.id)
    specs = tool_specs_for(agent)
    tools_txt = ("\n".join(f"- {s['name']}: {s['desc']}" for s in specs)
                 or "(sin herramientas)")
    sys = AGENT_SYSTEM.format(
        name=agent.name, role=agent.role or "general",
        specialty=agent.specialty or "-",
        instructions=agent.instructions or "Sigue la tarea indicada.",
        tools=tools_txt)
    convo = [{"role": "system", "content": sys}] + messages
    step = 0
    for it in range(max_iters):
        try:
            res = await live.chat(convo, model or provider_row.default_model)
        except Exception as e:  # noqa: BLE001
            db.add(Execution(task_id=task.id if task else None,
                             agent_id=agent.id, step=step, kind="llm_call",
                             detail={"error": str(e)}, status="error"))
            db.commit()
            return {"text": "", "iterations": it, "awaiting_auth": False,
                    "stopped_reason": "llm_error", "error": str(e)}
        step += 1
        cost = record_cost(db, agent, provider_row,
                           task.id if task else None,
                           res.tokens_in, res.tokens_out)
        db.add(Execution(task_id=task.id if task else None, agent_id=agent.id,
                         step=step, kind="llm_call",
                         detail={"model": res.model,
                                 "preview": res.text[:600]},
                         tokens_in=res.tokens_in, tokens_out=res.tokens_out,
                         cost=cost, status="ok"))
        db.commit()
        call = parse_tool_call(res.text)
        if not call:
            return {"text": res.text, "iterations": it + 1,
                    "awaiting_auth": False, "stopped_reason": "done"}
        spec_names = {s["name"] for s in specs}
        if call.get("tool") not in spec_names:
            convo.append({"role": "assistant", "content": res.text})
            convo.append({"role": "user", "content":
                          "Esa herramienta no está disponible para ti. "
                          "Responde con texto o usa una herramienta habilitada."})
            continue
        out = run_tool(db, agent, task, call, user_id)
        step += 1
        db.add(Execution(task_id=task.id if task else None, agent_id=agent.id,
                         step=step, kind="tool_call",
                         detail={"tool": call.get("tool"),
                                 "args": call.get("args"),
                                 "output_preview": str(out)[:600]},
                         status="ok" if out.get("ok") else "error"))
        db.commit()
        if out.get("awaiting_auth"):
            return {"text": "", "iterations": it + 1, "awaiting_auth": True,
                    "auth_id": out.get("auth_id"),
                    "stopped_reason": "awaiting_authorization"}
        convo.append({"role": "assistant", "content": res.text})
        convo.append({"role": "user", "content":
                      f"Resultado de {call.get('tool')}: {out}"})
    return {"text": "", "iterations": max_iters, "awaiting_auth": False,
            "stopped_reason": "iteration_limit",
            "error": "Límite de iteraciones alcanzado."}
