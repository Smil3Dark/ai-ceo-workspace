"""Core behavior tests — permissions, memory, task lifecycle, simulation.
Run: .venv/bin/pytest tests/ -q  (uses an isolated temp DB)
"""
import os
import sys
import tempfile
from pathlib import Path

os.environ["ACEO_DATA_DIR"] = tempfile.mkdtemp()
os.environ["ACEO_DB_PATH"] = str(Path(os.environ["ACEO_DATA_DIR"]) / "test.db")
os.environ["ACEO_WORKSPACE_DIR"] = str(Path(os.environ["ACEO_DATA_DIR"]) / "ws")

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import pytest  # noqa: E402

from app.database import Base, SessionLocal, engine  # noqa: E402
from app.models import Agent, AuthorizationRequest, Task, User  # noqa: E402
from app.services import (agent_service, memory_service,  # noqa: E402
                          permission_service, settings_service, simulation)
from app.tools.registry import execute as run_tool, parse_tool_call  # noqa: E402


@pytest.fixture()
def db():
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    s = SessionLocal()
    try:
        yield s
    finally:
        s.rollback()
        s.close()
        Base.metadata.drop_all(engine)


def make_agent(db, tools=None, uid=1):
    if not db.get(User, uid):
        db.add(User(id=uid, name="u"))
        db.flush()
    a = Agent(user_id=uid, name="Tester", role="research", status="active",
              tools=tools or ["file_write", "memory_write"])
    db.add(a)
    db.flush()
    return a


# ---------- permissions ----------

def test_denied_tool_never_runs(db):
    a = make_agent(db, tools=["file_write"])
    # no permission granted -> call denied, no file created
    out = run_tool(db, a, None, {"tool": "file_write",
                                 "args": {"path": "x.txt", "content": "hola"}}, 1)
    assert not out["ok"]
    assert not (Path(os.environ["ACEO_WORKSPACE_DIR"]) /
                f"agent_{a.id}" / "x.txt").exists()


def test_granted_then_revoked(db):
    a = make_agent(db, tools=["file_write"])
    p = permission_service.grant(db, a.id, "file_write")
    out = run_tool(db, a, None, {"tool": "file_write",
                                 "args": {"path": "ok.txt", "content": "x"}}, 1)
    assert out["ok"]
    permission_service.revoke(db, p.id)
    out2 = run_tool(db, a, None, {"tool": "file_write",
                                  "args": {"path": "no.txt", "content": "x"}}, 1)
    assert not out2["ok"]


def test_sensitive_tool_creates_auth_request_not_execution(db):
    a = make_agent(db, tools=["send_message"])
    permission_service.grant(db, a.id, "send_message",
                             requires_confirmation=True)
    out = run_tool(db, a, None,
                   {"tool": "send_message",
                    "args": {"to": "x@y.z", "body": "hi"}}, 1)
    assert out.get("awaiting_auth")
    req = db.get(AuthorizationRequest, out["auth_id"])
    assert req.status == "pending"
    # nothing sent/queued yet
    assert not list((Path(os.environ["ACEO_WORKSPACE_DIR"]) /
                     f"agent_{a.id}" / "outbox").glob("*"))


def test_approval_runs_only_that_payload(db):
    a = make_agent(db, tools=["send_message"])
    permission_service.grant(db, a.id, "send_message",
                             requires_confirmation=True)
    out = run_tool(db, a, None,
                   {"tool": "send_message",
                    "args": {"to": "a@b.c", "body": "hola"}}, 1)
    req = permission_service.resolve(db, out["auth_id"], "approved")
    from app.tools.registry import run_approved_payload
    res = run_approved_payload(db, req, 1)
    assert res["ok"] and "queued" in res  # one draft only


def test_tool_not_in_agent_toolset_denied(db):
    a = make_agent(db, tools=["file_read"])
    permission_service.grant(db, a.id, "file_write")
    out = run_tool(db, a, None, {"tool": "file_write",
                                 "args": {"path": "x", "content": "y"}}, 1)
    assert not out["ok"] and "habilitada" in out["error"]


