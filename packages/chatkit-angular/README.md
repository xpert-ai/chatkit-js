# @xpert-ai/chatkit-angular

Angular 17+ standalone bindings for Xpert Chatkit.

## Local Demo

From the repository root:

```bash
pnpm dev:ui
pnpm managed-chatkit-angular:dev
```

Then open `http://localhost:5175`.

## Install

```bash
pnpm add @xpert-ai/chatkit-angular @angular/core
```

## Usage

```ts
import { Component } from '@angular/core';
import { ChatKitElement, createChatKit } from '@xpert-ai/chatkit-angular';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [ChatKitElement],
  template: `
    <xpertai-chatkit
      [control]="chatkit"
      style="display: block; height: 100vh;"
    ></xpertai-chatkit>
  `,
})
export class AppComponent {
  readonly chatkit = createChatKit({
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
      },
    },
    pet: true,
    onReady: () => {
      console.log('ChatKit is ready');
    },
  });
}
```

`getClientSecret` may return the legacy `string`, or return
`{ secret, organizationId }` to forward `organization-id` on hosted API calls.

### Pet

Pet is disabled by default. Users can enable or disable it from the built-in
Settings panel or with `/pet`, `/pet on`, `/pet off`, and `/pet settings`;
v1 stores those preferences in browser `localStorage`.

`pet: true` enables the default file-backed animated pet from configuration. The
web component renders the pet over the host page viewport, so dragging is not
limited by the ChatKit iframe bounds while the chat panel itself stays in place.
The same `pet` option is part of the shared ChatKit options contract, so the
configuration shape also works for React and future Vue bindings.

```ts
readonly chatkit = createChatKit({
  // ...api/frame options
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

```ts
readonly chatkit = createChatKit({
  // ...api/frame options
  displayMode: 'pet',
  pet: true,
});
```

The settings UI exposes the file-backed pets bundled in
`chatkit-ui/public/pets` as built-in choices. You can also point directly at a
spritesheet-compatible image. Relative `src` values are resolved against the
ChatKit frame URL, not the host page URL, because the pet overlay renders in
the host document.

```ts
pet: {
  character: {
    type: 'sprite-atlas',
    src: 'https://example.com/pets/boba/spritesheet.webp',
  },
}
```

If you prefer a wrapper component, `ChatKit` is also exported and renders the
same web component for you:

```ts
import { ChatKit } from '@xpert-ai/chatkit-angular';
```

## API

### `createChatKit(options)`

Creates a `ChatKitControl` instance that stores ChatKit options and exposes the
web component methods:

- `setOptions(next)`
- `focusComposer()`
- `setThreadId(threadId)`
- `sendUserMessage(params)`
- `setComposerValue(params)`
- `fetchUpdates()`
- `sendCustomAction(action, itemId?)`

### `<xpert-chatkit />`

Standalone Angular component that mounts the underlying `xpertai-chatkit` web
component for you. No `CUSTOM_ELEMENTS_SCHEMA` setup is required.

### `<xpertai-chatkit />`

Import `ChatKitElement` to use the real custom element directly in Angular
templates with the same attribute surface as the React and Vue bindings.

### Shared option: `pet`

- `false` / omitted: disabled
- `true`: default file-backed Boba pet
- `{ character: { type: 'sprite-atlas', src, atlas? } }`
