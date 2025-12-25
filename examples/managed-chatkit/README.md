# Managed ChatKit Example

Full-stack example demonstrating ChatKit integration with React frontend and Python backend.

## Quick Start

### Prerequisites

- Node.js 18+ and pnpm 10+
- Python 3.11+ with `uv` package manager
- A ChatKit-compatible LLM backend

### 1. Setup Backend

```bash
cd examples/managed-chatkit/backend
cp .env.example .env
# Edit .env with your API keys
uv sync
uv run uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

Backend runs on http://localhost:8000

### 2. Setup Frontend

```bash
cd examples/managed-chatkit/frontend
cp .env.example .env
pnpm install
pnpm dev
```

Frontend runs on http://localhost:5173

### Alternative: Run Both

From repository root:

```bash
pnpm managed-chatkit:dev
```

## Environment Configuration

### Backend (.env)

```env
OPENAI_API_KEY=your_api_key_here
ASSISTANT_ID=your_assistant_id
PORT=8000
HOST=0.0.0.0
```

### Frontend (.env)

```env
VITE_CHATKIT_TARGET=http://localhost:5176
VITE_CHATKIT_ASSISTANT_ID=your_assistant_id
VITE_BACKEND_ORIGIN=
VITE_BACKEND_TARGET=http://localhost:8000
```

**Note**: Keep `VITE_BACKEND_ORIGIN` empty to use Vite proxy and avoid CORS.

## What This Example Demonstrates

- **Session Management**: Backend creates sessions, frontend manages them automatically
- **Real-time Streaming**: Messages streamed via SSE with live UI updates
- **Full Integration**: Tool calls, widgets, and actions supported
- **Hot Reload**: Both frontend and backend support auto-reloading

## Project Structure

```
managed-chatkit/
├── frontend/          # React + Vite
│   └── src/
│       └── App.tsx    # ChatKit integration
└── backend/           # FastAPI
    └── app/
        └── main.py     # Session creation
```

## Customization

Edit `frontend/src/App.tsx` to customize:

```tsx
const { control } = useChatKit({
  theme: {
    colorScheme: 'light',
    radius: 'round',
    density: 'normal',
  },
  composer: {
    placeholder: 'Type your message...',
  },
  onClientTool: async ({ name, params }) => {
    // Handle client-side tools
    return { result: 'success' };
  },
});
```

## Scripts

```bash
# Frontend
pnpm dev      # Start dev server
pnpm build    # Build for production

# Backend
uv sync           # Install dependencies
uv run uvicorn app.main:app --reload
```

## Troubleshooting

### ChatKit UI Not Loading

Check:
1. ChatKit UI server running at http://localhost:5176
2. Browser console for errors
3. `VITE_CHATKIT_TARGET` in `.env`

### CORS Errors

Solution: Set `VITE_BACKEND_ORIGIN=""` (use proxy)

### Session Creation Fails

Check:
1. Backend server running (http://localhost:8000)
2. API keys configured in backend `.env`
3. `/api/create-session` request succeeds

## Next Steps

- [Main documentation](../../docs/index.md)
- [ChatKit configuration](../../packages/chatkit/src/options.ts)
- [Tools and actions](../../docs/concepts/tools.md)

## License

Apache License 2.0
