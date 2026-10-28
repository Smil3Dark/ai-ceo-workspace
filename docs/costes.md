# Costes potenciales

- **Modo local (Ollama)**: gratis. Solo electricidad de tu equipo.
- **Modo online**: según el proveedor que configures. Tú introduces la
  clave y (opcionalmente) el precio por 1k tokens; la app registra el uso
  real (`usage`) que devuelve cada respuesta en **Costes**.
- **Límite de gasto**: en **Costes** puedes fijar un tope global
  (`spend_limit`); el runner lo comprueba antes de cada llamada y frena
  la tarea marcándolo en el registro — no hay bucles infinitos.
- **Presupuesto por agente**: cada agente tiene `budget`; al superarlo su
  llamada se bloquea con explicación.
- Los costes marcados "(est.)" son estimaciones cuando no hay tarifa
  configurada; el resto son reales de la API.
