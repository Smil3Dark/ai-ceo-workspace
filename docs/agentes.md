# Agentes y equipos

## Crear un agente

**Creación → Crear agente**: describes lo que necesitas en lenguaje natural
(+ opcionalmente autonomía y presupuesto) → `agent_service.propose_agent_config`
genera un borrador determinista: nombre, rol, herramientas (`DEFAULT_TOOLSETS`
por rol), permisos mínimos necesarios, modelo sugerido, avatar y limitaciones
honestas (p.ej. "⚠ no hay proveedor configurado").

Puedes **editar todo** antes de aceptar: identidad, objetivo, instrucciones,
rol, modelo. Al aceptar, `create_from_proposal` concede solo los permisos
solicitados — nada más.

## Equipos recomendados

**Creación → Equipos**: describes el proyecto → se proponen miembros con
rol, herramientas y la razón de cada uno (`reason`). Tres opciones:
**aceptar** (crea el equipo completo), **personalizar/manual** (lleva al
wizard de agente), o **rechazar**. Nada se crea sin tu aprobación.

## Gestión de cada agente

En su ficha: identidad, apariencia (color/estilo), voz (TTS del navegador),
operación (proveedor, modelo, autonomía, presupuesto + gasto, memory_scope,
herramientas), **permisos** (matriz por alcance + "siempre confirmar") y
actividad (tareas recientes). Acciones: pausar/reanudar, duplicar,
exportar (JSON de configuración), eliminar — con confirmación si tiene
tareas abiertas. El CEO no se puede eliminar.

## Ejecución

El CEO delega con `delegate_task` o tú asignas desde **Tareas**. El
executor corre una tarea cada vez, respeta dependencias (`deps_met`),
reintenta hasta `MAX_TASK_ATTEMPTS=3` y verifica con evidencia real
(`docs/pruebas.md` y `verification.py`): ninguna tarea se completa solo
porque el agente diga que terminó.
