# AI CEO Workspace — versión para navegador
# Un solo contenedor: compila el frontend y lo sirve con el backend en :8000.
#
#   docker build -t ai-ceo-workspace .
#   docker run -p 8000:8000 -v aceo-data:/data ai-ceo-workspace
#   → http://localhost:8000
#
# Para IA local con Ollama corriendo en el host (Linux):
#   docker run -p 8000:8000 -v aceo-data:/data \
#     --add-host=host.docker.internal:host-gateway ai-ceo-workspace
#   y en la app (Modelos) apunta el proveedor a http://host.docker.internal:11434

# ── stage 1: build del frontend ────────────────────────────────────
FROM node:20-slim AS frontend
WORKDIR /fe
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY frontend/ ./
RUN npm run build

# ── stage 2: backend que sirve la SPA ─────────────────────────────
FROM python:3.11-slim
WORKDIR /app
COPY backend/requirements.txt backend/requirements.txt
RUN pip install --no-cache-dir -r backend/requirements.txt
COPY backend/ backend/
COPY --from=frontend /fe/dist frontend/dist
ENV ACEO_DATA_DIR=/data
VOLUME ["/data"]
EXPOSE 8000
WORKDIR /app/backend
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
