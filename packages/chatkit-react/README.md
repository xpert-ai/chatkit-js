# ChatKit React

React bindings for ChatKit, providing lightweight components and hooks to integrate conversational AI interfaces into React applications.

## Installation

```bash
npm install @xpert-ai/chatkit-react
# or
pnpm add @xpert-ai/chatkit-react
# or
yarn add @xpert-ai/chatkit-react
```

## Quick Start

```tsx
import { useChatKit, ChatKit } from '@xpert-ai/chatkit-react';

function App() {
  const chatkit = useChatKit({
    frameUrl: '<url-to-chatkit-frame>',
    api: {
      apiUrl: 'https://api.xpertai.cn',
      xpertId: 'your-assistant-id',
      getClientSecret: async () => {
        const response = await fetch('/api/create-session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        });
        const data = await response.json();
        return {
          secret: data.client_secret,
          organizationId: data.organization_id,
        };
      }
    },
    pet: true,
    onReady: () => {
      console.log('ChatKit is ready');
    }
  });

  return (
    <div className="h-screen w-full">
      <ChatKit control={chatkit.control} />
    </div>
  );
}
```

## API Reference

### `useChatKit(options)`

A React hook that initializes and manages a ChatKit instance.

#### Parameters

```typescript
interface UseChatKitOptions extends Partial<ChatKitOptions> {
  frameUrl: string;
  api: {
    apiUrl: string;
    xpertId: string;
    getClientSecret: (
      currentClientSecret: string | null,
    ) => Promise<string | { secret: string; organizationId?: string }>;
  };
  locale?: SupportedLocale; // 'en-US' | 'zh-Hans'
  theme?: ThemeOptions;
  composer?: ComposerOptions;
  startScreen?: StartScreenOptions;
  pet?: boolean | ChatKitPetOptions;
  onClientTool?: (params: ClientToolParams) => Promise<ClientToolMessageInput>;
  onError?: (error: Error) => void;
  onReady?: () => void;
  onThreadChange?: (data: { threadId: string }) => void;
  onEffect?: (data: { name: string; data: any }) => void;
}
```

#### Returns

```typescript
interface ChatKitInstance {
  control: ChatKitControl; // Pass to <ChatKit> component
  sendUserMessage: (params: SendMessageParams) => Promise<void>;
  setThreadId: (threadId: string) => Promise<void>;
  // ... other methods
}
```

`getClientSecret` may keep returning the legacy `string`, or return
`{ secret, organizationId }` to have ChatKit send `organization-id` on hosted
API requests.

### `<ChatKit />` Component

The main UI component that renders the chat interface.

#### Props

```typescript
interface ChatKitProps {
  control: ChatKitControl;
  className?: string;
}
```

## Configuration Examples

### Theme Customization

```tsx
const chatkit = useChatKit({
  frameUrl: 'https://chatkit.studio/frame',
  api: { /* ... */ },
  theme: {
    colorScheme: 'light', // or 'dark'
    radius: 'pill', // 'none' | 'small' | 'medium' | 'large' | 'pill'
    density: 'normal', // 'compact' | 'normal' | 'comfortable'
    color: {
      grayscale: {
        hue: 120,
        tint: 6
      },
      accent: {
        primary: '#83e58a',
        level: 2
      }
    },
    typography: {
      baseSize: 16,
      fontFamily: 'Inter, sans-serif',
    }
  }
});
```

### Composer Configuration

```tsx
const chatkit = useChatKit({
  frameUrl: '<url-to-chatkit-frame>',
  api: { /* ... */ },
  composer: {
    attachments: {
      enabled: true,
      maxCount: 5,
      maxSize: 10485760 // 10MB
    },
    tools: [
      {
        id: 'search_docs',
        label: 'Search Documentation',
        shortLabel: 'Search',
        placeholderOverride: 'Ask about our docs...',
        icon: 'book-open',
        pinned: false
      }
    ]
  }
});
```

### Start Screen with Prompts

```tsx
const chatkit = useChatKit({
  frameUrl: '<url-to-chatkit-frame>',
  api: { /* ... */ },
  startScreen: {
    greeting: 'Welcome! How can I help you today?',
    prompts: [
      {
        icon: 'circle-question',
        label: 'What is ChatKit?',
        prompt: 'What is ChatKit?'
      },
      {
        icon: 'lightbulb',
        label: 'Show me examples',
        prompt: 'Can you show me some examples?'
      }
    ]
  }
});
```

### Pet

Pet is disabled by default. Users can enable or disable it from the built-in
Settings panel or with `/pet`, `/pet on`, `/pet off`, and `/pet settings`;
v1 stores those preferences in browser `localStorage`.

`pet: true` enables the default file-backed animated pet from configuration. The
web component renders the pet over the host page viewport, so dragging is not
limited by the ChatKit iframe bounds while the chat panel itself stays in place.
The same `pet` option is part of the shared ChatKit options contract, so this
configuration shape also works in Angular and future Vue bindings.

