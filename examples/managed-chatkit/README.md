# Managed ChatKit Demo

This folder contains a minimal demo setup:

- `frontend/`: Vite + React demo that renders `@xpert-ai/chatkit-ui` components.
- `backend/`: API stub for creating ChatKit sessions (optional).

## Backend

```bash
cd examples/managed-chatkit/backend
cp .env.example .env
uv sync
uv run uvicorn app.main:app --host 0.0.0.0 --port 8009 --reload
```

## Frontend

```bash
cd examples/managed-chatkit/frontend
cp .env.example .env
pnpm -C examples/managed-chatkit/frontend dev
```
