# Managed ChatKit Frontend

A React + Vite application demonstrating integration with the `@xpert-ai/chatkit-web-component` package.

## Overview

This frontend application showcases:

- **Web Component Integration**: Using the ChatKit web component in a React app
- **Automatic Session Management**: Web component handles session creation automatically
- **Type-Safe Configuration**: Full TypeScript support for all ChatKit options
- **Theme Customization**: Demonstrating various theming and UI configuration options
- **Development Proxy**: Vite proxy configuration to avoid CORS issues

## Quick Start

### 1. Install Dependencies

From the project root:

```bash
pnpm install
```

### 2. Configure Environment

Copy the example environment file:

```bash
cp .env.example .env
```

Edit `.env` to configure your settings:

```env
# ChatKit UI development server (if running separately)
VITE_CHATKIT_TARGET=http://localhost:5176

# Assistant ID (must match backend configuration)
VITE_CHATKIT_ASSISTANT_ID=your-assistant-id

# Backend API origin (leave empty to use proxy)
VITE_BACKEND_ORIGIN=

# Backend proxy target for development
VITE_BACKEND_TARGET=http://localhost:8000
```

### 3. Start the Development Server

**Option A: Start all services together** (from repository root):

```bash
pnpm managed-chatkit:dev
```

**Option B: Start services individually**:

Terminal 1 - Backend:
```bash
cd ../backend
uv run uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

Terminal 2 - ChatKit UI (if developing UI package):
```bash
cd ../../../packages/chatkit-ui
pnpm dev
```

Terminal 3 - Frontend:
```bash
pnpm dev
```

The application will be available at http://localhost:5173

## Project Structure

```
frontend/
├── src/
│   ├── App.tsx           # Main ChatKit integration component
│   ├── main.tsx          # React application entry point
│   └── index.css         # Global styles (Tailwind)
├── public/               # Static assets
├── index.html            # HTML entry point
├── vite.config.ts        # Vite configuration with proxy
├── tailwind.config.js    # Tailwind CSS configuration
├── tsconfig.json         # TypeScript configuration
└── package.json          # Dependencies and scripts
```

## Code Walkthrough

### App.tsx - Main Integration

```tsx
import { ChatKit, useChatKit } from '@xpert-ai/chatkit-react';

