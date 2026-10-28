"""AI CEO Workspace - FastAPI entrypoint.

Serves the REST API, the realtime WebSocket and (in production) the built
frontend. Run: uvicorn app.main:app --host 0.0.0.0 --port 8000
"""
import asyncio
import json
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from starlette.exceptions import HTTPException as StarletteHTTPException

from .api import agents, chat, memory, misc, onboarding, permissions, \
    projects, providers, tasks
from .config import BASE_DIR
from .database import Base, SessionLocal, engine
from .models import User
from .services import conversation, executor, settings_service
from .services.events import bus


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(engine)
    db = SessionLocal()
    try:
        user = db.query(User).first()
        if not user:
            from .config import DEFAULT_USER_NAME
            user = User(name=DEFAULT_USER_NAME)
            db.add(user); db.commit()
        recovered = executor.recover_incomplete(db)
        if settings_service.get(db, "onboarding_done"):
            conversation.get_or_create_ceo(db, user.id)
        executor.start(user.id)
        if recovered:
            from .services.activity import notify
            notify(db, user.id, "Estado recuperado",
                   f"{recovered} tarea(s) quedaron incompletas y vuelven a "
                   "pendientes.", level="warning")
    finally:
        db.close()
    yield
    executor.stop()


app = FastAPI(title="AI CEO Workspace", version="0.1.0", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"],
                   allow_headers=["*"])

for r in (onboarding.router, chat.router, agents.router, providers.router,
          permissions.router, memory.router, projects.router, tasks.router,
          misc.router):
    app.include_router(r)


@app.websocket("/ws")
async def ws(websocket: WebSocket):
    await websocket.accept()
    q = bus.subscribe()
    try:
        await websocket.send_text(json.dumps({"type": "hello"}))
        while True:
            msg = await q.get()
            await websocket.send_text(msg)
    except WebSocketDisconnect:
        pass
    finally:
        bus.unsubscribe(q)


@app.get("/api/health")
def health():
    return {"ok": True}


# Serve the built frontend when present (frontend/dist). The SPA fallback
# returns index.html for unknown paths so client-side routes survive refresh.
class SPAStaticFiles(StaticFiles):
    async def get_response(self, path: str, scope):
        try:
            return await super().get_response(path, scope)
        except StarletteHTTPException as exc:
            if exc.status_code == 404 and not scope["path"].startswith(
                    ("/api/", "/ws")):
                return await super().get_response("index.html", scope)
            raise


_dist = BASE_DIR / "frontend" / "dist"
if _dist.exists():
    app.mount("/", SPAStaticFiles(directory=_dist, html=True), name="frontend")
