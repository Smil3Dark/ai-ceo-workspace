# Permisos y confirmaciones

## Modelo

Cada agente tiene una matriz de permisos por **alcance** (`scope`):
`sin definir / permitir / denegar` + marca opcional "siempre confirmar".

Alcances sensibles (`SENSITIVE_SCOPES`): `send_message`, `publish`,
`purchase`, `exec_code`, `external_share`, `grant_permissions`,
`file_delete`. Aunque estén permitidos, **cada uso genera una solicitud de
autorización** — nunca se ejecutan directamente.

El CEO no es excepción: pasa por el mismo control.

## Cadena de decisión (`tools/registry.execute`)

1. Herramienta desconocida → denegado.
2. Herramienta no asignada al agente → denegado.
3. Alcance denegado → denegado.
4. Alcance sensible o marcado "confirmar" → crea `AuthorizationRequest`
   con el **payload congelado** y corta la ejecución (la tarea queda
   `awaiting_authorization`).
5. Permitido → se ejecuta y queda en `activity_log`.

## Confirmaciones

En **Confirmaciones** ves cada solicitud con: agente, acción, razón,
recursos afectados, riesgo estimado y coste estimado. Opciones:

- **Aprobar y ejecutar** — ejecuta el payload congelado (`run_approved_payload`),
  nunca una variante nueva.
- **Aprobar modificada** — pasa a un ciclo de edición manual del payload.
- **Posponer** — queda pendiente.
- **Rechazar** — queda registrada como rechazada.

Ninguna solicitud se ejecuta sola, ni reintentando ni reiniciando.

## Herramientas → alcance

`TOOL_SCOPES` mapea cada herramienta: `file_write`→`file_write`,
`send_message`→`send_message`, `exec_code`→`exec_code`,
`memory_*`→`memory_read/write`, `http_get`→`net_read`, `delegate`→`delegate`,
`propose_agent`→`create_agent`…
