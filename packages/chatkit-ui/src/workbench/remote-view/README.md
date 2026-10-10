# Remote view file previews

Remote views keep an opaque origin (`allow-same-origin` is deliberately absent).
They cannot load the workspace service's cookie-bound content URLs directly.
Chromium also rejects a host-created `blob:` URL inside that iframe because its
storage partition differs from the host's.

For `requestFileAccess` with `purpose: preview` or `download`, the trusted ChatKit host creates
the normal scoped session and grant, then reads the bytes with
`Client.viewHosts.readFileAccess`. The SDK uses the authenticated
`/api/ai/workspace-files/view-sessions/:sessionId/grants/:grantId/content/:fileName`
route and does not depend on browser cookies, including when ChatKit itself is
embedded cross-site. It returns a self-contained data URL through
the existing `fileAccessResult` contract. No plugin changes or customer settings
are needed. The result preserves filename, MIME type and grant expiry so views
can keep using their existing refresh logic.

The host validates scope, expiry and cancellation before returning preview
content. Changing scope or closing the view invalidates pending reads and
revokes the server session. It does not keep an additional content cache. Never
log a preview URL: it contains private file bytes. As with any already displayed
image, session revocation cannot recall bytes already delivered to the view.

## SDK dependency

Use the published `@xpert-ai/xpert-sdk` version `^0.8.2`, which provides the
authenticated-content transport without local dependency patches. The lockfile
resolves the published `0.8.2` package for reproducible installs.
The platform must also provide the authenticated runtime content endpoint;
deploy the platform before the updated ChatKit. Old cookie-bound content URLs
remain available for existing consumers.

Run `corepack pnpm install --frozen-lockfile` and `corepack pnpm check:sdk`.
Do not replace the SDK with native fetch in ChatKit or loosen iframe isolation.
The installed-SDK regression test verifies the runtime route, omitted cookies,
binary response and configured authentication transport. The data URL bridge
remains necessary for isolated Remote View iframes.
