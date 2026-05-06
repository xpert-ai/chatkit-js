# @xpert-ai/chatkit-host-automation

Playwright-style host page automation tools for ChatKit client tool calls.

```ts
import { createHostPageAutomationClientToolHandler } from '@xpert-ai/chatkit-host-automation';

chatkit.setOptions({
  frameUrl: '<url-to-chatkit-frame>',
  api: {
    /* ... */
  },
  onClientTool: createHostPageAutomationClientToolHandler(),
});
```

The first version exposes a fixed tool allow-list:

- `host_page_snapshot`
- `host_page_click`
- `host_page_fill`
- `host_page_press`
- `host_page_select`
- `host_page_scroll`
- `host_page_navigate`
