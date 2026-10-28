"""Builds a live LLMProvider from a Provider DB row."""
from ..models import Provider
from .base import LLMProvider
from .ollama import OllamaProvider
from .openai_compat import OpenAICompatProvider

_KINDS = {"ollama": OllamaProvider, "openai_compat": OpenAICompatProvider}


def build_provider(row: Provider, api_key: str = "") -> LLMProvider:
    cls = _KINDS.get(row.kind)
    if not cls:
        raise ValueError(f"Tipo de proveedor desconocido: {row.kind}")
    return cls(base_url=row.base_url, api_key=api_key, meta=row.meta or {})
