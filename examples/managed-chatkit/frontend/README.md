# Managed ChatKit Frontend

React + Vite app demonstrating ChatKit integration.

## Quick Start

### Install Dependencies

From project root:

```bash
pnpm install
```

### Configure Environment

```bash
cp .env.example .env
```

Edit `.env`:

```env
VITE_CHATKIT_TARGET=http://localhost:5176
VITE_CHATKIT_ASSISTANT_ID=your-assistant-id
VITE_BACKEND_ORIGIN=
VITE_BACKEND_TARGET=http://localhost:8000
```

### Start Dev Server

**Option A - All services** (from repository root):

```bash
pnpm managed-chatkit:dev
```

**Option B - Individual**:

Terminal 1 - Backend:
```bash
cd ../backend
uv run uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

Terminal 2 - ChatKit UI (if developing UI):
```bash
cd ../../../packages/chatkit-ui
pnpm dev
```

Terminal 3 - Frontend:
```bash
pnpm dev
```

App runs on http://localhost:5173

## Project Structure

```
frontend/
├── src/
│   ├── App.tsx           # Main ChatKit integration
│   ├── main.tsx          # React entry
│   └── index.css         # Global styles
├── vite.config.ts        # Vite config with proxy
└── package.json
```

## Usage

```tsx
import { ChatKit, useChatKit } from '@xpert-ai/chatkit-react';

export default function App() {
  const { control } = useChatKit({
    api: {
      async getClientSecret(existing) {
        const res = await fetch('/api/create-session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        });
        const { client_secret } = await res.json();
        return client_secret;
      },
    },
    theme: { colorScheme: 'light', radius: 'round' },
    composer: { placeholder: 'Ask me anything...' },
  });

  return (
    <div className="flex h-screen">
      <ChatKit control={control} className="flex-1" />
    </div>
  );
}
```

## Scripts

```bash
pnpm dev          # Start dev server
pnpm build        # Build for production
pnpm preview      # Preview production build
pnpm lint         # Lint code
```

## Troubleshooting

### ChatKit UI Not Visible

Check:
1. ChatKit UI server running at http://localhost:5176
2. Browser console for errors
3. Network tab - `/api/create-session` succeeds
4. `VITE_CHATKIT_TARGET` in `.env`

### CORS Errors

Solution:
- Set `VITE_BACKEND_ORIGIN=""` (use proxy)
- Or configure CORS in backend

### Messages Not Sending

Check:
1. Backend server running (http://localhost:8000)
2. Assistant ID matches frontend/backend
3. Console for error messages
4. Network tab shows streaming connection

## License

Apache License 2.0
