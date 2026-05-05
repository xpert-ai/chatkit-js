# Pet

This guide documents the ChatKit Pet architecture and implementation contract.
It is intended for maintainers and wrapper authors who need to understand how
the shared `ChatKitOptions.pet` API flows through React, Angular, Vue, the
ChatKit iframe, and the web component host overlay.

## Public API

Pet is configured through `ChatKitOptions` from `@xpert-ai/chatkit-types`.
Wrappers should pass the same options object through unchanged.

```ts
type ChatKitOptions = {
  displayMode?: 'chat' | 'pet';
  pet?: boolean | ChatKitPetOptions;
};

type ChatKitPetOptions = {
  enabled?: boolean;
  character?: {
    type: 'sprite-atlas';
    src: string;
    atlas?: ChatKitPetSpriteAtlas;
  };
  position?: {
    pin?: ChatKitPetPin | null;
    draggable?: boolean;
    scale?: number;
    persist?: boolean;
    boundsPadding?: number | Partial<ChatKitPetBoundsPadding>;
    zIndex?: number;
  };
  behavior?: 'auto' | 'manual';
  ariaLabel?: string;
  imageRendering?: 'auto' | 'pixelated' | 'crisp-edges';
};
```

Defaults are defined in `packages/chatkit/src/pet.ts`:

- `pet` omitted: disabled
- `pet: true`: default included Boba atlas, bottom-right pin, draggable,
  persisted position, `scale: 0.25`, `behavior: 'auto'`
- Default `boundsPadding` is `0` on all sides, so drag and pin constraints stop
  at the host viewport edges unless callers opt into extra padding.
- `displayMode: 'chat'`: normal iframe is shown; Pet is optional
- `displayMode: 'pet'`: the web component starts as a Pet launcher and opens
  the iframe when Pet is clicked

## Runtime Architecture

Pet is intentionally split between the iframe and the host web component.

| Layer | Responsibility |
| --- | --- |
| `@xpert-ai/chatkit-types` | Public option and atlas types |
| `packages/chatkit/src/pet.ts` | Shared atlas contract, normalization, pinning, clamping |
| `chatkit-ui` iframe | User settings, `/pet` command, auto state calculation, active-thread summary logs |
| `chatkit-web-component` | Host viewport overlay, dragging, animation playback, conversation bubble, launcher behavior |
| Framework wrappers | Pass `ChatKitOptions.pet` through unchanged |

The Pet DOM is rendered by `PetOverlay` in the web component shadow DOM with a
fixed host-viewport overlay. It is not rendered inside the ChatKit iframe. This
allows the Pet to move across the host page viewport while the chat iframe or
panel keeps its normal host layout position.

## Asset URL Resolution

Pet assets are displayed by the host web component, but relative asset URLs are
resolved against the ChatKit `frameUrl`.

```ts
pet: {
  character: {
    type: 'sprite-atlas',
    src: '/pets/boba/spritesheet.webp',
  },
}
```

If `frameUrl` is `http://localhost:5173`, the URL above resolves to
`http://localhost:5173/pets/boba/spritesheet.webp`, even if the host page is
served from another port. This keeps included assets tied to the ChatKit UI
static host.

Direct remote spritesheet image URLs can be used, subject to browser image
loading rules. JSON manifest fetching is not part of the current public Pet
contract.

## Included Pets

Included Pet assets live in `packages/chatkit-ui/public/pets`. The list exposed
to settings is maintained in `packages/chatkit-ui/src/components/pet/builtinPets.ts`.

Current included IDs:

- `batmeme`
- `boba`
- `bolt`
- `einstein`
- `lando-2`
- `mini-sama`
- `miso`
- `noir-webling`
- `nukey`
- `steve`

Settings store the selected included Pet as a local browser preference and
convert it back to a `sprite-atlas` character before sending options to the host
overlay.

## Sprite Atlas Contract

The default atlas follows the same row layout for every included Pet:

```ts
const petSpriteAtlas = {
  columns: 8,
  rows: 9,
  cellWidth: 192,
  cellHeight: 208,
  animations: {
    idle: { row: 0, frames: 6 },
    'running-right': { row: 1, frames: 8 },
    'running-left': { row: 2, frames: 8 },
    waving: { row: 3, frames: 4 },
    jumping: { row: 4, frames: 5 },
    failed: { row: 5, frames: 8 },
    waiting: { row: 6, frames: 6 },
    running: { row: 7, frames: 6 },
    review: { row: 8, frames: 6 },
  },
};
```

