# Modo simulación

**Simulación**: construyes pasos (título, agente, dependencias, herramientas)
y la app analiza el plan **sin ejecutarlo**.

`simulation.simulate_plan` comprueba, de forma determinista:

- Referencias a pasos inexistentes.
- **Ciclos** en las dependencias (DFS).
- Permisos que faltarían: por cada paso y herramienta, qué `scope` pediría
  el agente real y si lo tiene (y si necesitaría tu confirmación).
- Estimación de tokens (~600 in / ~300 out por paso) y nota de coste.

Resultado: `would_execute` (podría correr o no), avisos, permisos que
faltan y la estimación.

## Garantía

La simulación nunca toca nada real: no envía mensajes, no escribe archivos,
no llama a herramientas ni a proveedores. El test
`test_simulation_never_executes` verifica que no se crea ningún fichero.
