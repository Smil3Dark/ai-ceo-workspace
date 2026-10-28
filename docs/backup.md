# Copia de seguridad y restauración

## Copia

- **Ajustes → "Crear copia ahora"** → copia de `app.db` a
  `data/backups/app-YYYYMMDD-HHMMSS.db`.
- **Ajustes → "Exportar mis datos"** → JSON completo (perfil, objetivos,
  proyectos, agentes, memoria, tareas, proveedores sin claves).
- **Memoria → Exportar** → solo recuerdos (importable después).

## Restaurar

1. Para con la BD: para el backend, reemplaza `data/app.db` por la copia
   y reinicia.
2. Memoria: **Memoria → Importar** con el JSON (dedupe por contenido).
3. Claves: no se exportan (cifradas y ligadas a `data/.secret_key`); si
   pierdes esa clave tendrás que volver a introducir las API keys.

## Qué incluir en una copia completa

```
data/app.db  data/workspace/  data/uploads/  data/.secret_key
```

Sin `.secret_key` los secretos guardados no se pueden descifrar.