Each animation can also define frame durations. Atlas overrides merge with the
default contract through `mergePetSpriteAtlas`, so callers can override only the
parts that differ.

The web component displays atlas frames with CSS background positioning. It uses
the configured `cellWidth` and `cellHeight` to avoid frame bleed between rows or
columns.

## State Mapping

`chatkit-ui` computes the automatic Pet state and sends it to the host overlay
through the internal `pet_state_change` parent event.

| ChatKit state | Pet animation |
| --- | --- |
| client secret initialization | `waiting` |
| history or thread load | `waiting` |
| stream not ready | `waiting` |
| request running | `running` |
| assistant streaming | `review` |
| stream or thread error | `failed` |
| idle | `idle` |

The host overlay adds local animation behavior:

- Initial enabled state plays `waving` once before returning to auto state.
- Clicking Pet plays `waving`.
- A run that returns to `idle` from `running` or `review` plays `jumping` once.
- Dragging switches to `running-right` or `running-left` based on horizontal
  pointer movement.
- After hover or drag ends, the overlay waits before lowering animation frame
  frequency for resting state.
- `prefers-reduced-motion` prevents transient animations.

## Local Settings and Slash Command

`chatkit-ui` owns the user-facing settings UI. Pet settings are stored in
`localStorage` under `chatkit:pet:settings:v1`.

The `/pet` built-in slash command supports:

```text
/pet
/pet on
/pet off
/pet settings
```

In `displayMode: 'pet'`, Pet is required and the settings UI prevents disabling
it.

## Conversation Bubble

The conversation bubble is rendered by `PetOverlay`, but its data comes from
the existing public event channel. `chatkit-ui` emits:

```ts
sendParentEvent('public_event', [
  'log',
  {
    name: 'thread.summary',
    data: {
      threadId,
      title,
      message,
      status: 'running' | 'completed' | 'failed',
      messageId,
      updatedAt,
    },
  },
]);
```

No dedicated `thread.summary.change` event type is used. The web component
parses the `log` payload for `name === 'thread.summary'`, updates the bubble,
and still dispatches the original public `chatkit.log` event when the current
capability profile allows it.

Bubble behavior:

- Compact view shows title, message, and status icon.
- Hover shows hide, expand/collapse, and reply controls.
- Collapse hides the bubble and shows a badge. The current implementation
  tracks only the active thread, so the badge count is `1`.
- Clicking the bubble card opens the ChatKit iframe, calls `setThreadId`, and
  focuses the composer.
- Clicking controls inside the bubble stops propagation and does not open or
  navigate.
- Reply submits through host `sendUserMessage({ text })`.
- `Esc` exits the reply form.

When a conversation fails before an assistant message exists, the summary uses
the error message as bubble content so failures are still visible.

## Internal Events

The iframe-to-host events used for Pet are internal bridge events, not public
ChatKit events:

| Event | Direction | Payload |
| --- | --- | --- |
| `pet_options_change` | iframe to host | `{ pet: ChatKitOptions['pet'] \| null }` |
| `pet_state_change` | iframe to host | `{ state: ChatKitPetAnimationName }` |

Conversation summary uses the existing public event wrapper:

| Public event | Payload |
| --- | --- |
| `log` | `{ name: 'thread.summary', data: ConversationSummary \| null }` |
| `response.start` | Host marks bubble status `running` |
| `response.end` | Host marks bubble status `completed` |
| `response.stop` | Host marks bubble status `completed` |

Host-to-iframe calls used by Pet:

| Command | Purpose |
| --- | --- |
| `sendUserMessage` | Send quick replies from the bubble |
| `setThreadId` | Open the thread represented by the bubble |
| `focusComposer` | Focus chat input after opening a bubble thread |

## Localization

Iframe settings use the normal `chatkit-ui` i18n resources. Host-rendered Pet
bubble text is resolved inside `PetOverlay` because it is native DOM outside the
React iframe tree.

The overlay follows `ChatKitOptions.locale`. If no locale is set, it falls back
to `chatkit:locale` in localStorage and then `navigator.language`.

## Current Boundaries

- Only `sprite-atlas` characters are supported.
- Per-state GIF/WebP/PNG media maps are not part of the current API.
- The web component manages Pet; framework wrappers should not render their own
  Pet DOM.
- Pet moves across the host viewport; the iframe panel does not follow Pet.
- Local user settings are browser-local and are not synced to the backend.
