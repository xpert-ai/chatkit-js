# Web Component Integration

The package registers `xpertai-chatkit`, a custom element that hosts the ChatKit UI in an iframe. Configure it with the shared ChatKit options and let the built-in bridge manage initialization and callbacks. The old `xpert-chatkit` attributes and `chatkit:init` example protocol are not the current integration API.

## Install and mount

```sh
npm install @xpert-ai/chatkit-web-component
```

The following JavaScript is intended for a bundled application:

```js
import '@xpert-ai/chatkit-web-component';

await customElements.whenDefined('xpertai-chatkit');

const element = document.createElement('xpertai-chatkit');
const options = {
  frameUrl: 'https://your-ui.example.com/chatkit/index.html',
  api: {
    apiUrl: 'https://your-xpert.example.com/api',
    xpertId: 'your-assistant-id',
    async getClientSecret(currentClientSecret) {
      // Your backend issues or refreshes a scoped ChatKit session.
      const response = await fetch('/api/chatkit/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentClientSecret }),
      });
      if (!response.ok) throw new Error('Unable to create a ChatKit session');
      const session = await response.json();
      return {
        secret: session.client_secret,
        organizationId: session.organizationId,
      };
    },
  },
  theme: { colorScheme: 'light', radius: 'round' },
};

// Register handlers and set complete options before mounting.
element.addEventListener('chatkit.ready', () => {
  console.log('ChatKit frame loaded');
});
element.addEventListener('chatkit.error', (event) => {
  console.error(event.detail.error.message);
});
element.setOptions({ ...options });
document.getElementById('chatkit-root').appendChild(element);
```

Give the container an explicit size:

```css
#chatkit-root {
  width: 100%;
  height: 100dvh;
}

xpertai-chatkit {
  display: block;
  width: 100%;
  height: 100%;
}
```

`frameUrl` identifies the deployed ChatKit UI, not the platform API. It must be a nonempty URL supplied before initialization. A different frame URL requires a new element after initialization. Serve a UI bundle compatible with the shared types and wrapper packages.

## Backend authentication

`/api/chatkit/session` above is an example host endpoint, not an endpoint implemented by the Web Component. The host backend authenticates the user and obtains the authorized ChatKit session through the platform's SDK. The callback receives the current secret or `null`, so it can issue or refresh credentials.

`getClientSecret` may return a secret string or an object with `secret` and optional `organizationId`, `xpertId`, or `assistantId`. Returning the organization context allows ChatKit to send the corresponding organization header. Never treat a display title or client-supplied organization ID as proof of access; preserve server authorization.

Keep platform credentials on the backend and return only the scoped session credential. Do not log client secrets or bridge payloads. Configure CORS and iframe embedding policy for the actual host and UI origins.

## Runtime configuration

Call `setOptions` with the full next configuration, retaining authentication callbacks and other settings:

```js
element.setOptions({
  ...options,
  theme: { ...options.theme, colorScheme: 'dark' },
});
```

Theme and other supported option changes are sent through the existing bridge without replacing the iframe. Arbitrary CSS-like `style-config` fields are not the supported theme contract. See [ChatKit options](../chatkit/src/options.ts) for valid settings and [updating the client during a response](../../docs/guides/update-client-during-response.md) for runtime behavior.

## Events, commands, and cleanup

The element exposes events including `chatkit.ready`, `chatkit.error`, `chatkit.response.start`, `chatkit.response.end`, and `chatkit.thread.change`. A ready event means the frame loaded; it does not prove backend authentication or a successful Agent run.

Public commands and callbacks are handled by the component's capability-aware messenger. Hosts should not implement a second raw `postMessage` initialization protocol. The bridge serializes transferable options and routes function callbacks to the host; cross-origin frames remain isolated.

Remove the element when its owning view is disposed. Its disconnect lifecycle releases bridge and overlay resources. If using the JavaScript helper, call the helper's `destroy()` method. Recreate the element when switching to a different UI deployment.

## Frameworks and distribution

React, Vue, and Angular can use their dedicated ChatKit wrappers, all sharing the same options contract. A plain JavaScript host can use `@xpert-ai/chatkit-js`; see [Framework-agnostic integration](../../docs/guides/framework-agnostic-integration.md). Frameworks embedding the element directly must allow the `xpertai-chatkit` custom element and pass options as a JavaScript object, not serialized HTML attributes containing callbacks.

The build emits an ES module, a UMD bundle, and TypeScript declarations in `dist/`. Import the npm package through a bundler, or deploy the built browser bundle to an approved static host. Package publication follows the repository [release workflow](../../docs/release.md).

Use a modern browser supporting custom elements, Shadow DOM, and the APIs required by the embedded UI. A custom-element polyfill alone is not evidence of compatibility with the complete ChatKit app; validate the actual target browsers.

## Troubleshooting

- **Unregistered element:** confirm the package import ran and wait for `customElements.whenDefined('xpertai-chatkit')`.
- **Blank iframe:** check container height, `frameUrl`, HTTP status, and embedding policy. The URL must serve ChatKit rather than a host SPA fallback.
- **Authentication failure:** inspect the host session endpoint status and scoped organization context without logging credentials. Do not replace a missing session with a fallback prompt.
- **Options appear unchanged:** provide complete options and confirm the UI bundle supports them. Updating wrapper types alone does not update a deployed iframe.
- **Changing frame URL throws:** create a new element for a different frame deployment.
