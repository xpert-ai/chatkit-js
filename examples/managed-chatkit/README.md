# Managed ChatKit Example

A complete full-stack example demonstrating how to integrate ChatKit with a React frontend and Python backend.

## Overview

This example showcases:

- **Frontend**: Vite + React application using `@xpert-ai/chatkit-ui` components
- **Backend**: FastAPI server that creates ChatKit sessions and handles API requests
- **Integration**: Complete session management, streaming responses, and real-time chat

## Architecture

```
managed-chatkit/
├── frontend/          # React + Vite application
│   ├── src/
│   │   ├── App.tsx   # Main ChatKit integration
│   │   └── main.tsx  # Application entry point
│   └── vite.config.ts # Dev server with backend proxy
└── backend/           # Python FastAPI server
    └── app/
        └── main.py    # Session creation endpoint
```

## Quick Start

### Prerequisites

- Node.js 18+ and pnpm 10+
- Python 3.11+ with `uv` package manager
- A ChatKit-compatible LLM backend (or API key)

### 1. Setup Backend

```bash
cd examples/managed-chatkit/backend

# Copy environment configuration
cp .env.example .env

# Edit .env and configure your settings
# (Add your API keys, assistant configuration, etc.)

# Install dependencies
uv sync

# Start the backend server
uv run uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

The backend will be available at http://localhost:8000

### 2. Setup Frontend

```bash
cd examples/managed-chatkit/frontend

# Copy environment configuration
cp .env.example .env

# Edit .env if needed (defaults should work)

# Install dependencies (from project root)
pnpm install

# Start the frontend development server
pnpm dev
```

The frontend will be available at http://localhost:5173

### Alternative: Run Both Together

From the repository root:

```bash
pnpm managed-chatkit:dev
```

This command starts both frontend and backend simultaneously.

## Environment Configuration

### Backend (.env)

```env
# Your LLM provider API key
OPENAI_API_KEY=your_api_key_here

# Assistant configuration
ASSISTANT_ID=your_assistant_id

# Optional: Custom backend settings
PORT=8000
HOST=0.0.0.0
```

### Frontend (.env)

```env
# ChatKit UI development server (if running separately)
VITE_CHATKIT_TARGET=http://localhost:5176

# Assistant ID (must match backend)
VITE_CHATKIT_ASSISTANT_ID=your_assistant_id

# Backend API (leave empty to use dev proxy)
VITE_BACKEND_ORIGIN=

# Proxy target for development
VITE_BACKEND_TARGET=http://localhost:8000
```

**Note**: Leave `VITE_BACKEND_ORIGIN` empty during development to use the Vite proxy and avoid CORS issues.

## What This Example Demonstrates

### Session Management

The backend creates ChatKit sessions with client secrets:

```python
@app.post("/api/create-session")
async def create_session():
    # Creates a session and returns client_secret
    session = create_chatkit_session(...)
    return {"client_secret": session.client_secret}
```

The frontend fetches and manages these sessions automatically:

```tsx
const { control } = useChatKit({
  api: {
    async getClientSecret(existing) {
      const res = await fetch('/api/create-session', {
        method: 'POST',
      });
      return res.json().then(data => data.client_secret);
    },
  },
});
```

### Real-time Streaming

- Messages are streamed from the backend using Server-Sent Events (SSE)
- The UI updates in real-time as tokens arrive
- Full support for tool calls, widgets, and actions

### Development Features

- **Hot Module Replacement**: Both frontend and backend support hot reloading
- **Proxy Setup**: Vite proxies API calls to avoid CORS issues
- **TypeScript**: Full type safety across the application
- **Error Handling**: Comprehensive error states and user feedback

## Project Structure Details

### Frontend (React + TypeScript)

```
frontend/
├── src/
│   ├── App.tsx              # Main ChatKit integration component
│   ├── main.tsx             # React application entry
│   └── index.css            # Global styles
├── vite.config.ts           # Vite configuration with proxy
├── tailwind.config.js       # Tailwind CSS configuration
└── package.json             # Dependencies and scripts
```

**Key Files**:
- `App.tsx` - Demonstrates ChatKit integration with theme and configuration
- `vite.config.ts` - Configures proxy to backend API

### Backend (FastAPI + Python)

```
backend/
├── app/
│   ├── main.py              # FastAPI application with session endpoint
│   └── ...                  # Additional modules
├── pyproject.toml           # Python dependencies
└── .env                     # Environment configuration
```

**Key Files**:
- `app/main.py` - Session creation and API endpoints

## Customization

### Theme Configuration

Edit `frontend/src/App.tsx` to customize the ChatKit theme:

```tsx
const { control } = useChatKit({
  theme: {
    colorScheme: 'light',  // or 'dark'
    radius: 'round',       // pill, round, soft, sharp
    density: 'normal',     // compact, normal, spacious
    typography: {
      base: 16,
      fontFamily: 'Inter, sans-serif',
    },
  },
});
```

### Composer Options

Add tool selection or model switching:

```tsx
const { control } = useChatKit({
  composer: {
    placeholder: 'Type your message...',
    tools: [
      { name: 'web_search', description: 'Search the web' },
    ],
    models: [
      { id: 'gpt-4', name: 'GPT-4' },
    ],
  },
});
```

### Adding Custom Tools

1. Define client-side tool handler in frontend:

```tsx
const { control } = useChatKit({
  onClientTool: async ({ name, params }) => {
    if (name === 'get_location') {
      // Implement tool logic
      return { location: 'San Francisco, CA' };
    }
  },
});
```

2. Implement server-side tools in backend `app/main.py`

## Development Workflow

### Making Changes

1. **Frontend Changes**: Edit files in `frontend/src/`, hot reload is automatic
2. **Backend Changes**: Edit files in `backend/app/`, uvicorn will reload
3. **Styling**: Use Tailwind CSS utilities or edit `frontend/src/index.css`

### Building for Production

```bash
# Build frontend
cd frontend
pnpm build

# Backend is ready to deploy as-is
# Deploy with your preferred Python hosting service
```

### Testing

```bash
# Frontend
cd frontend
pnpm test

# Backend
cd backend
uv run pytest
```

## Troubleshooting

### ChatKit UI Not Loading

**Check**:
1. Is the ChatKit UI server running? Visit http://localhost:5176
2. Check browser console for errors
3. Verify `VITE_CHATKIT_TARGET` in `.env`

### CORS Errors

**Solution**:
- Ensure `VITE_BACKEND_ORIGIN` is empty (uses Vite proxy)
- Or configure CORS properly in your backend

### Session Creation Fails

**Check**:
1. Backend server is running (http://localhost:8000)
2. API keys are configured in backend `.env`
3. Network tab shows `/api/create-session` request succeeds

### Messages Not Streaming

**Check**:
1. Backend logs for errors
2. Assistant ID is correct in both frontend and backend
3. Browser supports Server-Sent Events (all modern browsers do)

## Next Steps

- Explore the [main documentation](../../docs/index.md) for advanced features
- Review [ChatKit configuration options](../../packages/chatkit/src/options.ts)
- Check out [advanced examples](https://github.com/openai/openai-chatkit-advanced-samples) for inspiration
- Learn about [server and client tools](../../docs/concepts/tools.md)

## Support

For issues specific to this example:
- Check the [main README](../../README.md)
- Review [troubleshooting guide](../../docs/guides/troubleshooting.md) (if available)
- Open an issue on the repository

## License

This example is part of the ChatKit project and is licensed under the [Apache License 2.0](../../LICENSE).
