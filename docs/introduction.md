# ChatKit

ChatKit is a framework-agnostic, drop-in chat solution for building AI-powered conversational experiences. Whether you're developing an internal knowledge base assistant, customer support agent, data analysis companion, or any other conversational AI application, ChatKit provides a fully customizable chat embed that handles all the user experience details.

You don't need to build custom UIs, manage low-level chat state, or patch together various features yourself. ChatKit offers embeddable UI widgets, customizable themes, tool invocation support, file attachments, and seamless integration with the XpertAI platform.

## Key Features

- **Embeddable UI Widgets** — Drop-in React components or Web Components that integrate seamlessly into any frontend application
- **Customizable Theming** — Full control over colors, typography, spacing, and layout to match your brand
- **Tool Invocation Support** — Enable AI agents to call server-side and client-side tools during conversations
- **File Attachments** — Support for uploading and processing files within the chat interface
- **Real-time Streaming** — Stream responses as they're generated for a responsive user experience
- **Multi-platform Support** — Works with React, Vue, vanilla JavaScript, and any web framework

## Architecture

ChatKit uses a web component architecture that communicates with your backend through the ChatKit protocol. The frontend embed handles all UI rendering, state management, and user interactions, while your backend focuses on AI logic and business rules.

<!-- TODO: Replace with actual architecture diagram -->
![ChatKit Architecture](./images/chatkit-architecture_en.png)

The architecture consists of three layers:

| Layer | Description |
|-------|-------------|
| **Frontend Embed** | ChatKit web component or React component embedded in your application |
| **Session Backend** | Your server that manages authentication and session tokens |
| **AI Platform** | XpertAI platform running your configured agents and tools |

## Quick Start

### Installation

```bash
# For React applications
npm install @xpert-ai/chatkit-react

# For vanilla JavaScript or other frameworks
npm install @xpert-ai/chatkit
```

### React Integration

```tsx
import { useChatKit, ChatKit } from '@xpert-ai/chatkit-react';

function App() {
  const chatkit = useChatKit({
    api: {
      getClientSecret: async () => {
        const response = await fetch('/api/create-session', {
          method: 'POST',
          credentials: 'include',
        });
        const data = await response.json();
        return data.client_secret;
      },
    },
    theme: {
      colorScheme: 'light',
      radius: 'round',
    },
  });

  return <ChatKit control={chatkit.control} className="h-screen" />;
}
```

### Vanilla JavaScript Integration

```html
<script type="module">
  import { ChatKitElement } from '@xpert-ai/chatkit';

  const chatkit = document.createElement('xpert-chatkit');
  chatkit.setOptions({
    api: {
      getClientSecret: async () => {
        const response = await fetch('/api/create-session', { method: 'POST' });
        const data = await response.json();
        return data.client_secret;
      },
    },
  });

  document.getElementById('chat-container').appendChild(chatkit);
</script>
```

## Core Concepts

### Server Tools

Server tools run on your backend. The AI agent can call them during a conversation to fetch data, run workflows, or perform any server-side operation.

```python
@function_tool()
async def search_documents(query: str) -> list[dict]:
    """Search the knowledge base for relevant documents."""
    results = await knowledge_base.search(query)
    return [{"title": doc.title, "content": doc.content} for doc in results]
```

### Client Tools

Client tools run in the browser. They enable the AI to interact with the user's local environment—reading application state, triggering UI updates, or calling client-side APIs.

```typescript
const chatkit = useChatKit({
  // ...
  onClientTool: async ({ name, params, tool_call_id }) => {
    if (name === 'render_chart') {
      renderChart(params.option);
      return {
        tool_call_id,
        name,
        status: 'success',
        content: 'Chart rendered successfully.',
      };
    }
  },
});
```

When a client tool is invoked:

1. The AI stream pauses (interrupts)
2. ChatKit sends the tool call to your frontend
3. Your `onClientTool` handler processes it and returns a result
4. The AI stream resumes with the tool result

This interrupt/resume flow enables powerful patterns like rendering visualizations, reading user selections, or updating application state mid-conversation.

### Theming

Customize the look and feel to match your brand:

```typescript
const chatkit = useChatKit({
  theme: {
    colorScheme: 'dark',
    radius: 'round',
    density: 'comfortable',
    typography: {
      baseSize: 15,
      fontFamily: 'Inter, system-ui, sans-serif',
    },
    color: {
      accent: {
        primary: '#6366f1',
        level: 2,
      },
    },
  },
});
```

## Integration with XpertAI Platform

ChatKit is designed to work seamlessly with the XpertAI platform. Configure your agents, tools, and workflows in the XpertAI console, then connect them to ChatKit with a simple session API.

### Session Flow

```
┌──────────────┐      ┌──────────────┐      ┌──────────────┐
│   Frontend   │      │ Your Backend │      │   XpertAI    │
│   (ChatKit)  │      │              │      │   Platform   │
└──────┬───────┘      └──────┬───────┘      └──────┬───────┘
       │                     │                     │
       │ 1. Request session  │                     │
       │────────────────────>│                     │
       │                     │                     │
       │                     │ 2. Create session   │
       │                     │────────────────────>│
       │                     │                     │
       │                     │ 3. Return token     │
       │                     │<────────────────────│
       │                     │                     │
       │ 4. Return secret    │                     │
       │<────────────────────│                     │
       │                     │                     │
       │ 5. Connect & chat   │                     │
       │─────────────────────────────────────────->│
       │                     │                     │
```

### Backend Session Endpoint

Your backend exchanges credentials for a client session token:

```python
from fastapi import FastAPI
import httpx

app = FastAPI()

@app.post("/api/create-session")
async def create_session():
    async with httpx.AsyncClient() as client:
        response = await client.post(
            "https://api.xpertai.com/v1/chatkit/sessions",
            headers={
                "Authorization": f"Bearer {XPERTAI_API_KEY}",
                "Content-Type": "application/json",
            },
            json={
                "assistant": {"id": ASSISTANT_ID},
                "user": current_user_id,
            },
        )

    data = response.json()
    return {"client_secret": data["client_secret"]}
```

## Examples

Explore working examples to see ChatKit in action:

| Example | Description |
|---------|-------------|
| [Managed ChatKit](https://github.com/xpert-ai/chatkit-js/tree/main/examples/managed-chatkit) | Basic integration with the XpertAI platform |
| [Excel ECharts](https://github.com/xpert-ai/chatkit-js/tree/main/examples/excel-echarts-chatkit) | Data visualization with client tools |

Clone the repository to get started:

```bash
git clone https://github.com/xpert-ai/chatkit-js.git
cd chatkit-js
pnpm install
pnpm managed-chatkit:dev
```

## Next Steps

- **[Tools Guide](./concepts/tools.md)** — Learn about server tools and client tools in depth
- **Theming Guide** *(Coming Soon)* — Customize ChatKit's appearance
- **API Reference** *(Coming Soon)* — Complete configuration options
- **[XpertAI Console](https://console.xpertai.com)** — Configure your agents and workflows

## What Makes ChatKit Different

| Feature | ChatKit | Build from Scratch |
|---------|---------|-------------------|
| Time to integrate | Minutes | Weeks |
| UI components | Ready to use | Build yourself |
| Streaming support | Built-in | Implement yourself |
| Tool invocation | Declarative | Complex state management |
| Theming | CSS variables | Custom styling |
| Maintenance | Managed updates | Ongoing effort |

ChatKit lets you focus on your AI logic and user experience, not on rebuilding chat infrastructure.
