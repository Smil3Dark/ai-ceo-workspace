# AI CEO Workspace

Aplicación de trabajo personal con IA: un asistente CEO (nombre provisional: **Atlas**) que dirige una organización de agentes especializados, con oficina virtual 3D que refleja el estado real de cada agente.

**Estado: nombre provisional.** El nombre definitivo lo decides tú en Ajustes.

## Qué es

- Un asistente CEO al que hablas por texto (y voz en el navegador, si está disponible): organiza, delega, recuerda.
- Agentes especializados que creas en lenguaje natural: describes lo que necesitas, la IA propone la configuración, tú aceptas / personalizas / creas manualmente.
- Una oficina 3D opcional que muestra a cada agente con su estado real (trabajando, en espera, esperando permiso, pausado…). Los agentes siguen funcionando con la oficina cerrada.

## Requisitos

| Pieza | Versión probada |
|---|---|
| Python | 3.10+ |
| Node.js | 20+ |
| Ollama (modo local) | cualquier versión reciente |
| Android Studio / SDK (para compilar la APK) | platform-34, build-tools 34, JDK 17 |

## Instalación y ejecución (local)

```bash
# 1. Backend
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000

# 2. Frontend (desarrollo)
cd frontend
npm install
npm run dev          # http://localhost:5173 (proxy a :8000)

# o compilar para que el backend lo sirva en :8000
npm run build        # sirve http://localhost:8000
```

Para IA local instala [Ollama](https://ollama.com), `ollama serve` y `ollama pull qwen2.5:0.5b` (u otro modelo). En la app, ve a **Modelos y conexiones** y añade el proveedor "Ollama (local)" con `http://localhost:11434`.

## Versión para navegador

La app completa ya es web: el backend sirve el frontend en `http://localhost:8000` con todas las funciones (chat del CEO, creación de agentes, oficina 3D LEGO, memoria, tareas, confirmaciones, simulación, costes, ajustes). La APK es solo un envoltorio de esta misma web.

**Opción rápida** (script local):

```bash
./scripts/serve-web.sh   # prepara venv + build si falta y sirve http://localhost:8000
```

**Opción Docker** (un solo contenedor, datos persistentes en volumen):

```bash
docker build -t ai-ceo-workspace .
docker run -p 8000:8000 -v aceo-data:/data ai-ceo-workspace
# → http://localhost:8000
```

Para Ollama dentro del contenedor: `--add-host=host.docker.internal:host-gateway` y apunta el proveedor a `http://host.docker.internal:11434`. También funciona en un servidor: expón el puerto 8000 detrás de tu proxy/HTTPS.

## APK Android

`release/ai-ceo-workspace.apk` es la APK de depuración lista para instalar. La app móvil es una interfaz: **necesita el backend en ejecución** (en tu PC u otro equipo de la misma red). Tras instalarla abre Ajustes → "URL del backend" y apunta a `http://<IP-de-tu-PC>:8000`.

Para compilarla tú:

```bash
cd frontend
npm install
npm run build
npx cap sync android
cd android && ./gradlew assembleDebug
# → android/app/build/outputs/apk/debug/app-debug.apk
```

## Estructura

```
backend/    FastAPI + SQLite + executor + servicios (permisos, memoria, agentes, costes…)
frontend/   React + TypeScript + Tailwind + Three.js (oficina 3D) + Capacitor
docs/       Documentación completa (ver docs/README.md)
data/       Base de datos, workspaces de agentes, uploads, backups (no se sube al repo)
scripts/    Utilidades
release/    APK Android
```

## Seguridad y honestidad

- Los agentes solo reciben los permisos que tú concedes; el CEO **no** es excepción.
- Las operaciones sensibles (enviar, publicar, comprar, ejecutar código, compartir, conceder permisos, borrar archivos) crean una **solicitud de confirmación** en "Confirmaciones": nada se ejecuta sin tu aprobación, y se ejecuta exactamente lo que aprobaste.
- Las claves API se guardan cifradas (Fernet) en `data/` y nunca se muestran en la UI ni se escriben en el registro.
- `send_message` y `publish_content` generan **borradores locales** (en `data/workspace/…/outbox/`) porque no hay ningún canal externo configurado: la app no simula que "envió" nada.

## Pruebas

```bash
cd backend && .venv/bin/python -m pytest tests/ -q   # 15 tests
```

Ver `docs/` para la documentación completa de cada módulo.
