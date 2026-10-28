# Pruebas ejecutadas

## Backend — `backend/tests/test_core.py` (pytest)

Resultado: **15/15 en verde** (`.venv/bin/python -m pytest tests/ -q`).

| Área | Test |
|---|---|
| Permisos | Herramienta denegada no se ejecuta (no crea ficheros); revocar deja de funcionar |
| Confirmación | Herramienta sensible solo crea `AuthorizationRequest`; aprobar ejecuta el payload congelado exacto |
| Herramientas | Tool no asignada al agente → denegado; escape de ruta (`../`) bloqueado |
| Pausa | Flag de pausa global se persiste |
| Memoria | Dedupe, edición, borrado, aislamiento de recuerdos privados entre agentes |
| Protocolo | `parse_tool_call` extrae JSON de texto arbitrario |
| Simulación | Detecta ciclos y permisos que faltan; nunca crea ficheros |
| Propuestas | Propuesta → creación concede permisos sensibles con confirmación obligatoria |
| Tareas | `idempotency_key` impide duplicar tareas |

## Verificación E2E (manual, con Ollama real)

- POST `/api/providers/{id}/test` → conexión real a Ollama OK.
- Chat con el CEO → respuesta real del modelo `qwen2.5:0.5b`.
- Agente #2 creado desde propuesta → tarea #1 ejecutada
  (llm → `file_write` → llm → verificación) → escribió
  `data/workspace/agent_2/tendencias.txt` → estado `completed`
  (verificación con evidencia de fichero, no solo declaración del agente).
- Frontend compilado (`vite build`) y servido por el backend en `:8000`.
- APK Android generada con `./gradlew assembleDebug` → `release/ai-ceo-workspace.apk`.
