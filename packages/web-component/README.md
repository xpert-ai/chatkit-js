# Xpert Chatkit Web Component

A native Web Component for embedding Xpert Chatkit into any web application.

## Features

- 🚀 Zero dependencies - pure native Web Component
- 📦 Lightweight and tree-shakeable
- 🎨 Style configuration support via JSON schema
- 🔒 Secure session management
- ⚡ Loading and error states built-in
- 🌐 Works with any framework (React, Vue, Angular, vanilla JS)

## Installation

```bash
npm install @xpert-ai/chatkit-web-component
```

Or use via CDN:

```html
<script src="https://unpkg.com/@xpert-ai/chatkit-web-component/dist/xpert-chatkit.js"></script>
```

## Usage

### Basic Example

```html
<!DOCTYPE html>
<html>
<head>
  <script src="https://unpkg.com/@xpert-ai/chatkit-web-component/dist/xpert-chatkit.js"></script>
  <style>
    xpert-chatkit {
      width: 100%;
      height: 600px;
    }
  </style>
</head>
<body>
  <xpert-chatkit
    backend-url="https://your-backend.com"
    chatkit-url="https://chatkit.xpert.ai"
    assistant-id="assistant_123">
  </xpert-chatkit>
</body>
</html>
```

### With Style Configuration

```html
<xpert-chatkit
  backend-url="https://your-backend.com"
  chatkit-url="https://chatkit.xpert.ai"
  assistant-id="assistant_123"
  style-config='{"primaryColor": "#007bff", "fontSize": "14px"}'>
</xpert-chatkit>
```

### Programmatic Usage

```javascript
import '@xpert-ai/chatkit-web-component';

// Create element
const chatkit = document.createElement('xpert-chatkit');
chatkit.setAttribute('backend-url', 'https://your-backend.com');
chatkit.setAttribute('chatkit-url', 'https://chatkit.xpert.ai');
chatkit.setAttribute('assistant-id', 'assistant_123');

// Update style config
chatkit.updateStyleConfig({
  primaryColor: '#007bff',
  fontSize: '14px'
});

document.body.appendChild(chatkit);
```

## Attributes

| Attribute | Required | Description |
|-----------|----------|-------------|
| `backend-url` | Yes | Backend API URL for session creation |
| `chatkit-url` | Yes | Chatkit iframe URL |
| `assistant-id` | No | Assistant ID to use |
| `style-config` | No | JSON string for style configuration |

## Methods

### `updateStyleConfig(config: Record<string, unknown>)`

Updates the style configuration. Note: Currently only applied on initial load.

```javascript
const chatkit = document.querySelector('xpert-chatkit');
chatkit.updateStyleConfig({
  primaryColor: '#ff0000',
  borderRadius: '8px'
});
```

## Styling

The component automatically fills its container. You can control its size with CSS:

```css
xpert-chatkit {
  width: 100%;
  height: 100vh;
}

/* Or fixed size */
xpert-chatkit {
  width: 400px;
  height: 600px;
}

/* In a flex/grid container */
.container {
  display: flex;
  height: 100vh;
}

xpert-chatkit {
  flex: 1;
}
```

## Error Handling

The component displays loading and error states automatically:
- Shows "Creating session..." while fetching client secret
- Shows error message if session creation fails
- Logs errors to console with `[xpert-chatkit]` prefix

## Browser Support

- Chrome/Edge 54+
- Firefox 63+
- Safari 10.1+
- All modern browsers with Custom Elements v1 support

For older browsers, you may need the [Web Components polyfill](https://github.com/webcomponents/polyfills).

## Development

```bash
# Install dependencies
npm install

# Start development server (recommended)
npm run serve

# Build for production
npm run build

# Watch mode (build on change)
npm run dev

# Type check
npm run type-check
```

For detailed development instructions, see [DEVELOPMENT.md](./DEVELOPMENT.md).

## License

MIT
