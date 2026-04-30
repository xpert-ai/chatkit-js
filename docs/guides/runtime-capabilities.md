# Runtime Skills and Plugins Selection

ChatKit supports runtime selection of an Xpert agent's optional skills and plugin middlewares. This lets the UI send a per-turn allow-list to Xpert instead of loading every available capability into every model run.

The feature is designed for two goals:

- Keep required system behavior stable and hidden from end users.
- Let users explicitly choose optional skills and plugins so the model context stays smaller.

## Concepts

### Skills

Skills are Xpert skill packages exposed through `skillsMiddleware`.

Skills have two runtime states:

- **Default skills**: configured on the Xpert Studio `Skills Middleware` node. ChatKit checks these by default after loading capabilities. Users can uncheck them for a conversation or for a single run.
- **Optional skills**: available in the workspace but not configured as defaults. They are not loaded unless the user selects them.

When ChatKit sends an explicit runtime allow-list, the selected skill IDs replace the middleware defaults for that run. An empty skill list means no optional/default skills should be loaded.

### Plugins

Plugins are optional agent middleware workflow nodes. ChatKit identifies each plugin by the middleware node key, not by provider name, so multiple instances of the same provider can be controlled separately.

Middleware nodes can also be marked as system middleware in Xpert Studio. System middleware is always loaded and is not shown in the ChatKit selector.

## Capability Discovery API

ChatKit loads capabilities from:

```http
GET /ai/assistants/:id/runtime-capabilities
```

ChatKit calls this route through the `@xpert-ai/xpert-sdk` client:

```ts
await client.assistants.getRuntimeCapabilities(assistantId);
```

If `apiUrl` already points to the `/ai` mount, the SDK request resolves to:

```ts
GET `${apiUrl}/assistants/${assistantId}/runtime-capabilities`
```

The response shape is:

```ts
type RuntimeCapabilitiesResponse = {
  skills: Array<{
    id: string;
    workspaceId: string;
    label: string;
    description?: string;
    repositoryName?: string;
    provider?: string;
    default?: boolean;
  }>;
  plugins: Array<{
    nodeKey: string;
    provider: string;
    label: string;
    description?: string;
    toolNames?: string[];
  }>;
};
```

`default: true` means the skill is checked initially in ChatKit. Required/system middleware is excluded from `plugins`.

## Runtime Selection Payload

When the capability endpoint loads successfully, ChatKit sends a runtime allow-list with each message:

```ts
type RuntimeCapabilitiesSelection = {
  mode: 'allowlist';
  skills: {
    workspaceId?: string;
    ids: string[];
  };
  plugins: {
    nodeKeys: string[];
  };
};
```

The value is written to `input.runtimeCapabilities` and injected into `state.human.runtimeCapabilities`, so Xpert can read the same selection from the human input or graph state.

Example payload:

```json
{
  "input": {
    "input": "Summarize this repository and check the build scripts.",
    "runtimeCapabilities": {
      "mode": "allowlist",
      "skills": {
        "workspaceId": "workspace_123",
        "ids": ["skill_code_review"]
      },
      "plugins": {
        "nodeKeys": ["Middleware_sandbox"]
      }
    }
  }
}
```

An empty allow-list is meaningful:

```json
{
  "mode": "allowlist",
  "skills": { "workspaceId": "workspace_123", "ids": [] },
  "plugins": { "nodeKeys": [] }
}
```

This tells Xpert to disable all user-selectable skills and plugins for the run while still keeping required system middleware.

## ChatKit UI Behavior

After initialization, ChatKit tries to load runtime capabilities for the current assistant.

When loading succeeds:

- The composer menu shows `Skills` and `Plugins` panels.
- Default skills are checked automatically.
- Optional skills and plugins are unchecked.
- The current session selection is kept per active thread and resets when switching threads or starting a new thread.
- Sending a message includes a runtime allow-list even when all options are unchecked.

The composer also supports a `/` palette:

- Type `/` in the input to search available skills and plugins.
- Selecting an item creates a run-only chip.
- Run-only chips are merged with the session selection for the next submit.
- Run-only chips are cleared after sending.
- The `/` trigger text is removed from the user message before it is sent.

When the SDK call fails or the server returns `404`, ChatKit hides the selector and keeps legacy behavior by omitting `runtimeCapabilities`.

## Programmatic Send

Host applications can bypass the UI and send an exact runtime allow-list:

```ts
await chatkit.sendUserMessage({
  text: 'Run a focused analysis.',
  runtimeCapabilities: {
    mode: 'allowlist',
    skills: {
      workspaceId: 'workspace_123',
      ids: ['skill_code_review']
    },
    plugins: {
      nodeKeys: ['Middleware_sandbox']
    }
  }
});
```

`runtimeCapabilities` is passed through to both input and state injection.

## Xpert Studio Setup

### Configure default skills

1. Add or select a `Skills Middleware` node for the agent.
2. In the middleware configuration panel, set `Default Skills`.
3. Save/publish the Xpert.

Those selected skills are returned from the capability endpoint with `default: true`, so ChatKit checks them initially.

### Configure system middleware

For middleware that must always run:

1. Select the middleware node in Studio.
2. Enable `System middleware`.
3. Save/publish the Xpert.

System middleware is always loaded at runtime, hidden from the ChatKit plugin selector, and ignored by user allow-list filtering.

## Server Runtime Rules

When `runtimeCapabilities.mode === 'allowlist'`:

- Required/system middleware is always loaded.
- Plugin middleware is loaded only when its `nodeKey` is present in `plugins.nodeKeys`.
- `skillsMiddleware` is kept when selected skill IDs are present.
- `skillsMiddleware` receives the selected skill IDs and does not fall back to configured default skills.
- Empty `skills.ids` explicitly disables default and optional skills.

When `runtimeCapabilities` is absent:

- Xpert keeps compatibility with non-ChatKit callers.
- `skillsMiddleware` loads its configured default skills.
- Existing assistant binding skill preferences and workspace blacklist mode continue to apply where configured.

## Compatibility Notes

- New ChatKit + new Xpert server: dynamic runtime selection is enabled.
- New ChatKit + old Xpert server: the SDK capability call returns `404` or fails, the selector is hidden, and messages omit `runtimeCapabilities`.
- Old ChatKit + new Xpert server: no runtime allow-list is sent, so Xpert uses saved/default middleware configuration.

## Testing Checklist

Recommended coverage:

- Capability endpoint returns default skills with `default: true`.
- Required/system middleware is excluded from `plugins`.
- Empty allow-list disables optional plugins and selected/default skills.
- Selecting a plugin loads only that middleware node.
- Selecting a skill keeps `skillsMiddleware` and injects only selected skills.
- ChatKit initializes session selection from default skills.
- `/` palette selections affect only the next submit.
