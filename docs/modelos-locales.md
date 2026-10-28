# Modelos locales (Ollama)

La app habla con Ollama vía HTTP (`POST /api/chat`, `GET /api/tags`), sin
dependencias de SDK. El protocolo de herramientas es un JSON
`{"tool": nombre, "args": {...}}` que el modelo escribe en su respuesta —
no requiere "function calling" nativo, así funcionan también modelos muy
pequeños como `qwen2.5:0.5b`.

## Puesta en marcha

```bash
# instalar ollama (linux)
curl -L https://github.com/ollama/ollama/releases/latest/download/ollama-linux-amd64.tar.zst -o ollama.tar.zst
tar --use-compress-program=unzstd -xf ollama.tar.zst -C ~/.local
~/.local/ollama/bin/ollama serve        # http://localhost:11434
~/.local/ollama/bin/ollama pull qwen2.5:0.5b
```

En la app: **Modelos y conexiones → + Añadir → Ollama (local)**, URL
`http://localhost:11434`, modelo `qwen2.5:0.5b`. Pulsa **Probar** — el botón
ejecuta una llamada real al proveedor y muestra el resultado honesto
(ok o el error concreto devuelto).

## Recomendaciones

- `qwen2.5:0.5b` (~400 MB) basta para probar; para uso real sube a
  `qwen2.5:7b` o similar — los modelos pequeños aciertan menos el formato
  de herramienta JSON.
- La app **no descarga modelos automáticamente**: los eliges tú con
  `ollama pull`.
- Si el modelo se equivoca de formato, el runner reintenta hasta
  `MAX_TOOL_ITERATIONS=8` pasos y luego responde con lo que tenga.
