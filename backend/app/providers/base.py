"""Provider abstraction. Every model access goes through LLMProvider so the
rest of the system never depends on a specific vendor."""
from dataclasses import dataclass, field
from typing import Any


@dataclass
class ChatResult:
    text: str
    tokens_in: int = 0
    tokens_out: int = 0
    model: str = ""
    raw: dict = field(default_factory=dict)


class LLMProvider:
    kind = "base"

    def __init__(self, base_url: str = "", api_key: str = "", meta: dict | None = None):
        self.base_url = base_url.rstrip("/")
        self.api_key = api_key
        self.meta = meta or {}

    async def chat(self, messages: list[dict], model: str, **kw) -> ChatResult:
        raise NotImplementedError

    async def list_models(self) -> list[str]:
        return []

    async def test(self) -> tuple[bool, str]:
        """Real connectivity check. Returns (ok, human-readable detail)."""
        raise NotImplementedError
