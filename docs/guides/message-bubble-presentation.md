# Message Bubble Presentation

ChatKit supports `transcript` and `bubbles` presentation modes. Bubble mode renders each AI text block, visible result, and interactive component in its own container. Stored messages, streaming protocols, tool execution, and message IDs remain unchanged. The fallback is `transcript` when neither the host nor the Assistant specifies a mode.

## Enable or switch modes

Add the setting to the host's complete options:

```ts
import type { ChatKitOptions } from '@xpert-ai/chatkit-types';

const options: ChatKitOptions = {
  ...baseOptions, // Preserve API, authentication callbacks, frameUrl, and other settings.
  messagePresentation: {
    mode: 'bubbles',
    collapseProcess: true,
  },
};

chatkitElement.setOptions(options);
```

`collapseProcess` applies only in transcript mode. Bubble mode retains text before and after tools as separate bubbles. Switching back to `transcript` restores the configured process-collapse behavior. Always pass complete options to `setOptions`, rather than replacing the existing configuration with presentation fields alone.

React uses `useChatKit({ ...baseOptions, messagePresentation: { mode } })`. Vue accepts the same options, with a ref or computed value for runtime changes. Native JavaScript uses `createChatKit(options)` and `instance.element.setOptions(nextOptions)`. There are no framework-specific presentation properties.

Local development can use workspace ChatKit types and wrappers with `frameUrl` pointing to the matching UI development server. Updating only the types while loading an old iframe bundle does not enable the UI. This feature adds no Xpert API or sandbox requirement.

## Display rules

| Content                                              | Bubble behavior                                                                                                                       |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| AI text                                              | One bubble per original text block; paragraphs and SSE tokens do not create additional bubbles.                                       |
| User messages                                        | Right-aligned accent-colored bubbles; AI replies use left-aligned neutral surfaces.                                                   |
| Ordinary tools, reasoning, memory, internal events   | Process UI is hidden; underlying data and execution remain intact.                                                                    |
| Tool artifacts and screenshots                       | Ordinary tool images are not automatically displayed: they may be model observations rather than user-facing results.                 |
| Declared search/retrieval results and message images | Dedicated renderers retain explicitly supported results, rather than exposing arbitrary tool JSON.                                    |
| File activity and resource cards                     | Existing deduplication and actions are retained with bubble presentation.                                                             |
| Widgets, MCP Apps, questions, approvals              | Existing interactions and call bindings remain; historical MCP results do not reconnect tools.                                        |
| Child Agents and external Assistants                 | Attribution and execution entry points remain; child content uses the same presentation rules without internal tool inputs or counts. |
| Unknown components                                   | The compatibility renderer remains available; components are not discarded based on a guessed name.                                   |
| Replies without text                                 | Show actual running, success, failure, pause, or interrupt status. Never infer success without a completion signal.                   |

Each original message has one primary action group. Copying the main reply combines that speaker's body text in order, excluding reasoning, tool payloads, and child-assistant text. Child replies can be copied or quoted in their own view. Retry, edit, and branch actions continue to target the original message. Navigation omits hidden process summaries; external Assistants use their visible card names.

The main chat, maximized Workbench Chat tab, and side chat use the current Assistant's defaults. External Assistant transcripts use the selected Assistant's defaults. Explicit host options apply consistently across these lists without expanding side-chat permissions.

## Lifecycle and theme

Both modes use the same keyed content tree. A bubble index never replaces a message ID. Switching modes or receiving a late reasoning prefix does not remount Widget/MCP instances. Process visibility changes while interactive result instances remain stable.

Before switching modes, ChatKit records the visible message and relative scroll offset, then restores that anchor. A viewport already at the bottom remains there. Normal streaming and pagination use the existing viewport lifecycle. Legacy blocks without IDs fall back to their original position; arbitrary reordering of ID-less content is not guaranteed to preserve identity.

Bubbles inherit panel radius, density, surface, and foreground tokens through ThemeProvider. `sharp` produces square corners. Text has a maximum width of 80% on desktop and 92% in narrow containers; interactive cards may use the full message column. Code and tables scroll internally.

## Assistant configuration and publishing

The platform Assistant settings dialog offers **Appearance → Message presentation** with **Follow application default**, **Transcript**, and **Bubbles**. The setting is saved to draft `team.options.messagePresentation.mode`. **Save and publish** waits for the draft save, then publishes the Assistant while preserving its runtime environment. Following the application default removes the override. Save or publish failures retain the draft and show a retryable error.

