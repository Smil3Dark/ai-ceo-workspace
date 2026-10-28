# Estructura del proyecto

```
ai-ceo-workspace/
├── backend/
│   ├── app/
│   │   ├── main.py            # FastAPI: lifespan, CORS, WS /ws, monta frontend/dist
│   │   ├── config.py          # Rutas de datos y límites (env-overridable)
│   │   ├── database.py        # Engine SQLite + SessionLocal + get_db
│   │   ├── models.py          # Tablas SQLAlchemy (todas)
│   │   ├── schemas.py         # Pydantic In-models
│   │   ├── providers/         # LLMProvider: base, ollama, openai_compat, registry
│   │   ├── tools/registry.py  # Herramientas de agentes: spec, parseo JSON, ejecución con sandbox
│   │   ├── services/
│   │   │   ├── agent_service.py      # Propuestas de agente/equipo, creación
│   │   │   ├── permission_service.py # Permisos, solicitudes de autorización
│   │   │   ├── memory_service.py     # Memoria estructurada
│   │   │   ├── llm_runner.py         # Bucle LLM↔herramientas, costes
│   │   │   ├── conversation.py       # CEO: sistema, herramientas de orquestación
│   │   │   ├── executor.py           # Ejecutor de tareas (cola asyncio)
│   │   │   ├── verification.py       # Verificación de tareas con evidencia real
│   │   │   ├── simulation.py         # Simulación de planes (dry-run)
│   │   │   ├── provider_service.py   # CRUD proveedores + resolución por modo
│   │   │   ├── secrets_service.py    # Cifrado Fernet de claves
│   │   │   ├── cost_service.py       # Resumen/historial de costes
│   │   │   ├── office_service.py     # Estado visual de la oficina
│   │   │   ├── backup_service.py     # Exportar datos, backups
│   │   │   ├── activity.py           # Registro de actividad + notificaciones
│   │   │   ├── events.py             # Bus de eventos (WebSocket)
│   │   │   └── settings_service.py   # Ajustes, pausa global
│   │   └── api/               # Routers REST (chat, agents, providers, permissions, …)
│   ├── tests/test_core.py     # 15 tests de seguridad y lógica
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── App.tsx            # Shell + navegación + pausa global + WS
│   │   ├── api.ts             # Cliente REST + WS + apiBase (Android)
│   │   ├── types.ts
│   │   ├── components/VoiceControls.tsx
│   │   └── pages/             # 16 páginas (chat, agentes, equipos, oficina, admin…)
│   ├── capacitor.config.ts    # webDir=dist
│   └── android/               # Proyecto Android generado por Capacitor
├── docs/                      # Esta documentación
├── data/                      # (gitignore) DB, workspaces, uploads, backups
├── release/ai-ceo-workspace.apk
└── .env.example
```

## Flujo de datos principal

Usuario → Chat → `conversation.handle_user_message` → CEO (LLM + herramientas
de orquestación) → `delegate_task` → cola del `executor` → `llm_runner`
(LLM ↔ herramientas con permisos) → `verification` → estado final.
Todo evento se publica por WebSocket a la UI.
