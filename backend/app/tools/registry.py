"""Real tools agents can call. Every call is permission-checked by the backend;
denied or confirmation-gated calls never execute."""
import json
import re
from pathlib import Path
from urllib.parse import urlparse

import httpx

from ..config import WORKSPACE_DIR
from ..models import Agent, Task
from ..services import memory_service, permission_service
from ..services.activity import log_action

TOOL_SPECS = [
    {"name": "memory_search", "scope": "memory_read",
     "desc": "Busca en la memoria autorizada. args: {query: str}"},
    {"name": "memory_write", "scope": "memory_write",
     "desc": "Guarda un recuerdo. args: {category, kind, content}"},
    {"name": "file_write", "scope": "file_write",
     "desc": "Escribe un archivo dentro de tu carpeta de trabajo. args: {path, content}"},
    {"name": "file_read", "scope": "file_read",
     "desc": "Lee un archivo de tu carpeta de trabajo o de documentos autorizados. args: {path}"},
    {"name": "doc_search", "scope": "doc_search",
     "desc": "Busca texto dentro de documentos indexados del usuario. args: {query}"},
    {"name": "doc_index", "scope": "doc_index",
     "desc": "Indexa un documento subido por el usuario. args: {document_id}"},
    {"name": "http_get", "scope": "external_http",
     "desc": "Descarga el contenido de una URL (solo GET). args: {url}"},
    {"name": "send_message", "scope": "send_message",
     "desc": "Envía un mensaje/correo a un destinatario. args: {to, subject, body}"},
    {"name": "publish_content", "scope": "publish",
     "desc": "Publica contenido en un canal externo. args: {channel, content}"},
    {"name": "exec_code", "scope": "exec_code",
     "desc": "Ejecuta un script de Python en el entorno aislado del agente. args: {code}"},
    {"name": "report_result", "scope": "report_result",
     "desc": "Declara el resultado final de la tarea. args: {summary, files?}"},
]

SENSITIVE_CONFIRM = {"send_message", "publish_content", "exec_code",
                     "file_write"}  # writes are confirmable per policy


def tool_specs_for(agent: Agent) -> list[dict]:
    allowed = set(agent.tools or [])
    return [t for t in TOOL_SPECS if t["name"] in allowed]


def parse_tool_call(text: str) -> dict | None:
    """Extract a JSON tool call {"tool": name, "args": {...}} from model output."""
    m = re.search(r"\{[^{}]*\"tool\"\s*:", text, re.S)
    if not m:
        # try fenced / nested-args variant
        start = text.find("{")
        while start != -1:
            depth, end = 0, -1
            for i, ch in enumerate(text[start:], start):
                if ch == "{":
                    depth += 1
                elif ch == "}":
                    depth -= 1
                    if depth == 0:
                        end = i
                        break
            if end == -1:
                break
            try:
                obj = json.loads(text[start:end + 1])
                if isinstance(obj, dict) and "tool" in obj:
                    return obj
            except Exception:  # noqa: BLE001
                pass
            start = text.find("{", start + 1)
        return None
    start = text.find("{", m.start())
    depth, end = 0, -1
    for i, ch in enumerate(text[start:], start):
        if ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                end = i
                break
    if end == -1:
        return None
    try:
        obj = json.loads(text[start:end + 1])
        return obj if isinstance(obj, dict) and "tool" in obj else None
    except Exception:  # noqa: BLE001
        return None


def _agent_dir(agent_id: int) -> Path:
    d = WORKSPACE_DIR / f"agent_{agent_id}"
    d.mkdir(parents=True, exist_ok=True)
    return d


def _safe_path(agent_id: int, rel: str) -> Path | None:
    base = _agent_dir(agent_id).resolve()
    p = (base / rel.lstrip("/")).resolve()
    return p if str(p).startswith(str(base)) else None


