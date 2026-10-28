"""OpenAI-compatible provider. Works with OpenAI, Groq, OpenRouter, Together,
LM Studio and any service exposing /v1/chat/completions."""
import httpx

from .base import ChatResult, LLMProvider


class OpenAICompatProvider(LLMProvider):
    kind = "openai_compat"

    def _headers(self):
        h = {"Content-Type": "application/json"}
        if self.api_key:
            h["Authorization"] = f"Bearer {self.api_key}"
        return h

    async def chat(self, messages: list[dict], model: str, **kw) -> ChatResult:
        payload = {"model": model, "messages": messages,
                   "temperature": kw.get("temperature", 0.4)}
        async with httpx.AsyncClient(timeout=180) as cli:
            r = await cli.post(f"{self.base_url}/v1/chat/completions",
                               json=payload, headers=self._headers())
            r.raise_for_status()
            data = r.json()
        choice = (data.get("choices") or [{}])[0]
        usage = data.get("usage", {})
        return ChatResult(
            text=choice.get("message", {}).get("content", ""),
            tokens_in=usage.get("prompt_tokens", 0),
            tokens_out=usage.get("completion_tokens", 0),
            model=data.get("model", model), raw=data,
        )

    async def list_models(self) -> list[str]:
        async with httpx.AsyncClient(timeout=20) as cli:
            r = await cli.get(f"{self.base_url}/v1/models", headers=self._headers())
            r.raise_for_status()
            return [m["id"] for m in r.json().get("data", [])]

    async def test(self) -> tuple[bool, str]:
        if not self.base_url:
            return False, "Falta la URL base del proveedor."
        try:
            models = await self.list_models()
            return True, f"Conectado. {len(models)} modelos disponibles."
        except httpx.HTTPStatusError as e:
            code = e.response.status_code
            if code in (401, 403):
                return False, "Autenticación rechazada. Revisa la API key."
            return False, f"El proveedor respondió HTTP {code}."
        except httpx.ConnectError:
            return False, f"No se puede conectar con {self.base_url}."
        except Exception as e:  # noqa: BLE001
            return False, f"Error al comprobar el proveedor: {e}"
