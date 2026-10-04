# Web Component Development

The current element is `xpertai-chatkit`. Its configuration enters through `setOptions`; see [Integration](./INTEGRATION.md) for a complete mounting example. Legacy `xpert-chatkit` attributes and manual `chatkit:init` messages are not the current bridge protocol.

## Local setup

Install workspace dependencies from the repository root:

```sh
corepack pnpm install --frozen-lockfile
```

Start the ChatKit UI in one terminal:

```sh
corepack pnpm dev:ui
```

In another terminal, start the Web Component development server:

```sh
corepack pnpm --filter @xpert-ai/chatkit-web-component serve
```

Vite's Web Component configuration uses port 3001 and proxies `/api` to a backend on port 8000. The UI development server normally uses port 5173. These services are separate: the Web Component hosts the frame; a host backend supplies scoped session credentials; the platform API serves the Assistant. Use the actual configured URLs and do not assume a port proves which working tree is being served.

The package's `index.html` and `example.html` contain legacy configuration examples. For the current API, use the mounting code in [Integration](./INTEGRATION.md) or a maintained framework host. A dev server successfully serving those legacy pages does not prove current integration compatibility.

## Development modes

- `serve`: Vite development server for source changes.
- `dev`: build watch mode for testing generated files from another host.
- `build`: production library and declaration build.
- `preview`: serve the built output locally.

```sh
corepack pnpm --filter @xpert-ai/chatkit-web-component dev
corepack pnpm --filter @xpert-ai/chatkit-web-component build
```

Build outputs are `dist/xpert-chatkit.js`, `dist/xpert-chatkit.umd.cjs`, and TypeScript declarations. Serve examples through HTTP(S), not `file://`. Changes to a wrapper do not rebuild the separately deployed iframe app.

## Checks

```sh
corepack pnpm --filter @xpert-ai/chatkit-web-component test
corepack pnpm --filter @xpert-ai/chatkit-web-component type-check
corepack pnpm --filter @xpert-ai/chatkit-web-component build
```

Use targeted tests for changes to initialization, option serialization, callbacks, frame identity, events, and cleanup. During browser acceptance:

1. Confirm `xpertai-chatkit` is registered and has an explicit container size.
2. Supply complete options, including `frameUrl`, before mounting.
3. Confirm the frame loads the intended ChatKit bundle and emits `chatkit.ready`.
4. Confirm the host's credential callback succeeds in the selected organization.
5. Exercise a real interaction, then update options and verify the same frame remains mounted.
6. Dispose the owning view and check bridge/overlay cleanup.

A frame load is separate from successful authentication or Agent execution. Inspect each boundary independently.

## Debugging

Inspect the element and frame without dumping credentials or initialization payloads:

```js
const element = document.querySelector('xpertai-chatkit');
const frame = element?.shadowRoot?.querySelector('iframe');
console.log({
  registered: Boolean(customElements.get('xpertai-chatkit')),
  mounted: Boolean(element?.isConnected),
  hasFrame: Boolean(frame),
});
```

Use Network tools to inspect the document origin/path and HTTP status, session endpoint failures, CORS, and embedding-policy errors. Avoid logging full iframe URLs, URL fragments, session response bodies, or raw bridge messages; they can contain initialization data.

For option changes, verify that callbacks remain in the full options object and that the served UI supports the setting. For SDK upgrades affecting the iframe, use the [released-SDK development flow](../../docs/guides/remote-views-workbench.md#local-testing-with-the-released-sdk).

## Source map

| Path                        | Responsibility                                            |
| --------------------------- | --------------------------------------------------------- |
| `src/xpert-chatkit.ts`      | Registers the custom element                              |
| `src/ChatKitElement.ts`     | ChatKit profile and option sanitization                   |
| `src/ChatKitElementBase.ts` | Frame lifecycle, options, events, commands, and callbacks |
| `src/ChatFrameMessenger.ts` | Typed host/frame messenger                                |
| `src/PetOverlay.ts`         | Host-side pet overlay integration                         |
| `vite.config.ts`            | Dev server, proxy, and library build                      |
| `INTEGRATION.md`            | Current host integration contract                         |

Shared protocol/types live in `@xpert-ai/chatkit-web-shared` and `@xpert-ai/chatkit-types`. Keep changes compatible across the host component and the actual UI bundle; validate both sides before following the repository release workflow.