def _run_tool(db, agent: Agent, task: Task | None, name: str, args: dict) -> dict:
    """Executes the tool. Only called after permission check passes."""
    try:
        if name == "memory_search":
            items = memory_service.search(
                db, str(args.get("query", "")),
                categories=agent.memory_scope or None, limit=8)
            items = [m for m in items if memory_service.agent_can_read(agent, m)]
            return {"ok": True, "results": [
                {"id": m.id, "category": m.category, "content": m.content[:500]}
                for m in items]}
        if name == "memory_write":
            m = memory_service.save(
                db, "agent", agent.id, str(args.get("category", "fact")),
                str(args.get("content", "")), str(args.get("kind", "fact")),
                source=f"agent:{agent.id}")
            return {"ok": True, "memory_id": m.id}
        if name == "file_write":
            p = _safe_path(agent.id, str(args.get("path", "")))
            if not p:
                return {"ok": False, "error": "Ruta fuera del espacio autorizado."}
            p.parent.mkdir(parents=True, exist_ok=True)
            p.write_text(str(args.get("content", "")), encoding="utf-8")
            return {"ok": True, "path": str(p), "bytes": p.stat().st_size}
        if name == "file_read":
            p = _safe_path(agent.id, str(args.get("path", "")))
            if not p or not p.exists():
                return {"ok": False, "error": "Archivo no encontrado o no autorizado."}
            return {"ok": True, "content": p.read_text(encoding="utf-8")[:20000]}
        if name == "doc_search":
            items = memory_service.search(
                db, str(args.get("query", "")), owner_type="user",
                categories=["document"], limit=8)
            return {"ok": True, "results": [
                {"memory_id": m.id, "source": m.source,
                 "fragment": m.content[:600]} for m in items]}
        if name == "doc_index":
            from ..models import Document
            doc = db.get(Document, int(args.get("document_id", 0)))
            if not doc:
                return {"ok": False, "error": "Documento no encontrado."}
            try:
                text = Path(doc.path).read_text(
                    encoding="utf-8", errors="replace")[:50000]
            except Exception as e:  # noqa: BLE001
                return {"ok": False, "error": f"No se pudo leer: {e}"}
            memory_service.save(db, "user", doc.user_id, "document",
                                f"[{doc.name}]\n{text}", "fact",
                                source=f"document:{doc.id}")
            doc.indexed = True
            db.commit()
            return {"ok": True, "indexed": doc.name, "chars": len(text)}
        if name == "http_get":
            url = str(args.get("url", ""))
            host = urlparse(url).hostname or ""
            perm = permission_service._find_perm(db, agent.id, "external_http")
            domains = (perm.constraints or {}).get("domains", []) if perm else []
            if domains and host not in domains and "*" not in domains:
                return {"ok": False,
                        "error": f"Dominio '{host}' no autorizado para este agente."}
            with httpx.Client(timeout=30, follow_redirects=True) as cli:
                r = cli.get(url)
                return {"ok": True, "status": r.status_code,
                        "content": r.text[:20000]}
        if name == "send_message":
            # Real sending needs a configured integration; until one exists the
            # tool records the approved intent as a draft in the workspace.
            d = _agent_dir(agent.id) / "outbox"
            d.mkdir(exist_ok=True)
            n = len(list(d.glob("*.json"))) + 1
            fp = d / f"message_{n}.json"
            fp.write_text(json.dumps(
                {"to": args.get("to"), "subject": args.get("subject"),
                 "body": args.get("body")}, ensure_ascii=False, indent=2))
            return {"ok": True, "queued": str(fp),
                    "note": "Guardado como borrador en outbox (no hay canal de envío configurado)."}
        if name == "publish_content":
            d = _agent_dir(agent.id) / "published"
            d.mkdir(exist_ok=True)
            n = len(list(d.glob("*.txt"))) + 1
            fp = d / f"post_{n}.txt"
            fp.write_text(f"[{args.get('channel')}]\n{args.get('content')}")
            return {"ok": True, "published_as": str(fp),
                    "note": "Registrado localmente; conecta un canal real para publicar fuera."}
        if name == "exec_code":
            import subprocess, sys, tempfile
            code = str(args.get("code", ""))
            with tempfile.NamedTemporaryFile(
                    "w", suffix=".py", dir=_agent_dir(agent.id),
                    delete=False) as f:
                f.write(code)
                path = f.name
            try:
                proc = subprocess.run(
                    [sys.executable, path], capture_output=True, text=True,
                    timeout=30, cwd=_agent_dir(agent.id))
                return {"ok": proc.returncode == 0,
                        "stdout": proc.stdout[-8000:],
                        "stderr": proc.stderr[-4000:],
                        "returncode": proc.returncode}
            except subprocess.TimeoutExpired:
                return {"ok": False, "error": "Tiempo de ejecución agotado (30s)."}
        if name == "report_result":
            if task:
                res = task.result or {}
                res["declared"] = {"summary": args.get("summary", ""),
                                   "files": args.get("files", [])}
                task.result = res
                db.commit()
            return {"ok": True}
        return {"ok": False, "error": f"Herramienta desconocida: {name}"}
    except Exception as e:  # noqa: BLE001
        return {"ok": False, "error": f"{type(e).__name__}: {e}"}


