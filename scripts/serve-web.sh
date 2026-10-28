#!/usr/bin/env bash
# AI CEO Workspace — versión para navegador (local).
# Levanta el backend sirviendo el frontend web en http://localhost:8000
# con TODAS las funciones de la app (chat CEO, agentes, oficina 3D, memoria…).
set -e
cd "$(dirname "$0")/.."

[ -d backend/.venv ] || python3 -m venv backend/.venv
backend/.venv/bin/pip install -q -r backend/requirements.txt

if [ ! -f frontend/dist/index.html ]; then
  (cd frontend && npm ci --no-audit --no-fund && npm run build)
fi

echo "→ http://localhost:8000"
cd backend && exec .venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000