export default function App() {
  const { control } = useChatKit({
    api: {
      async getClientSecret(existing) {
        // Fetch session from backend
        const res = await fetch('/api/create-session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        });
        const { client_secret } = await res.json();
        return client_secret;
      },
    },
    theme: {
      colorScheme: 'light',
      radius: 'round',
    },
    composer: {
      placeholder: 'Ask me anything...',
    },
  });

  return (
    <div className="flex h-screen">
      <div className="w-96 p-4 border-r">
        <h1 className="text-2xl font-bold">Managed ChatKit</h1>
        {/* Configuration panel */}
      </div>

      <ChatKit
        control={control}
        className="flex-1"
      />
    </div>
  );
}
```

### Key Features Demonstrated

#### 1. Automatic Session Management

The web component automatically:
- Calls the backend to create a session
- Retrieves the client secret
- Sends configuration to the ChatKit UI via postMessage
- Handles loading and error states

#### 2. Type-Safe Configuration

Full TypeScript support for all configuration options:

```tsx
import type { ChatKitOptions } from '@xpert-ai/chatkit-types';

const options: ChatKitOptions = {
  theme: {
    colorScheme: 'light',  // Type-checked
    radius: 'round',       // Autocomplete available
  },
  // ... more options
};
```

#### 3. Development Proxy

The `vite.config.ts` includes a proxy to avoid CORS issues:

```ts
export default defineConfig({
  server: {
    proxy: {
      '/api': {
        target: process.env.VITE_BACKEND_TARGET,
        changeOrigin: true,
      },
    },
  },
});
```

## Customization Examples

### Theme Variants

```tsx
// Light theme
theme: {
  colorScheme: 'light',
  radius: 'round',
  density: 'normal',
}

// Dark theme
theme: {
  colorScheme: 'dark',
  radius: 'soft',
  density: 'compact',
}

// Custom colors
theme: {
  colors: {
    primary: '#0066FF',
    background: '#FFFFFF',
    // ... more colors
  },
}
```

### Composer Configuration

```tsx
composer: {
  placeholder: 'Type your message...',
  attachments: {
    enabled: true,
    maxSize: 10 * 1024 * 1024,  // 10MB
    maxCount: 5,
    accept: 'image/*,.pdf,.doc,.docx',
  },
  tools: [
    { name: 'web_search', description: 'Search the web' },
    { name: 'calculator', description: 'Perform calculations' },
  ],
}
```

### Client Tool Handling

```tsx
useChatKit({
  onClientTool: async ({ name, params }) => {
    switch (name) {
      case 'get_location':
        return { location: 'San Francisco, CA' };

      case 'get_time':
        return { time: new Date().toISOString() };

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  },
});
```

### Thread Management

```tsx
useChatKit({
  history: {
    enabled: true,
    showDelete: true,
    showRename: true,
  },
  initialThread: null,  // Start with new thread
  // or
  initialThread: 'thread-id-123',  // Load specific thread
});
```

## Development

### Available Scripts

```bash
pnpm dev          # Start development server
pnpm build        # Build for production
pnpm preview      # Preview production build
pnpm lint         # Lint code
```

### Hot Module Replacement

Vite provides instant HMR for:
- React component changes
- CSS/Tailwind updates
- TypeScript changes

Edit files in `src/` and see changes immediately in the browser.

### Debugging

#### Browser Console

The web component and ChatKit UI log useful debugging information:

```
🚀 Managed Chatkit Example with Web Component
[xpert-chatkit] Sending init message to iframe: {...}
[chatkit-ui] Received message: chatkit:init {...}
```

#### Network Tab

Monitor API requests:
- `/api/create-session` - Session creation
- `/api/chat/stream` - Message streaming (if applicable)

#### React DevTools

Install React DevTools to inspect:
- Component hierarchy
- Props and state
- Re-render performance

## Building for Production

```bash
# Build the application
pnpm build

# Preview the production build locally
pnpm preview

# The built files will be in the dist/ directory
```

Deploy the `dist/` folder to your hosting service:
- Vercel
- Netlify
- AWS S3 + CloudFront
- Any static hosting

### Environment Variables for Production

Set these environment variables in your hosting platform:

```env
VITE_CHATKIT_TARGET=https://your-chatkit-ui.example.com
VITE_CHATKIT_ASSISTANT_ID=your-production-assistant-id
VITE_BACKEND_ORIGIN=https://your-backend-api.example.com
```

## Comparison: Before vs After Web Component

| Feature | Manual Integration | Web Component |
|---------|-------------------|---------------|
| Code Lines | ~135 lines | ~43 lines |
| Session Management | Manual | Automatic |
| postMessage Setup | Manual | Automatic |
| Loading States | Manual implementation | Built-in |
| Error Handling | Manual implementation | Built-in |
| TypeScript Support | DIY types | Included |
| Framework Support | React-specific | Any framework |
| Maintenance | High | Low |

## Troubleshooting

### ChatKit UI Not Visible

**Check**:
1. Is the ChatKit UI server running? Visit http://localhost:5176
2. Open browser console - any errors?
3. Check Network tab - is `/api/create-session` succeeding?
4. Verify `VITE_CHATKIT_TARGET` in `.env`

### CORS Errors

**Solution**:
- Use the proxy: Set `VITE_BACKEND_ORIGIN=""` (empty string)
- Or configure CORS headers in your backend
- For production, ensure backend allows your frontend domain

### Messages Not Sending

**Check**:
1. Backend server is running (http://localhost:8000)
2. Assistant ID matches between frontend and backend
3. Console shows any error messages
4. Network tab shows streaming connection

### Styling Issues

**Check**:
1. Tailwind CSS is configured correctly
2. `index.css` is imported in `main.tsx`
3. Purge settings in `tailwind.config.js` don't remove needed classes

## Next Steps

- Review [ChatKit configuration documentation](../../../packages/chatkit/src/options.ts)
- Learn about [tools and actions](../../../docs/concepts/tools.md)
- Explore [theming options](../../../docs/guides/theming.md) (if available)
- Add custom features to your implementation

## Support

- Main documentation: [../../README.md](../../../README.md)
- Example documentation: [../README.md](../README.md)
- Issue tracker: https://github.com/xpert-ai/chatkit-js/issues

## License

This example is part of the ChatKit project and is licensed under the [Apache License 2.0](../../../LICENSE).
