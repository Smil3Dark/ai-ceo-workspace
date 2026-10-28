from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Agent, Provider
from ..schemas import ProviderIn
from ..services import provider_service, settings_service
from .deps import user_id

router = APIRouter(prefix="/api/providers", tags=["providers"])


def serialize(p: Provider) -> dict:
    d = {c.name: getattr(p, c.name) for c in p.__table__.columns}
    d["has_key"] = bool(p.secret_name)
    d["api_key"] = ""  # never expose stored secrets
    return d


@router.get("")
def list_providers(db: Session = Depends(get_db)):
    return [serialize(p) for p in db.query(Provider).all()]


@router.post("")
def create(payload: ProviderIn, db: Session = Depends(get_db)):
    p = provider_service.create(db, **payload.model_dump())
    return serialize(p)


# Static paths MUST be registered before /{pid} or FastAPI tries to parse
# "mode"/"catalog" as an int and returns 422.
@router.get("/mode")
def get_mode(db: Session = Depends(get_db)):
    return {"ai_mode": settings_service.get(db, "ai_mode", "local")}


@router.put("/mode")
def set_mode(payload: dict, db: Session = Depends(get_db)):
    mode = payload.get("ai_mode", "local")
    if mode not in ("local", "online", "hybrid"):
        raise HTTPException(400, "Modo inválido")
    old = settings_service.get(db, "ai_mode", "local")
    # keep previous config (agents/providers untouched) per spec 8.4
    settings_service.set_value(db, "ai_mode", mode)
    incompatible = []
    for a in db.query(Agent).filter(Agent.provider_id.isnot(None)).all():
        p = db.get(Provider, a.provider_id)
        if p and not provider_service._kind_matches_mode(p, mode):
            incompatible.append({"agent": a.name, "provider": p.name})
    return {"ok": True, "previous": old, "current": mode,
            "agents_outside_mode": incompatible}


@router.get("/catalog")
def catalog():
    """Static catalog of supported provider types (real, no invented vendors)."""
    return {"providers": [
        {"kind": "ollama", "name": "Ollama (local)",
         "desc": "Ejecuta modelos en esta computadora. Gratis y privado; "
                 "requiere instalar Ollama y descargar un modelo.",
         "default_url": "http://localhost:11434", "free": True},
        {"kind": "openai_compat", "name": "API compatible con OpenAI",
         "desc": "Cualquier servicio con /v1/chat/completions: OpenAI, Groq, "
                 "OpenRouter, LM Studio… Requiere URL y normalmente una API key.",
         "default_url": "https://api.openai.com", "free": False},
    ]}


@router.put("/{pid}")
def update(pid: int, payload: dict, db: Session = Depends(get_db)):
    p = provider_service.update(db, pid, **payload)
    if not p:
        raise HTTPException(404)
    return serialize(p)


@router.delete("/{pid}")
def delete(pid: int, db: Session = Depends(get_db)):
    if not provider_service.delete(db, pid):
        raise HTTPException(404)
    return {"ok": True}


@router.post("/{pid}/test")
async def test(pid: int, db: Session = Depends(get_db)):
    ok, detail = await provider_service.test_provider(db, pid)
    return {"ok": ok, "detail": detail}


@router.get("/{pid}/models")
async def models(pid: int, db: Session = Depends(get_db)):
    return {"models": await provider_service.list_models(db, pid)}
