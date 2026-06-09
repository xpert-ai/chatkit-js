# @xpert-ai/chatkit-vue2

Vue 2 bindings for the Xpert ChatKit web component.

## Install

```bash
pnpm add @xpert-ai/chatkit-vue2 vue@^2.7
```

## Usage

Register the ChatKit custom element as ignored in your Vue 2 app entry:

```ts
import Vue from 'vue';

Vue.config.ignoredElements = [...Vue.config.ignoredElements, 'xpertai-chatkit'];
```

Then create a ChatKit control and pass it to the wrapper component:

```vue
<template>
  <ChatKit :control="chatkit" style="height: 100vh;" />
</template>

<script>
import { ChatKit, createChatKit } from '@xpert-ai/chatkit-vue2';

export default {
  components: { ChatKit },
  data() {
    return {
      chatkit: createChatKit({
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
        onReady: () => {
          console.log('ChatKit is ready');
        },
      }),
    };
  },
};
</script>
```

`getClientSecret` may continue returning the legacy `string`, or return
`{ secret, organizationId }` to have ChatKit send `organization-id` on hosted
API requests.

## Updating Options

`createChatKit` returns a control object that stores options and exposes the web
component methods:

```js
this.chatkit.setOptions({
  frameUrl: '<url-to-chatkit-frame>',
  api: {
    /* ... */
  },
  onReady: () => {},
});

this.chatkit.focusComposer();
this.chatkit.setThreadId('thread-id');
this.chatkit.sendUserMessage({ text: 'Hello' });
```

Options are replaced, not merged. Pass the full option object whenever you call
`setOptions`.
