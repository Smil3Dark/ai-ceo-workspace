# Limitaciones conocidas

- **Modelos locales pequeños** (`qwen2.5:0.5b`) fallan a veces el formato
  JSON de herramienta; el sistema reintenta y responde igualmente, pero
  para fiabilidad usa un modelo ≥7B.
- **Voz**: STT/TTS usan Web Speech API del navegador (`es-MX`). Funciona en
  Chrome/Edge; si no está disponible el botón lo indica claramente. En la
  APK (WebView) puede no estar disponible según el dispositivo.
- **`send_message`/`publish_content`** no tienen canal externo real: generan
  borradores en `data/workspace/agent_<id>/outbox/` y lo dejan explícito.
  No se fingen envíos.
- **Sesión de usuario única**: la app es monousuario local (no hay login ni
  multiusuario). `current_user` es fijo.
- **Oficina 3D**: los movimientos de paseo son locales del navegador; el
  estado de cada avatar sí es real (WebSocket).
- **La APK es cliente**: sin backend accesible en la red no funciona nada
  (la UI lo permite configurar, pero no hay modo offline completo).
- **Sin migraciones de BD**: para actualizar el esquema en desarrollo,
  borra `data/app.db`.
- **CORS abierto** (`*`) pensado para uso local; no expongas el backend a
  internet sin añadir autenticación.
- **WebSocket** sin autenticación (mismo criterio: red local).
