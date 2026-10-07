# Remote view file previews

Remote views keep an opaque origin (`allow-same-origin` is deliberately absent).
They cannot load the workspace service's cookie-bound content URLs directly.
Chromium also rejects a host-created `blob:` URL inside that iframe because its
storage partition differs from the host's.

For `requestFileAccess` with `purpose: preview` or `download`, the trusted ChatKit host creates
the normal scoped session and grant, then reads the bytes with
`Client.viewHosts.readFileAccess`. It returns a self-contained data URL through
the existing `fileAccessResult` contract. No plugin changes or customer settings
are needed. The result preserves filename, MIME type and grant expiry so views
can keep using their existing refresh logic.

The host validates scope, expiry and cancellation before returning preview
content. Changing scope or closing the view invalidates pending reads and
revokes the server session. It does not keep an additional content cache. Never
log a preview URL: it contains private file bytes. As with any already displayed
image, session revocation cannot recall bytes already delivered to the view.

## SDK dependency

Use the published `@xpert-ai/xpert-sdk` version `^0.8.0`, which provides
`viewHosts.readFileAccess` and snapshot-free pause requests without local patches.
Run `corepack pnpm install --frozen-lockfile` and `corepack pnpm check:sdk`.
Do not replace this with a native fetch in ChatKit or loosen iframe isolation.

The installed-SDK regression test verifies that granted content is read from the
server-issued URL with the configured authentication transport. The data URL
bridge remains necessary for isolated iframes; it is independent of SDK version
compatibility.
