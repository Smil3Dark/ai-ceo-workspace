# Base de datos

- Motor: **SQLite** (desarrollo), un único fichero en `DB_PATH`
  (por defecto `data/app.db`).
- ORM: SQLAlchemy 2. Las tablas se crean en el arranque (`create_all`).
- Foreign keys activadas con `PRAGMA foreign_keys=ON` en cada conexión.
- Migraciones: no hay sistema de migraciones todavía; en desarrollo puedes
  borrar `data/app.db` y reiniciar (perderás el estado).

## Tablas

`users`, `user_profiles` (datos del usuario), `goals`, `projects`, `teams`,
`agents` (is_ceo, estado, provider, modelo, autonomía, presupuesto/gasto,
avatar, voz, memory_scope, tools, constraints, config pendiente),
`providers` (tipo, URL, modelo, clave cifrada, coste/1k tokens, test),
`secrets` (valor cifrado Fernet), `permissions` (alcance+decisión+confirmación),
`authorization_requests` (payload congelado + riesgo + estado),
`tasks` (estado, dependencias, expected_output, resultado, intentos,
`idempotency_key` única), `executions` (pasos: llm_call/tool_call/
verification/system, tokens, coste), `memory` (propietario, categoría,
tipo, verificado), `documents`, `notifications` (dedupe), `cost_records`,
`office_config` (escenario, disposición, iluminación, ciclo, posiciones),
`conversations`, `messages`, `activity_log`, `settings`, `pause_state`.

## Datos fuera de la BD

- `data/workspace/agent_<id>/` — ficheros de cada agente (sandbox: las
  herramientas de archivos no pueden salir de ahí).
- `data/uploads/` — documentos subidos por el usuario.
- `data/backups/` — copias de `app.db`.
- `data/.secret_key` — clave Fernet para descifrar `secrets`/provider keys.
