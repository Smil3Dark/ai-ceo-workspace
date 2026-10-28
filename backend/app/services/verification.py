"""Verification: checks real evidence before a task can be 'completed'.
A task without verifiable output is marked 'pending_verification', never
silently completed."""
from pathlib import Path

from ..config import WORKSPACE_DIR
from ..models import Execution, Task


def verify_task(db, task: Task) -> dict:
    """Returns {verified: bool, detail: str, evidence: list}."""
    ev = task.expected_output or {}
    declared = (task.result or {}).get("declared", {})
    evidence, problems = [], []

    files = ev.get("files") or declared.get("files") or []
    for f in files:
        p = Path(str(f))
        if not p.is_absolute():
            p = WORKSPACE_DIR / f"agent_{task.agent_id}" / str(f)
        if p.exists() and p.stat().st_size > 0:
            evidence.append(f"archivo OK: {p} ({p.stat().st_size} B)")
        else:
            problems.append(f"archivo ausente o vacío: {p}")

    if ev.get("must_contain") and files:
        for f in files:
            p = Path(str(f))
            if not p.is_absolute():
                p = WORKSPACE_DIR / f"agent_{task.agent_id}" / str(f)
            if p.exists():
                txt = p.read_text(encoding="utf-8", errors="replace")
                for needle in ev["must_contain"]:
                    if needle not in txt:
                        problems.append(f"{p.name} no contiene '{needle}'")

    if ev.get("run_test"):
        import subprocess, sys
        try:
            proc = subprocess.run(
                [sys.executable, "-c", str(ev["run_test"])],
                capture_output=True, text=True, timeout=60,
                cwd=str(WORKSPACE_DIR / f"agent_{task.agent_id}"))
            if proc.returncode == 0:
                evidence.append("prueba ejecutada OK")
            else:
                problems.append(f"prueba falló: {proc.stderr[-500:]}")
        except subprocess.TimeoutExpired:
            problems.append("prueba superó el tiempo límite")

    if not ev and not files:
        # nothing verifiable was declared: honest 'pending_verification'
        return {"verified": False, "pending": True,
                "detail": "La tarea no declaró salidas verificables; queda "
                          "pendiente de verificación manual.",
                "evidence": evidence}

    verified = not problems
    detail = ("Verificada: " + "; ".join(evidence) if verified
              else "Problemas: " + "; ".join(problems))
    return {"verified": verified, "pending": False, "detail": detail,
            "evidence": evidence, "problems": problems}


def record_verification(db, task: Task, outcome: dict):
    step = (db.query(Execution).filter_by(task_id=task.id).count()) + 1
    db.add(Execution(task_id=task.id, agent_id=task.agent_id, step=step,
                     kind="verification", detail=outcome,
                     status="ok" if outcome.get("verified") else "error"))
    db.commit()
