# @xpert-ai/chatkit-browser-extension

Chrome Manifest V3 extension host for the Xpert ChatKit web component.

The extension provides two surfaces:

- Chrome side panel
- Page overlay injected on demand into the active HTTP(S) tab

Both surfaces render the same `xpertai-chatkit` web component and read their
configuration from `chrome.storage.local`.

## Build

From the repository root:

```bash
pnpm --filter @xpert-ai/chatkit-browser-extension build
```

The Chrome extension is emitted to:

```text
packages/browser-extension/dist/chrome
```

Load that directory from `chrome://extensions` with Developer Mode enabled.

## GitHub Browser Extension Publishing

The `Publish Browser Extension` workflow publishes this package to the Chrome
Web Store after the root `Release` workflow succeeds on `main`. Add
`@xpert-ai/chatkit-browser-extension` to a changeset so `pnpm changeset version`
bumps the package version in the release PR before publishing.

Required repository secrets:

- `CHROME_CLIENT_ID`
- `CHROME_CLIENT_SECRET`
- `CHROME_REFRESH_TOKEN`
- `CHROME_PUBLISHER_ID`
- `CHROME_EXTENSION_ID`

The workflow only publishes automatically when the package version changes. It
also supports manual dispatch for re-running the current version. In both cases,
it builds `dist/chrome`, uploads the zip as a GitHub Actions artifact, then
uploads and publishes the same zip through the Chrome Web Store API.

## Configure

Open the extension options page and set:

- `frameUrl`
- `apiUrl`
- `xpertId`
- `Client Secret / API Key`
- launch mode (`Pet launcher` by default, or `Chat panel`)
- locale (`en` and `zh-Hans` are supported by the extension UI) and theme
- enabled surfaces
- automatic page pet launch on new HTTP(S) tabs
- page overlay size and position
- host page automation for agent client tools

Host page automation uses the Chrome `debugger` permission when available so it
can collect CDP snapshots and dispatch browser-level mouse/keyboard input. If
CDP is unavailable, the extension falls back to the content-script DOM executor.

The first version uses manual credentials. The extension does not call Xpert
APIs directly and does not use native `fetch` to reach the platform. Instead,
the ChatKit options passed to the web component include `api.getClientSecret`,
which returns the stored `Client Secret / API Key`.

## Local Frame Testing

For local ChatKit development, point `frameUrl` at a local Vite server such as
`http://localhost:5173/`. The generated Chrome manifest explicitly allows
extension pages to embed HTTP/HTTPS frame URLs with non-default ports, and adds
localhost host permissions for local testing.

If Chrome still shows a blocked-frame page, reload the unpacked extension after
building and confirm the local frame server is not sending `X-Frame-Options` or
`Content-Security-Policy: frame-ancestors` headers that prevent embedding.

## Development Checks

```bash
pnpm --filter @xpert-ai/chatkit-browser-extension type-check
pnpm --filter @xpert-ai/chatkit-host-automation test
pnpm --filter @xpert-ai/chatkit-browser-extension test
pnpm --filter @xpert-ai/chatkit-browser-extension build
```

## Browser Scope

Only Chrome MV3 is generated today. The source keeps Chrome-specific behavior
behind `src/platform/chrome` so future Edge or Firefox adapters can add their
own manifest and API shims without changing the ChatKit host code.
