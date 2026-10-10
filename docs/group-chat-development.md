# Group chat integration

The group feature uses the published `@xpert-ai/xpert-sdk` **0.9.1** or a compatible version, including `Client.groups` and `Client.forGroupWorkbench`, together with `/api/ai/groups` from the matching Xpert backend. The manifest and lockfile resolve the published SDK; no local SDK checkout or dependency symlink is needed.

1. Run `corepack pnpm install --frozen-lockfile`.
2. Use Node 24 and run `corepack pnpm test`, `corepack pnpm --filter @xpert-ai/chatkit-ui types`, and the UI build.
3. Start the matching Xpert backend and point Cloud's `VITE_CHATKIT_FRAME_URL` at this UI build/dev server. Create/open a group from the shared conversation list; Cloud resolves it into the existing ChatKit page.

Embedding uses `group: { id: groupId }` and the existing `api.getClientSecret` callback. The host uses its authenticated human session, with the selected tenant and organization context, to call `POST /api/ai/v1/chatkit/sessions`:

```json
{ "scope": { "kind": "conversation", "conversationId": "<group-conversation-uuid>" } }
```

The host maps the response's `client_secret` to `{ secret: client_secret, organizationId }` for `api.getClientSecret`; it renews credentials through the same host callback. The iframe uses the existing ChatKit credential transport and refresh handling. There is no group-specific session endpoint or `x-group-session` header. Private Assistant credentials do not grant access to a group, and conversation-scoped credentials cannot mint more credentials. `GroupsClient.createSession` was removed in SDK 0.9.1; hosts mint conversation-scoped credentials through the shared ChatKit session endpoint above. Host navigation changes `sessionKey` to reset conversation state and cancel stale requests while retaining the iframe and its loaded modules.

Group bubbles distinguish the current human, other humans, and digital experts. Typing `@` opens a member picker; selecting a member records the stable participant ID and text range. An unbound mention is rejected instead of guessed from a display name. Explicit mentions route to those members; without a mention, the conversation's `xpertId` identifies the primary Assistant that receives the message. Messages addressed only to humans do not wake an Assistant. The backend reuses the existing message queue and steers an already running recipient; the UI does not offer a queue/interrupt mode selector.

Human replies preserve `replyToMessageId` in the protocol without showing the original message above the bubble. Clicking an Assistant sender name opens the corresponding runtime conversation in the existing Workbench external-Assistant view. Client tools/approvals require the assigned human to explicitly claim them; other observers never execute them.

Before publishing ChatKit, verify against the locked published SDK using a frozen install. Deploy the platform group entry together with a group-enabled ChatKit frame; older frames do not support group conversations.

## Shared Chat rendering

`components/chat.tsx` owns the single rendering path for both conversation kinds:
`ChatHeader`, `ChatTranscript` (and its `MessageList`), and `ChatComposerForm`.
`useAssistantConversation` and `useGroupConversation` supply the typed `ChatViewModel`.
Separate runtime boundaries preserve hook lifecycles and prevent group credentials
from entering a private Assistant stream; they do not render separate chat windows.
The previous `GroupConversation` and `GroupTranscript` components have been removed.
Group-specific member, recipient and reply controls extend the shared component slots.

## Group member and detail dialogs

Group avatar clicks open the existing `AssistantSummaryDialog`, including the shared
presence transition, task summary, and focus restoration. The header's members action
opens the shared shadcn `Dialog`; `Tabs` separate people and Assistants, and a
`Popover` + `Command` combobox searches authorized candidates via `Client.groups`.
Only owners see invite/remove controls. The primary Assistant cannot be removed.

Candidates include the same public avatar fields as member snapshots. Group avatars
reuse Assistant character/pet rendering, while the shared profile avatar supports
both Unicode emoji and older Emoji Mart IDs/shortcodes. The emoji catalog loads
lazily. Missing or invalid uploaded image URLs still require restoration of the
underlying resource; this feature does not rewrite profile data.

Cloud's creation dialog uses Zard inputs, buttons, and its searchable combobox with
`EmojiAvatarComponent` option templates. Cloud continues to embed the shared ChatKit
chat rather than introducing a second conversation UI.