After publication, the platform notifies the current ChatKit for the same organization and Assistant. A `setOptions` update triggers a fresh SDK read of the published configuration. The last successful configuration stays visible while refreshing. The response changes presentation in place without recreating the iframe, conversation, or composer. Publications in another organization or for another Assistant do not refresh this conversation.

The platform contract is `TXpertOptions.messagePresentation?: { mode?: 'transcript' | 'bubbles' }`. `client.assistants.get(id)` returns `config.options`; ChatKit validates the mode at that boundary. No additional endpoint or SDK release is required specifically for this setting.

Precedence is:

```text
Explicit ChatKit options.messagePresentation.mode
  > published Assistant default
  > transcript
```

Setting only `collapseProcess` does not override an Assistant's mode. A Desktop host that explicitly sets a global mode takes precedence over the Assistant default.

Changing the Assistant or client clears the previous default and rejects late responses from old requests. Missing/invalid modes or a failed initial request fall back to host settings or transcript mode. A failed refresh for the same Assistant retains the last successful value. Async updates use the existing scroll and component-state preservation mechanism.

Local acceptance must load the iframe from the intended working tree. A different working tree or old bundle will not pick up source or publication changes. Hosts may use a local `/chatkit` build or a dedicated UI server through `VITE_CHATKIT_FRAME_URL`; do not overwrite a server used by another working tree.

## Implementation and local preview

See [Rendering architecture](./message-bubble-architecture.md) for content classification, identity, and extension boundaries.

```sh
corepack pnpm dev:ui
```

The development route `/dev/message-bubbles/` compares modes, light/dark themes, rounded/sharp corners, compact density, a 360px panel, and 200% zoom. Draft controls verify state preservation during mode changes. The route uses synthetic data, requests no Assistant, executes no tools, and is excluded from the production app entry bundle.

## Acceptance record: 2026-10-01

These records describe the implementation-time checks, not a new run of the current suite.

### Automated checks

- UI: 173 test files and 1,389 tests passed. Web Component: four files and eight tests passed. UI type checking and library/app builds passed.
- Bubble coverage included block boundaries, stream append, history insertion, Widget/MCP nodes and drafts, historical MCP behavior, question results, approvals, tool-image extraction at that revision, unknown components, text-free status, and restoration of transcript mode.
- Bridge tests covered initial iframe serialization and runtime `setOptions` without replacing the iframe. JavaScript, React, Vue, and Web Component type checks passed.
- Copying, child-assistant attribution, original navigation anchors, mode-change scrolling, and theme-token updates were checked.
- After the final null-check change, 22 relevant tests and UI type checking passed again. ESLint still reported three pre-existing non-null assertion errors and four Hook dependency warnings in the affected area; lint was not recorded as fully passing.

### Platform ClawXpert acceptance

The initial run reused local Cloud, API, and this workspace's ChatKit UI with a temporary explicit `mode: 'bubbles'` option. The host override was later removed in favor of the Assistant publication flow above. ChatKit's fallback remains transcript mode.

1. A synthetic acceptance conversation exercised real request status, block-by-block text, lists, and code.
2. A real external DOCX Assistant call produced a result card; its Workbench transcript also used bubbles.
3. Maximizing Workbench and selecting Chat retained the original conversation. An approximately 360px chat column had no page-level horizontal overflow.
4. Reloading restored history. Copying the main reply retained body text and code while excluding hidden child-assistant text.
5. Opening a side chat created a real branch and loaded history; both lists retained bubble presentation.
6. Synthetic previews supplemented dark theme, sharp corners, compact density, 200% zoom, process expansion, and draft-retention checks.

That Assistant's tools did not include a general terminal. It invoked the DOCX Assistant and returned a capability limitation. Model-generated simulated acceptance summaries were not treated as execution evidence. Approvals, tool images, and MCP preservation were covered automatically but were not each triggered against real services. Long-conversation performance and the full browser/screen-reader matrix remain separate acceptance work.

### Save-and-publish acceptance

- Editing the bound Claw Xpert saved the draft while the conversation kept its published mode. Publishing switched the current list immediately.
- Both bubbles → transcript and transcript → bubbles publications succeeded. The iframe URL, including `channelId`, and conversation history were preserved; the final published mode was bubbles.
- Acceptance used a locally built `/chatkit` bundle, without publishing an npm package or sending a new conversation message.
- Platform save/publish and host-refresh tests passed 32 cases; ChatKit default-loading and precedence tests passed five. Angular compilation, ChatKit type checking, and the app build passed.

## Extension boundary

`MessageActor` and `PresentationSource` distinguish authors, roles, original messages/blocks, and executions. They do not implement group chat, parallel multi-Assistant scheduling, a participant directory, or mentions. Execution IDs and matching display names are not cross-conversation author identities.
