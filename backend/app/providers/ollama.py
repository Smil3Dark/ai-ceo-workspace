import httpx

from .base import ChatResult, LLMProvider


class OllamaProvider(LLMProvider):
    kind = "ollama"

    def __init__(self, base_url: str = "http://localhost:11434", **kw):
        super().__init__(base_url or "http://localhost:11434", "", kw.get("meta"))

    async def chat(self, messages: list[dict], model: str, **kw) -> ChatResult:
        payload = {"model": model, "messages": messages, "stream": False,
                   "options": {"temperature": kw.get("temperature", 0.4)}}
        async with httpx.AsyncClient(timeout=180) as cli:
            r = await cli.post(f"{self.base_url}/api/chat", json=payload)
            r.raise_for_status()
            data = r.json()
        usage = data.get("prompt_eval_count", 0), data.get("eval_count", 0)
        return ChatResult(
            text=data.get("message", {}).get("content", ""),
            tokens_in=usage[0], tokens_out=usage[1],
            model=data.get("model", model), raw=data,
        )

    async def list_models(self) -> list[str]:
        async with httpx.AsyncClient(timeout=15) as cli:
            r = await cli.get(f"{self.base_url}/api/tags")
            r.raise_for_status()
            return [m["name"] for m in r.json().get("models", [])]

    async def test(self) -> tuple[bool, str]:
        try:
            models = await self.list_models()
            if not models:
                return True, ("Ollama responde pero no hay modelos instalados. "
                              "Instala uno con: ollama pull qwen2.5:0.5b")
            return True, f"Conectado. Modelos disponibles: {', '.join(models[:8])}"
        except httpx.ConnectError:
            return False, ("No se puede conectar con Ollama en "
                           f"{self.base_url}. ¿Está instalado y en ejecución? "
                           "Instálalo desde https://ollama.com y ejecútalo con 'ollama serve'.")
        except Exception as e:  # noqa: BLE001 - surface real error to the user
            return False, f"Error al comprobar Ollama: {e}"
