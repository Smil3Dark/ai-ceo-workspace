# Mantenimiento

## Actualizar código

```bash
git pull
cd backend && .venv/bin/pip install -r requirements.txt   # si cambian deps
cd ../frontend && npm install && npm run build            # si cambia UI
npx cap sync android                                      # si cambia la web → APK
```

## Registro y salud

- `/api/health` — vivo.
- `/api/system/status` — ajustes + contadores.
- **Historial** en la app — `activity_log` (acción, agente, tarea, tool,
  resultado, coste). Nunca contiene claves.

## Modelos

Actualiza Ollama con `ollama pull <modelo>:<nueva>` y cambia el `model` del
proveedor en **Modelos y conexiones** (o por agente).

## Limpieza

- `data/backups/` crece con cada copia manual: borra las antiguas.
- `data/workspace/agent_<id>/outbox/` acumula borradores.
- Tareas antiguas: no hay borrado masivo; cancela las que ya no importen.