```tsx
const chatkit = useChatKit({
  frameUrl: '<url-to-chatkit-frame>',
  api: { /* ... */ },
  pet: {
    character: { type: 'sprite-atlas', src: '/pets/boba/spritesheet.webp' },
    position: {
      pin: 'bottom-right',
      draggable: true,
      persist: true,
      scale: 0.25,
    },
  },
});
```

Use `displayMode: 'pet'` to render only the pet launcher at first. Clicking the
pet opens the ChatKit iframe panel; the iframe is not placed in the host layout.
In this launcher mode, the pet cannot be hidden because it is the chat entry
point.

```tsx
const chatkit = useChatKit({
  frameUrl: '<url-to-chatkit-frame>',
  api: { /* ... */ },
  displayMode: 'pet',
  pet: true,
});
```

The settings UI exposes the file-backed pets bundled in
`chatkit-ui/public/pets` as built-in choices. You can also point directly at a
spritesheet-compatible image. Relative `src` values are resolved against the
ChatKit frame URL, not the host page URL, because the pet overlay renders in
the host document.

```tsx
const chatkit = useChatKit({
  frameUrl: '<url-to-chatkit-frame>',
  api: { /* ... */ },
  pet: {
    character: {
      type: 'sprite-atlas',
      src: 'https://example.com/pets/boba/spritesheet.webp',
    },
  },
});
```

### Handling Client Tools

```tsx
const chatkit = useChatKit({
  frameUrl: '<url-to-chatkit-frame>',
  api: { /* ... */ },
  onClientTool: async ({ name, params, id, tool_call_id }) => {
    console.log(`Tool invoked: ${name}`, params);
    
    // Perform tool action
    let result;
    if (name === 'get_weather') {
      result = await fetchWeather(params.location);
    }
    
    return {
      tool_call_id: tool_call_id || id,
      name: name,
      status: 'success',
      content: JSON.stringify(result)
    };
  }
});
```

### Error Handling and Lifecycle Events

```tsx
const chatkit = useChatKit({
  frameUrl: '<url-to-chatkit-frame>',
  api: { /* ... */ },
  onError: (error) => {
    console.error('ChatKit error:', error);
    // Handle error (show toast, etc.)
  },
  onReady: () => {
    console.log('ChatKit initialized successfully');
  },
  onThreadChange: ({ threadId }) => {
    console.log('Thread changed:', threadId);
    // Save thread ID, update URL, etc.
  },
  onEffect: ({ name, data }) => {
    console.log(`Effect triggered: ${name}`, data);
    // Handle custom effects from assistant
  }
});
```

## Common Usage Patterns

### Sending Messages Programmatically

```tsx
function App() {
  const chatkit = useChatKit({ /* ... */ });
  
  const handleSendMessage = () => {
    chatkit.sendUserMessage({
      text: 'Hello, ChatKit!',
      newThread: true
    });
  };
  
  const handleSendWithState = () => {
    chatkit.sendUserMessage({
      text: 'Greet me',
      newThread: true,
      state: {
        user_name: 'Alice',
        preferences: { theme: 'dark' }
      }
    });
  };
  
  return (
    <div>
      <button onClick={handleSendMessage}>Start Conversation</button>
      <button onClick={handleSendWithState}>Send with Context</button>
      <ChatKit control={chatkit.control} />
    </div>
  );
}
```

### Thread Management

```tsx
function App() {
  const [threads, setThreads] = useState<string[]>([]);
  const chatkit = useChatKit({
    /* ... */
    onThreadChange: ({ threadId }) => {
      if (threadId && !threads.includes(threadId)) {
        setThreads(prev => [...prev, threadId]);
      }
    }
  });
  
  const switchThread = (threadId: string) => {
    chatkit.setThreadId(threadId);
  };
  
  return (
    <div>
      <aside>
        <h3>Threads</h3>
        {threads.map(id => (
          <button key={id} onClick={() => switchThread(id)}>
            {id}
          </button>
        ))}
      </aside>
      <ChatKit control={chatkit.control} />
    </div>
  );
}
```

### Internationalization

```tsx
import { useState } from 'react';
import type { SupportedLocale } from '@xpert-ai/chatkit-types';

function App() {
  const [locale, setLocale] = useState<SupportedLocale>('en-US');
  
  const chatkit = useChatKit({
    locale,
    /* ... */
  });
  
  return (
    <div>
      <select 
        value={locale} 
        onChange={(e) => setLocale(e.target.value as SupportedLocale)}
      >
        <option value="en-US">English</option>
        <option value="zh-Hans">简体中文</option>
      </select>
      <ChatKit control={chatkit.control} />
    </div>
  );
}
```

## TypeScript Support

This package is written in TypeScript and includes full type definitions.

```typescript
import type { 
  ChatKitOptions,
  ChatKitPetOptions,
  ClientToolMessageInput,
  SupportedLocale 
} from '@xpert-ai/chatkit-types';
```

## Requirements
React >= 18
- React DOM >= 18

## Related Packages

- `@xpert-ai/chatkit` - Core ChatKit library
- `@xpert-ai/chatkit-types` - TypeScript type definitions
- `@xpert-ai/chatkit-ui` - Pre-built UI components

## License

See LICENSE file in the repository root.
