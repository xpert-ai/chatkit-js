# ChatKit UI

This package contains the UI application rendered inside the ChatKit iframe, providing the chat experience and its in-iframe UI shell.

## Role in the ChatKit project

- Hosts the web UI that runs inside the embedded ChatKit iframe.
- Implements the chat view, message rendering, and interactive widgets for end users.
- Serves as the iframe-facing surface that communicates with the host app via ChatKit APIs.

## Assistant Workbench layout

The chat / Workbench split remembers its chat width, open state and maximized
state on this device, scoped by API service, organization and Assistant. Switching
conversations keeps the same layout; reopening an Assistant or reloading the frame
restores it once compatible Workbench views are available. No server settings or
conversation data are written for this preference.

Chat width is stored in CSS pixels and clamped to fit the current window. Temporary
window constraints do not overwrite the preferred width. Narrow screens use a
temporary drawer layout without changing the saved desktop layout. Corrupt or
unavailable browser storage falls back to the default layout.

## Browser regression tests

Run `corepack pnpm --filter @xpert-ai/chatkit-ui exec playwright install chromium`
once, then `corepack pnpm --filter @xpert-ai/chatkit-ui test:browser` from the
repository root. The command builds the Web Component and iframe application
before testing, so a clean checkout needs no pre-existing `dist` files. Tests
cover initialization on HTTP and HTTPS origins, plus hosted Workbench navigation
through the Web Component and sandboxed Remote View. No backend or credentials
are required, and Web Crypto is not mocked.

CI uses Ubuntu 26.04, Node.js 24 and the pinned Playwright version in this package.
When updating Playwright or the runner OS, verify that Playwright supports that OS
and rerun browser installation with `--with-deps` before the regression suite.

UUID generation supports HTTP through `crypto.getRandomValues`. HTTPS is still
recommended: other browser features, including the clipboard, can require a
secure context independently of UUID generation.

## External pet assets (migration)

The UI npm package no longer includes `dist/app/pets`. Deployments that copied
that directory must provision the optional `@xpert-ai/chatkit-assets` package and
copy its `pets` directory to `/pets`, or host it on a CDN. `dist/app`, the JS/CSS
assets, and font handling are unchanged.

Set `ChatKitPetOptions.assetsBaseUrl` to a versioned URL or root-relative resource path.
Set it inside `pet: { assetsBaseUrl: ... }`. It is scoped per instance and applies to built-in settings choices, Assistant
appearance sprites, and host overlays. The default is `/pets`; custom sprite URLs
remain unchanged. The resource address is still available to Assistant appearance
sprites when `pet.enabled` is false. Saved built-in selections keep their IDs when the base changes.
See [the offline resource package](../chatkit-assets/README.md) for deployment and
cache instructions. Local `vite` development serves that package at `/pets`
without copying images into the production build. `vite preview` needs separately
hosted assets, just like a production deployment.

## Standalone Xpert web updates

The hosted app opts into deployment updates only when it is the top-level page
and its HTML includes `xpert-web-build` and `xpert-web-version` meta tags. Xpert's
Webapp build owns these values and the same-origin `/version.json`
(`{ "buildId": "...", "version": "..." }`). This file is a static deployment
resource, not an authenticated platform API.

Opted-in pages check on startup, every visible minute, foreground/network
recovery and failed bundle loading. A persistent bottom-left notice offers an
update; closing it suppresses only that build in the current tab. The header's
actions menu retains About → Update. Refresh requires confirmation and the same
editor coordinator used by `prepareLeave`, including save failure and timeout
handling. It preserves login and URL state, verifies the loaded build and never
automatically loops reloads. The update portals use the current theme tokens.

Embeds remain managed by their host and unmarked third-party pages do not poll or
gain an update menu. `build:app` emits `xpert-web-update.json` with
`schemaVersion: 1` so deployment packaging can verify support. Publish this UI
patch before updating the Xpert dependency locks; for local integration, point
Xpert's `CHATKIT_APP_SOURCE` to this package's `dist/app` after building it.
