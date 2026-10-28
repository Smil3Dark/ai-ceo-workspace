# Dependencias externas

## Backend (`backend/requirements.txt`)

`fastapi`, `uvicorn`, `sqlalchemy`, `pydantic`, `cryptography` (Fernet),
`httpx`, `websockets`, `python-multipart` (uploads), `pytest` (tests).

## Frontend (`frontend/package.json`)

`react` 18, `react-router-dom` 6, `three`, `@react-three/fiber`,
`@react-three/drei`, `zustand` (poco usado), `vite`, `typescript`,
`tailwindcss`, `@capacitor/core|cli|android` 6.

## Servicios externos

| Servicio | Obligatorio | Uso |
|---|---|---|
| Ollama | no (modo local) | `GET /api/tags`, `POST /api/chat` en `http://localhost:11434` |
| API compatible OpenAI | no (modo online) | `POST /v1/chat/completions` |
| `http_get` de agentes | opcional | solo si les concedes el permiso `net_read` y el dominio está en sus constraints |

## Android

Capacitor 6 + Gradle 8.2.1 + AGP 8.2.1 + JDK 17 + Android SDK platform-34.