def execute(db, agent: Agent, task: Task | None, call: dict,
            user_id: int) -> dict:
    """Gate + run. Returns {ok, output|error, awaiting_auth}."""
    name = str(call.get("tool", ""))
    args = call.get("args") or {}
    spec = next((t for t in TOOL_SPECS if t["name"] == name), None)
    if not spec:
        return {"ok": False, "error": f"Herramienta desconocida: {name}"}
    if name not in (agent.tools or []):
        log_action(db, f"tool_denied:{name}", agent.id,
                   task.id if task else None, tool=name, result="denied")
        return {"ok": False,
                "error": f"La herramienta '{name}' no está habilitada para este agente."}
    scope = spec["scope"]
    chk = permission_service.check(db, agent, scope, args)
    if chk["needs_confirmation"] or (name in SENSITIVE_CONFIRM and chk["allowed"] is False):
        req = permission_service.request_authorization(
            db, agent, name, chk["reason"], task_id=task.id if task else None,
            resources=args, payload={"tool": name, "args": args},
            risk="high" if scope in permission_service.SENSITIVE_SCOPES else "medium")
        log_action(db, f"auth_requested:{name}", agent.id,
                   task.id if task else None, tool=name,
                   result="awaiting_authorization", auth_id=req.id)
        return {"ok": False, "awaiting_auth": True, "auth_id": req.id,
                "error": chk["reason"]}
    if not chk["allowed"]:
        log_action(db, f"tool_denied:{name}", agent.id,
                   task.id if task else None, tool=name, result="denied")
        return {"ok": False, "error": chk["reason"]}
    out = _run_tool(db, agent, task, name, args)
    log_action(db, f"tool:{name}", agent.id, task.id if task else None,
               tool=name, result="ok" if out.get("ok") else "error",
               permissions=[scope], error=out.get("error", ""))
    return out


def run_approved_payload(db, req, user_id: int) -> dict:
    """After a human approves, execute the frozen payload for that request only."""
    agent = db.get(Agent, req.agent_id)
    if not agent:
        return {"ok": False, "error": "Agente inexistente."}
    payload = req.payload or {}
    name, args = payload.get("tool", ""), payload.get("args") or {}
    task = db.get(Task, req.task_id) if req.task_id else None
    out = _run_tool(db, agent, task, name, args)
    log_action(db, f"tool:{name}", agent.id if agent else None,
               req.task_id, tool=name,
               result="ok" if out.get("ok") else "error",
               permissions=[payload.get("scope", "")], auth_id=req.id,
               error=out.get("error", ""))
    return out
