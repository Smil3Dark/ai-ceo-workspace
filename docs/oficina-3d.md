# Oficina 3D

Three.js (`@react-three/fiber` + `drei`). **Representación opcional**: los
agentes funcionan igual con la oficina cerrada — solo refleja su estado real.

## Qué ves

- Un escritorio y un avatar por agente (color personalizable en su ficha).
- El CEO lleva una corona dorada.
- Encima: nombre, estado en texto y una barra de "uso" (tareas recientes).
- Click en un avatar → panel con estado, rol, modelo, tarea actual y si
  está esperando tu autorización.

## Estados (color)

| Estado | Color | Significado |
|---|---|---|
| idle | azul | sin tarea activa |
| working | ámbar | ejecutando una tarea |
| waiting_permission | rojo | hay una solicitud pendiente tuya |
| blocked | violeta | sin permiso o dependencia incumplida |
| paused | gris | pausado por ti |
| offline | oscuro | sin proveedor válido |

## Opciones

- **Escenario**: "Oficina moderna" (suelo, paredes, ventanas, zona de ocio
  con sofás y plantas) o "Laboratorio" (grid minimalista).
- **Disposición**: cuadrícula o espacio abierto.
- **Ciclo día/noche**: la hora avanza y cambia iluminación y cielo; con el
  ciclo activo, los agentes ociosos a veces pasean a la zona de ocio.
- **Modo administrador** (checkbox arriba): panel para cambiar iluminación
  (auto/día/noche/cálida) y lanzar la disposición automática por zonas
  (puestos / reunión / ocio / recepción).

El estado llega por WebSocket: al cambiar cualquier agente o tarea, la
oficina se actualiza sin recargar.
