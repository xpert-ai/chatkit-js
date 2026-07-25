# Remote Views Workbench

ChatKit can discover iframe-based Xpert extension views and display them in a
right-side workbench. The feature is opt-in and remains disabled unless
`workbench.enabled` is exactly `true`.

```ts
import type { ChatKitOptions } from '@xpert-ai/chatkit-types';

const options: ChatKitOptions = {
  api: {
    apiUrl: 'https://api.example.com/api/ai',
    xpertId: 'assistant-id',
    getClientSecret: async () => 'client-secret',
  },
  workbench: {
    enabled: true,
    async onClientCommand(request) {
      if (request.commandKey === 'workbench.file.open') {
        openFile(request.payload);
        return { success: true };
      }
      throw new Error(`Unsupported client command: ${request.commandKey}`);
    },
  },
};
```

When enabled, ChatKit preloads manifests from the
`agent.workbench.fixed` slot for the configured `xpertId`. It displays only
visible `remote_component` views whose component isolation is `iframe`.
Remote HTML is fetched only after the user opens the workbench.

On wide containers the workbench is a resizable split panel. Below 960px it
opens as a right-side drawer. The active view and split size are kept only for
the current ChatKit mount.

## Theme

Remote Views inherit the existing top-level `options.theme` configuration; no
separate workbench theme is required. ChatKit resolves that configuration to
the Xpert Remote UI `mode` and `--xui-*` token set and includes it in the
iframe's `init.theme` payload. When `options.theme` changes, ChatKit sends a
fresh `init` payload so the active Remote View updates without being reloaded.

## Client commands

ChatKit handles these manifest-declared commands directly:

- `assistant.context.set` stores a keyed context. ChatKit merges every stored
  context, including string `env` values, into later chat requests.
- `assistant.chat.send_message` submits through the active ChatKit stream and
  preserves request injection, references, uploaded attachment handles,
  follow-up behavior, and thread state.

Other manifest-declared commands are forwarded to
`workbench.onClientCommand`. The callback stays in the host-side options and is
bridged internally when ChatKit is hosted through the Web Component.

## Isolation

Remote HTML runs in a `srcDoc` iframe with `referrerPolicy="no-referrer"` and
the fixed sandbox:

```text
allow-downloads allow-forms allow-modals allow-popups allow-scripts
```

`allow-same-origin` is intentionally excluded. API calls, actions, and
workspace-file grants are performed by `@xpert-ai/xpert-sdk` in the ChatKit
host; credentials and API URLs are never sent to the remote iframe.
