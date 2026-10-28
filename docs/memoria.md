# Memoria

Memoria estructurada y persistente — no solo historial de chat.

## Categorías

`profile` (quién eres), `preference` (cómo te gusta trabajar), `goal`,
`project`, `agent` (qué hace cada agente y por qué), `task_history`,
`document` (extractos indexados de tus archivos), `verified_knowledge`
(datos confirmados), `fact` (otros).

Cada recuerdo: contenido, categoría, `kind` (fact/preference/decision…),
`verified` (solo tú lo marcas), `source` (user/ceo/document/import),
propietario (usuario o agente) y `privacy` (`public`/`private`).

## Privacidad entre agentes

`memory_scope` del agente: `own` (solo su memoria), `user` (también las
tuyas públicas), `all`. Los recuerdos `private` nunca los lee un agente
distinto de su propietario (`agent_can_read`). En modo híbrido,
Ajustes → Privacidad controla si lo privado puede ir a APIs externas.

## Pantalla Memoria

Buscar por texto, filtrar por categoría, editar, eliminar, **exportar**
(JSON) e **importar** (sin duplicados: se deduplica por contenido).

## Cómo la usan los agentes

El CEO tiene `recall`/`remember` como herramientas de orquestación; los
agentes usan `memory_search`/`memory_write` limitadas por su
`memory_scope` y permisos `memory_read`/`memory_write`.