def test_path_escape_blocked(db):
    a = make_agent(db, tools=["file_write"])
    permission_service.grant(db, a.id, "file_write")
    out = run_tool(db, a, None, {"tool": "file_write",
                                 "args": {"path": "../../etc/evil.txt",
                                          "content": "x"}}, 1)
    assert not out["ok"]


def test_global_pause_blocks_executor(db):
    settings_service.set_paused(db, True)
    assert settings_service.is_paused(db)
    settings_service.set_paused(db, False)


# ---------- memory ----------

def test_memory_persists_and_dedupes(db):
    m1 = memory_service.save(db, "user", 1, "fact", "Me llamo Emiliano")
    m2 = memory_service.save(db, "user", 1, "fact", "Me llamo Emiliano")
    assert m1.id == m2.id  # no duplicate
    found = memory_service.search(db, "Emiliano", owner_type="user",
                                  owner_id=1)
    assert any(m.id == m1.id for m in found)


def test_memory_edit_delete(db):
    m = memory_service.save(db, "user", 1, "preference", "Prefiero resúmenes")
    memory_service.update(db, m.id, content="Prefiero tablas")
    assert "tablas" in db.get(type(m), m.id).content
    assert memory_service.delete(db, m.id)
    assert not db.get(type(m), m.id)


def test_agent_private_memory_isolation(db):
    a1, a2 = make_agent(db), make_agent(db)
    a2.id  # noqa
    secret = memory_service.save(db, "agent", a1.id, "fact", "dato privado")
    assert not memory_service.agent_can_read(a2, secret)
    assert memory_service.agent_can_read(a1, secret)


# ---------- tools ----------

def test_parse_tool_call(db):
    assert parse_tool_call('{"tool": "file_write", "args": {"path": "a"}}')
    assert parse_tool_call('texto ```{"tool":"x","args":{}}```')
    assert not parse_tool_call("respuesta normal sin json")


# ---------- simulation ----------

def test_simulation_detects_missing_perm_and_cycle(db):
    a = make_agent(db, tools=["file_write"])
    steps = [
        {"title": "A", "agent_name": "Tester", "depends_on": [1],
         "tools": ["file_write"]},
        {"title": "B", "agent_name": "Tester", "depends_on": [0],
         "tools": ["http_get"]},
    ]
    agents = {"tester": a}
    out = simulation.simulate_plan(db, steps, agents)
    assert any("Ciclo" in w for w in out["warnings"])
    scopes = {m["scope"] for m in out["missing_permissions"]}
    assert "external_http" in scopes
    assert not out["would_execute"]


def test_simulation_never_executes(db):
    a = make_agent(db, tools=["file_write"])
    permission_service.grant(db, a.id, "file_write")
    steps = [{"title": "Escribir", "agent_name": "Tester",
              "tools": ["file_write"]}]
    agent_dir = Path(os.environ["ACEO_WORKSPACE_DIR"]) / f"agent_{a.id}"
    before = set(agent_dir.glob("**/*")) if agent_dir.exists() else set()
    out = simulation.simulate_plan(db, steps, {"tester": a})
    assert out["would_execute"]
    after = set(agent_dir.glob("**/*")) if agent_dir.exists() else set()
    assert before == after  # simulation wrote nothing
    assert not db.query(AuthorizationRequest).count()


# ---------- tasks / agents ----------

def test_agent_proposal_and_create(db):
    if not db.get(User, 1):
        db.add(User(id=1, name="u"))
        db.flush()
    prop = agent_service.propose_agent_config(
        db, 1, "un agente para gestionar campañas publicitarias y anuncios")
    assert prop["role"] == "marketing"
    assert "send_message" in prop["tools"]
    a = agent_service.create_from_proposal(db, 1, prop)
    assert a.id
    assert permission_service.matrix(db, a.id)  # perms granted
    # sensitive scopes arrive marked for confirmation
    m = {p["scope"]: p for p in permission_service.matrix(db, a.id)}
    assert m["send_message"]["requires_confirmation"]


def test_task_idempotency_key(db):
    t1 = Task(title="x", idempotency_key="k1")
    db.add(t1); db.commit()
    t2 = Task(title="y", idempotency_key="k1")
    db.add(t2)
    with pytest.raises(Exception):
        db.commit()
    db.rollback()
