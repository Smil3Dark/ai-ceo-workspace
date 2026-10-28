# Cambiar de modo: local / en línea / híbrido

**Modelos y conexiones → Modalidad de IA**: `local`, `online`, `hybrid`.

- `local` — solo proveedores Ollama.
- `online` — solo proveedores OpenAI-compatible.
- `hybrid` — se prefieren los gratuitos; puedes usar ambos tipos.

## Qué se conserva al cambiar

Todo: agentes, sus configuraciones, memoria, permisos, tareas, conversaciones
y documentos. Solo cambia **qué proveedor se elige** al ejecutar.

## Cómo se resuelve el proveedor en cada llamada

`provider_service.resolve_for_agent`:

1. Si el agente tiene `provider_id` propio y el tipo encaja con el modo → ese.
   (Excepción por agente: puedes tener a un agente fijado a Ollama mientras el
   modo global es online, siempre que el tipo sea válido para el modo.)
2. Si no, el primer proveedor **habilitado** del tipo correcto, prefiriendo
   los gratuitos (`is_free`) y el `default_model`.
3. Si no hay ninguno, el agente queda "pendiente de configuración" con la
   razón visible en su ficha — no falla en silencio.

Al cambiar de modo, la API devuelve `agents_outside_mode`: los agentes cuyo
proveedor fijado ya no es válido en el nuevo modo, para que decidas si
les asignas otro.

## Privacidad en modo híbrido

En **Ajustes → Privacidad** puedes prohibir que la información marcada como
privada salga a proveedores externos (`send_private_to_external`).
