# Instalación y ejecución

## 1. Backend (obligatorio)

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

Al arrancar crea `data/app.db`, ejecuta `recover_incomplete` (las tareas que
quedaron a medias vuelven a "pendiente") y arranca el ejecutor de tareas.

## 2. Frontend

Desarrollo:

```bash
cd frontend
npm install
npm run dev      # http://localhost:5173
```

Producción (el backend lo sirve en el mismo puerto 8000):

```bash
npm run build    # genera dist/, que main.py monta en /
```

## 3. IA local (opción por defecto)

1. Instala Ollama: https://ollama.com
2. `ollama serve`
3. `ollama pull qwen2.5:0.5b` (modelo pequeño probado; cualquier otro sirve)
4. En la app → **Modelos y conexiones** → "+ Añadir" → tipo *Ollama (local)*,
   URL `http://localhost:11434`, modelo `qwen2.5:0.5b` → **Probar**.

## 4. Android

Instala `release/ai-ceo-workspace.apk` en el teléfono (permite "orígenes
desconocidos"). Es una app cliente: el backend debe estar corriendo y accesible
en la red (misma Wi-Fi). En el teléfono:

1. Abre la app → onboarding → configura tu proveedor apuntando a tu PC.
2. Si la URL por defecto no es accesible: **Ajustes → URL del backend** →
   `http://<IP-de-tu-PC>:8000` → Aplicar (la app se recarga).

Para averiguar la IP del PC: `ip addr` (Linux) / `ipconfig` (Windows), la
IPv4 de la interfaz Wi-Fi. El backend escucha en `0.0.0.0` por defecto, así
que solo hace falta que el firewall del PC acepte el puerto 8000.

Compilar la APK desde cero:

```bash
cd frontend && npm install && npm run build
npx cap sync android
cd android && ./gradlew assembleDebug
```

> Nota: si Maven Central devuelve errores 429, el proyecto ya incluye el
> mirror `maven-central.storage-download.googleapis.com` en `build.gradle`.
