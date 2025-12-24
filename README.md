# ChatKit

A batteries-included framework for building high-quality, AI-powered chat experiences. ChatKit is designed for developers who want to add advanced conversational intelligence to their applications with minimal setup and maximum flexibility.

[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](LICENSE)

## Features

- **🎨 Deep UI Customization** - Extensive theming options including color schemes, typography, spacing, and custom components
- **⚡ Built-in Response Streaming** - Real-time message streaming with Server-Sent Events (SSE) support
- **🔧 Tool Integration** - Support for both server-side and client-side tools with interrupt handling
- **📦 Rich Interactive Widgets** - Render cards, lists, forms, and custom widgets directly in chat
- **📎 Attachment Handling** - File and image uploads with configurable validation and upload strategies
- **💬 Thread Management** - Organize conversations with thread creation, switching, and history
- **🏷️ Entity Tagging** - @-mention support with entity previews and autocomplete
- **🌍 Internationalization** - Support for 68+ locales with English fallback
- **🎯 Framework Agnostic** - Use with React, vanilla JavaScript, or any framework via Web Components

## What Makes ChatKit Different?

ChatKit is a complete, production-ready chat solution that you can drop into any application. You don't need to:

- Build custom chat UIs from scratch
- Manage low-level message state and synchronization
- Implement streaming and real-time updates manually
- Wire up file uploads and attachment handling
- Create your own theming system

Just add the ChatKit component, configure your API endpoint, and customize the experience to match your application.

## Project Structure

This is a monorepo containing multiple packages:

```
chatkit-js/
├── packages/
│   ├── chatkit/              # @xpert-ai/chatkit-types - Core type definitions
│   ├── chatkit-react/        # @xpert-ai/chatkit-react - React bindings
│   ├── chatkit-ui/           # @xpert-ai/chatkit-ui - Complete React UI
│   ├── chatkit-web-shared/   # @xpert-ai/chatkit-web-shared - Shared utilities
│   └── web-component/        # @xpert-ai/chatkit-web-component - Web Component
├── examples/
│   └── managed-chatkit/      # Full-stack example (React + Python backend)
└── docs/                     # Documentation
```

## Quick Start

### Prerequisites

