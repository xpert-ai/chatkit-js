# @xpert-ai/chatkit-ui

React UI components for building ChatKit experiences in React.

## Quick Start

### Development

From project root:

```bash
pnpm dev:ui
```

Or in this directory:

```bash
pnpm dev
```

Dev server runs on http://localhost:5173.

### Build

```bash
pnpm build
```

## Components

### Chat Components

- `BasicChat` - Minimal shadcn-style chat UI scaffold
- `EnhancedChat` - Full-featured chat with history sidebar

### UI Primitives

- `Avatar`
- `Badge`
- `Button`
- `Card`
- `Input`
- `Popover`
- `ScrollArea`
- `Separator`
- `Sheet`
- `Tabs`
- `Tooltip`

## Usage

```tsx
import { BasicChat } from '@xpert-ai/chatkit-ui';

export function App() {
  return <BasicChat className="h-[600px]" />;
}
```

## Configuration

The dev server proxies `/api/ai` to `http://localhost:3000` by default. Configure in `vite.config.ts`.
