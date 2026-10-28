# Proveedores en línea

La app soporta cualquier API **compatible con OpenAI** (`POST
/v1/chat/completions`, `Authorization: Bearer <clave>`): OpenAI, Groq,
Together, OpenRouter, un proxy local, etc.

## Añadir un proveedor

**Modelos y conexiones → + Añadir**:

- Tipo: *API compatible con OpenAI*
- URL base: `https://api.openai.com` (o la del proveedor)
- Modelo por defecto: p.ej. `gpt-4o-mini`
- API key: se guarda **cifrada** (Fernet) en `data/`; la UI solo muestra
  `••••` y nunca la vuelve a exponer.
- Marca "Gratuito" solo si lo es — el coste por 1k tokens define cómo se
  contabiliza el gasto. Déjalo en blanco si no lo sabes: el uso real que
  devuelve la API se registra igualmente.

Pulsa **Probar** para hacer una llamada real: si falla, verás el error real
(401, modelo inexistente, etc.), no una simulación.

## De pago

Si configuras `cost_per_1k_in/out`, cada llamada registra su coste en
**Costes** con datos de uso reales de la respuesta (`usage`). Sin tarifas
configuradas el coste se marca como estimado.