- Node.js 18+ and pnpm 10+
- A backend API that provides ChatKit sessions (see [Backend Setup](#backend-setup))

### Installation

Choose the integration that fits your stack:

#### React

```bash
npm install @xpert-ai/chatkit-react
# or
pnpm add @xpert-ai/chatkit-react
```

#### Web Component (Framework Agnostic)

```bash
npm install @xpert-ai/chatkit-web-component
# or
pnpm add @xpert-ai/chatkit-web-component
```

### Basic Usage

#### React Integration

```tsx
import { ChatKit, useChatKit } from '@xpert-ai/chatkit-react';

export function MyChat() {
  const { control } = useChatKit({
    api: {
      async getClientSecret(existing) {
        // Fetch a new session token from your backend
        const res = await fetch('/api/chatkit/session', {
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

  return <ChatKit control={control} className="h-[600px] w-[400px]" />;
}
```

#### Web Component Integration

```html
<!DOCTYPE html>
<html>
<head>
  <script type="module">
    import '@xpert-ai/chatkit-web-component';
  </script>
</head>
<body>
  <xpertai-chatkit id="chat"></xpertai-chatkit>

  <script>
    const chatkit = document.getElementById('chat');
    chatkit.options = {
      api: {
        async getClientSecret() {
          const res = await fetch('/api/chatkit/session', { method: 'POST' });
          const { client_secret } = await res.json();
          return client_secret;
        }
      }
    };
  </script>
</body>
</html>
```

### Backend Setup

Your backend needs to provide session tokens. Here's a minimal example using FastAPI:

```python
from fastapi import FastAPI
import os

app = FastAPI()

@app.post("/api/chatkit/session")
async def create_session():
    # Your logic to create a ChatKit session
    # This should return a client_secret token
    return {
        "client_secret": "your_session_token"
    }
```

For a complete working example, see [`examples/managed-chatkit`](examples/managed-chatkit).

## Configuration

ChatKit is highly configurable. Here are some key options:

### Theme Customization

```tsx
{
  theme: {
    colorScheme: 'light' | 'dark',
    radius: 'pill' | 'round' | 'soft' | 'sharp',
    density: 'compact' | 'normal' | 'spacious',
    typography: {
      base: 16,           // Base font size in pixels
      fontFamily: 'Inter, sans-serif',
    },
    colors: {
      primary: '#0066FF',
      // ... custom color palette
    }
  }
}
```

### Composer Options

```tsx
{
  composer: {
    placeholder: 'Type a message...',
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
    models: [
      { id: 'gpt-4', name: 'GPT-4' },
      { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo' },
    ],
  }
}
```

### Thread Management

```tsx
{
  history: {
    enabled: true,
    showDelete: true,
    showRename: true,
  },
  initialThread: null,  // or specific thread ID
}
```

### Client Tools

Handle client-side tool execution:

```tsx
{
  onClientTool: async ({ name, params }) => {
    if (name === 'get_user_location') {
      return { location: 'San Francisco, CA' };
    }
    // ... handle other tools
  }
}
```

For complete configuration options, see the [ChatKitOptions documentation](packages/chatkit/src/options.ts).

## Examples

### Managed ChatKit Example

Run the full-stack example with frontend and backend:

```bash
# From repository root
pnpm managed-chatkit:dev
```

This starts:
- Frontend on http://localhost:5173
- Backend API on http://localhost:8000

See [`examples/managed-chatkit/README.md`](examples/managed-chatkit/README.md) for details.

### UI Development

Run the standalone UI component playground:

```bash
pnpm dev:ui
```

## Development

### Setup

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build
```

### Available Commands

```bash
pnpm build              # Build all packages
pnpm dev:ui             # Start UI development server
pnpm dev:docs           # Start documentation server
pnpm test               # Run all tests
pnpm lint               # Lint all packages
pnpm format             # Format code with Prettier
pnpm types              # Type check all packages
pnpm check              # Run all checks (lint, types, test)
pnpm clean              # Clean build artifacts
pnpm managed-chatkit:dev # Run managed-chatkit example
```

### Package Scripts

Each package has its own scripts. Example:

```bash
# Work with specific package
pnpm --filter @xpert-ai/chatkit-react build
pnpm --filter @xpert-ai/chatkit-ui dev
```

## Documentation

- [Getting Started](docs/index.md) - Introduction and setup
- [Concepts](docs/concepts/) - Core concepts like threads, tools, and actions
  - [Threads](docs/concepts/threads.md) - Managing conversations
  - [Tools](docs/concepts/tools.md) - Server and client tools
  - [Actions](docs/concepts/actions.md) - Handling user actions
- [Guides](docs/guides/) - Step-by-step guides
  - [Update Client During Response](docs/guides/update-client-during-response.md)
- [API Reference](packages/chatkit/src/options.ts) - Complete configuration options

## Architecture

ChatKit uses a layered architecture:

1. **Core Types** (`@xpert-ai/chatkit-types`) - Shared TypeScript definitions
2. **Web Shared** (`@xpert-ai/chatkit-web-shared`) - Common utilities (SSE, messaging, errors)
3. **Web Component** (`@xpert-ai/chatkit-web-component`) - Framework-agnostic custom element
4. **React Bindings** (`@xpert-ai/chatkit-react`) - React hooks and components
5. **UI Components** (`@xpert-ai/chatkit-ui`) - Complete React UI implementation

This design allows you to:
- Use the Web Component in any framework (Vue, Angular, Svelte, etc.)
- Use React bindings for optimal React integration
- Swap out the UI layer while keeping the core logic

## Browser Support

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Modern mobile browsers (iOS Safari 14+, Chrome Android)

## Roadmap

- [x] Core message streaming
- [x] Thread management
- [x] File attachments
- [ ] Advanced theming and customization
- [ ] Enhanced tool integration (effect and tool call visualization)
- [ ] Widget system expansion
- [ ] Action handling improvements
- [ ] Custom event system
- [ ] WebSocket support (in addition to SSE)
- [ ] Voice input/output
- [ ] Multi-modal attachments (video, audio)

## Contributing

We welcome contributions! Please see our contributing guidelines (coming soon).

### Development Workflow

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Run checks (`pnpm check`)
5. Commit your changes (`git commit -m 'Add amazing feature'`)
6. Push to the branch (`git push origin feature/amazing-feature`)
7. Open a Pull Request

## Support

- 📖 [Documentation](docs/index.md)
- 🐛 [Issue Tracker](https://github.com/xpert-ai/chatkit-js/issues)
- 💬 [Discussions](https://github.com/xpert-ai/chatkit-js/discussions)

## License

This project is licensed under the [Apache License 2.0](LICENSE).

---

Built with ❤️ by the Xpert AI team
