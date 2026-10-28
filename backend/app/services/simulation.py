"""Simulation mode: analyses a plan without executing anything real.
Pure logic over DB state + heuristics; never calls tools or external APIs."""
from ..models import Agent, Task
from . import permission_service, settings_service


def _detect_cycle(edges: dict[int, list[int]]) -> list[int] | None:
    visiting, done, stack = set(), set(), []

    def dfs(n):
        visiting.add(n); stack.append(n)
        for m in edges.get(n, []):
            if m in visiting:
                return stack[stack.index(m):] + [m]
            if m not in done and dfs(m):
                return True
        visiting.discard(n); done.add(n); stack.pop()
        return None

    for n in edges:
        if n not in done:
            c = dfs(n)
            if c:
                return c
    return None


def simulate_plan(db, steps: list[dict], agents_by_name: dict[str, Agent],
                  use_real_llm: bool = False) -> dict:
    """steps: [{title, agent_name?, depends_on:[indexes], tools:[names]}]"""
    warnings, missing_perms, plan = [], [], []
    edges = {}
    for i, s in enumerate(steps):
        agent = agents_by_name.get((s.get("agent_name") or "").lower())
        deps = [int(d) for d in (s.get("depends_on") or [])]
        for d in deps:
            if d >= len(steps) or d < 0:
                warnings.append(f"Paso {i + 1}: dependencia inválida ({d}).")
        edges[i] = deps
        step = {"index": i, "title": s.get("title", f"Paso {i + 1}"),
                "agent": agent.name if agent else None,
                "depends_on": deps, "status": "simulado"}
        if not agent:
            warnings.append(f"Paso {i + 1}: sin agente válido "
                            f"('{s.get('agent_name')}').")
        elif agent.status != "active":
            warnings.append(f"Paso {i + 1}: agente '{agent.name}' está "
                            f"{agent.status}.")
        if agent:
            for tool in s.get("tools", []):
                from ..tools.registry import TOOL_SPECS
                spec = next((t for t in TOOL_SPECS if t["name"] == tool), None)
                scope = spec["scope"] if spec else tool
                chk = permission_service.check(db, agent, scope)
                if not chk["allowed"]:
                    missing_perms.append({
                        "step": i, "agent": agent.name, "tool": tool,
                        "scope": scope,
                        "needs_confirmation": chk["needs_confirmation"],
                        "reason": chk["reason"]})
        plan.append(step)
    cycle = _detect_cycle(edges)
    if cycle:
        warnings.append(f"Ciclo de dependencias detectado en pasos {cycle}.")
    # rough estimate: ~600 tokens in / ~300 out per LLM step
    est_tokens_in, est_tokens_out = 600 * len(steps), 300 * len(steps)
    spend_limit = settings_service.get(db, "spend_limit", 0.0)
    return {
        "mode": "simulation",
        "used_real_llm": use_real_llm,
        "steps": plan,
        "missing_permissions": missing_perms,
        "warnings": warnings,
        "estimated_tokens": {"in": est_tokens_in, "out": est_tokens_out},
        "cost_note": ("El coste exacto depende del proveedor; "
                      "usa los precios configurados en cada proveedor."),
        "spend_limit": spend_limit,
        "would_execute": (not cycle and not missing_perms
                          and all(s["agent"] for s in plan)),
    }


def simulate_existing_tasks(db, task_ids: list[int]) -> dict:
    tasks = [db.get(Task, t) for t in task_ids]
    tasks = [t for t in tasks if t]
    steps = [{"title": t.title,
              "agent_name": (db.get(Agent, t.agent_id).name
                             if t.agent_id and db.get(Agent, t.agent_id) else None),
              "depends_on": [i for i, x in enumerate(tasks)
                             if x.id in (t.depends_on or [])],
              "tools": t.input.get("tools", [])} for t in tasks]
    agents = {a.name.lower(): a for a in db.query(Agent).all()}
    return simulate_plan(db, steps, agents)
