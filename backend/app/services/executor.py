"""Persistent task executor. Picks 'pending' tasks whose dependencies are met,
runs the assigned agent, verifies output, retries with limits, and recovers
incomplete state after restart (tasks left 'running' go back to 'pending'
unless they were external-side-effect operations)."""
import asyncio
from datetime import datetime

from ..config import EXECUTOR_POLL_SECONDS, MAX_TASK_ATTEMPTS
from ..database import SessionLocal
from ..models import Agent, Task
from . import settings_service, verification
from .activity import log_action, notify
from .events import bus
from .llm_runner import run_agent_turn

TERMINAL = {"completed", "failed", "cancelled"}
_runner_task: asyncio.Task | None = None
_stop = asyncio.Event()


def _publish(task: Task):
    bus.publish("task", {"id": task.id, "status": task.status,
                         "agent_id": task.agent_id, "title": task.title})


def deps_met(db, task: Task) -> bool:
    for dep_id in (task.depends_on or []):
        dep = db.get(Task, dep_id)
        if not dep or dep.status != "completed":
            return False
    return True


def recover_incomplete(db):
    """On boot: running/verifying tasks are resumable, not silently redone."""
    stuck = db.query(Task).filter(Task.status.in_(["running", "verifying"]))
    n = 0
    for t in stuck:
        t.status = "pending"
        t.error = (t.error or "") + " [recuperada tras reinicio]"
        n += 1
    db.commit()
    return n


async def run_task(db, task: Task, user_id: int):
    agent = db.get(Agent, task.agent_id) if task.agent_id else None
    if not agent:
        task.status, task.error = "failed", "Sin agente asignado."
        task.finished_at = datetime.utcnow()
        db.commit(); _publish(task)
        return
    if agent.status != "active":
        task.status = "blocked"
        task.error = f"Agente '{agent.name}' no está activo ({agent.status})."
        db.commit(); _publish(task)
        return
    task.status = "running"
    task.started_at = datetime.utcnow()
    task.attempts = (task.attempts or 0) + 1
    db.commit(); _publish(task)
    log_action(db, "task_started", agent.id, task.id, result="running")

    msgs = [{"role": "user", "content":
             f"Tarea: {task.title}\n\n{task.description}\n\n"
             f"Contexto adicional: {task.input or {}}"}]
    outcome = await run_agent_turn(db, agent, task, msgs, user_id,
                                   agent.constraints.get("max_iters") if agent.constraints else 0)
    if outcome.get("awaiting_auth"):
        task.status = "awaiting_authorization"
        db.commit(); _publish(task)
        notify(db, user_id, "Confirmación pendiente",
               f"{agent.name} solicita autorización para '{task.title}'.",
               level="action_required", link="/approvals",
               event_type="auth_required",
               dedupe_key=f"auth-{task.id}-{task.attempts}")
        return
    if outcome.get("stopped_reason") in {"no_provider", "budget", "llm_error"}:
        if task.attempts < (task.max_attempts or MAX_TASK_ATTEMPTS):
            task.status = "pending"
            task.error = outcome.get("error", "")
        else:
            task.status = "failed"
            task.error = outcome.get("error", "error desconocido")
            task.finished_at = datetime.utcnow()
            notify(db, user_id, "Tarea fallida",
                   f"'{task.title}' falló tras {task.attempts} intentos: "
                   f"{task.error}", level="error",
                   event_type="task_failed", dedupe_key=f"fail-{task.id}")
        db.commit(); _publish(task)
        return
    task.result = {**(task.result or {}), "answer": outcome.get("text", "")}
    task.status = "verifying"
    db.commit(); _publish(task)
    check = verification.verify_task(db, task)
    verification.record_verification(db, task, check)
    if check.get("verified"):
        task.status = "completed"
        task.finished_at = datetime.utcnow()
        notify(db, user_id, "Tarea completada",
               f"'{task.title}' terminó y su resultado fue verificado.",
               link="/tasks", event_type="task_done")
    elif check.get("pending"):
        task.status = "completed"  # done but flagged
        task.result["verification"] = "pendiente de verificación manual"
        task.finished_at = datetime.utcnow()
        notify(db, user_id, "Tarea completada (sin verificar)",
               f"'{task.title}' terminó pero no hay evidencia verificable.",
               link="/tasks", level="warning", event_type="task_done")
    else:
        if task.attempts < (task.max_attempts or MAX_TASK_ATTEMPTS):
            task.status = "pending"
            task.error = check["detail"]
        else:
            task.status = "failed"
            task.error = check["detail"]
            task.finished_at = datetime.utcnow()
            notify(db, user_id, "Verificación fallida",
                   f"'{task.title}': {check['detail']}", level="error",
                   event_type="task_failed", dedupe_key=f"vfail-{task.id}")
    db.commit(); _publish(task)
    log_action(db, "task_finished", agent.id, task.id, result=task.status,
               cost=task.cost_usd)


async def _loop(user_id: int):
    while not _stop.is_set():
        db = SessionLocal()
        try:
            if not settings_service.is_paused(db):
                q = (db.query(Task)
                     .filter(Task.status.in_(["pending", "planned"]))
                     .order_by(Task.priority.desc(), Task.id))
                for task in q.all():
                    if not deps_met(db, task):
                        continue
                    await run_task(db, task, user_id)
                    break  # one at a time keeps ordering predictable
        except Exception as e:  # noqa: BLE001 - keep the loop alive
            log_action(db, "executor_error", result="error", error=str(e))
        finally:
            db.close()
        try:
            await asyncio.wait_for(_stop.wait(), EXECUTOR_POLL_SECONDS)
        except asyncio.TimeoutError:
            pass


def start(user_id: int):
    global _runner_task
    if _runner_task and not _runner_task.done():
        return
    _stop.clear()
    _runner_task = asyncio.create_task(_loop(user_id))


def stop():
    _stop.set()
