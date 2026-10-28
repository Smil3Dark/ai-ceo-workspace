"""Provider CRUD, connectivity tests and model resolution honoring the global
AI mode (local | online | hybrid) with per-agent exceptions."""
from datetime import datetime

from ..models import Agent, Provider
from ..providers.registry import build_provider
from . import secrets_service, settings_service


def create(db, name: str, kind: str, base_url: str = "",
           default_model: str = "", api_key: str = "",
           is_free: bool = True, cost_per_1k_in: float = 0.0,
           cost_per_1k_out: float = 0.0, meta=None) -> Provider:
    p = Provider(name=name, kind=kind, base_url=base_url,
                 default_model=default_model, is_free=is_free,
                 cost_per_1k_in=cost_per_1k_in, cost_per_1k_out=cost_per_1k_out,
                 meta=meta or {})
    db.add(p)
    db.flush()
    if api_key:
        sec_name = f"provider_{p.id}_key"
        secrets_service.store_secret(db, sec_name, api_key)
        p.secret_name = sec_name
    db.commit()
    return p


def update(db, provider_id: int, **fields) -> Provider | None:
    p = db.get(Provider, provider_id)
    if not p:
        return None
    api_key = fields.pop("api_key", None)
    for k, v in fields.items():
        if hasattr(p, k):
            setattr(p, k, v)
    if api_key:
        sec_name = f"provider_{p.id}_key"
        secrets_service.store_secret(db, sec_name, api_key)
        p.secret_name = sec_name
    db.commit()
    return p


def delete(db, provider_id: int) -> bool:
    p = db.get(Provider, provider_id)
    if not p:
        return False
    if p.secret_name:
        secrets_service.delete_secret(db, p.secret_name)
    db.delete(p)
    db.commit()
    return True


async def test_provider(db, provider_id: int) -> tuple[bool, str]:
    p = db.get(Provider, provider_id)
    if not p:
        return False, "Proveedor no encontrado."
    key = secrets_service.read_secret(db, p.secret_name) if p.secret_name else ""
    try:
        ok, detail = await build_provider(p, api_key=key).test()
    except Exception as e:  # noqa: BLE001
        ok, detail = False, str(e)
    p.last_test_at, p.last_test_ok, p.last_test_detail = (
        datetime.utcnow(), ok, detail[:400])
    db.commit()
    return ok, detail


async def list_models(db, provider_id: int) -> list[str]:
    p = db.get(Provider, provider_id)
    if not p:
        return []
    key = secrets_service.read_secret(db, p.secret_name) if p.secret_name else ""
    try:
        return await build_provider(p, api_key=key).list_models()
    except Exception:  # noqa: BLE001
        return []


def live_provider(db, provider_id: int):
    p = db.get(Provider, provider_id)
    if not p:
        return None, None
    key = secrets_service.read_secret(db, p.secret_name) if p.secret_name else ""
    return p, build_provider(p, api_key=key)


def _kind_matches_mode(provider: Provider, mode: str) -> bool:
    local = provider.kind == "ollama"
    return {"local": local, "online": not local,
            "hybrid": True}.get(mode, True)


def resolve_for_agent(db, agent: Agent) -> tuple[Provider | None, str]:
    """Pick the provider+model an agent should use right now."""
    mode = settings_service.get(db, "ai_mode", "local")
    if agent.provider_id:
        p = db.get(Provider, agent.provider_id)
        if p and p.enabled:
            return p, agent.model or p.default_model
    q = db.query(Provider).filter_by(enabled=True)
    providers = [p for p in q.all() if _kind_matches_mode(p, mode)]
    if not providers:
        providers = q.all()  # last resort: anything enabled
    if not providers:
        return None, ""
    # prefer free providers, then by id
    providers.sort(key=lambda p: (not p.is_free, p.id))
    p = providers[0]
    return p, agent.model or p.default_model
