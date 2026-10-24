# Native Side Chats and Thread Branching

A side chat lets a user select text in a message, open a native Chat view in Workbench, and ask a question with that selection attached as a structured quote. It forks the source thread's most recent sealed assistant reply. The source can continue running. Subsequent messages, runs, and Agent checkpoints are independent; Project, workspace files, and sandbox resources remain shared at the conversation level.

This guide describes sealed-boundary side chats. Nested side chats and separate conversation-history entries for side chats are not supported. Creating a separate conversation from a completed reply is a different action; see [Conversation branching](../conversation-branching.md).

## Enable side chats

Side chats default to the Workbench enabled state. Set `workbench.sideChat.enabled` explicitly to override that default. The following enables both in the host's complete options after deploying compatible platform and SDK versions:

```ts
const options: ChatKitOptions = {
  ...baseOptions,
  workbench: {
    ...baseOptions.workbench,
    enabled: true,
    sideChat: { enabled: true },
  },
};
```

ChatKit uses the SDK's `threads.copy`, `threads.get`, and conversation message search APIs. It does not bypass the SDK with raw HTTP requests. Platform deployment must include thread schema migration and historical backfill; enabling the UI alone is insufficient.

## Selection and opening

Text selection is restricted to a single referenceable message. The selection toolbar offers the existing quote action and **Ask in side chat**. The source may be generating a response. Selection, Workbench start-page, floating-chat, and Conversation Map actions all request the same sealed-boundary mode. Selecting text attaches a quote; it does not choose the fork boundary.

1. Selecting the action opens Workbench in a loading state.
2. ChatKit calls `threads.copy(sourceThreadId, { mode: 'latest-sealed-reply', requestId })` through the SDK.
3. The first quote supplies a short, stable tab title.
4. The existing `ChatKitQuoteReference` is merged into the side-chat composer, which receives focus.
5. Sending starts a run in the derived thread without changing the main transcript.

The server chooses the newest sealed reply on the source head's ancestor path, validates its graph revision and history, and copies its pinned checkpoint dependency closure. It does not pause or cancel the source. If no sealed reply exists, it returns `side_chat_checkpoint_unavailable` and asks the user to wait for a completed reply. Missing or incompatible checkpoints are rejected without falling back to live state. If copying fails, the selection retains its quote for retry and the main composer is preserved.

## Reuse, drafts, and closing

Within one ChatKit mount, one source thread reuses one side-chat thread. Overlapping entry points share one pending request. Retries retain the same request ID, including after an unknown network outcome, so the server returns the existing child even if the source has advanced. Late responses after navigation cannot activate a side chat in another source. Repeated selections activate the view and append deduplicated references. Switching tabs, closing the whole Workbench panel, or navigating away from and back to the source thread within the page preserves the draft.

Explicitly closing a side-chat tab asks for confirmation, with an option not to ask again. Confirming removes the local view, reuse mapping and request ID; it does not delete the server thread. A later selection creates a new fork with a fresh ID. Reloading the page does not discover or restore old side chats. Server threads follow the platform's retention policy rather than unreliable unload-time deletion.

## Native Chat isolation

Side chats render the production React `Chat` in the internal `surface="side"` mode, not a remote-component iframe.

- Messages, composer, references, attachments, streaming, HITL, and run status are retained.
- Duplicate headers, history, new-thread controls, pets, Workbench toggles, and recursive side-chat actions are hidden.
- A separately controlled Stream Provider keeps the thread ID in component memory, without changing the main URL or global Stream.
- The view does not register the main Parent Messenger handlers or emit primary navigation events such as `thread.change`.
- Authentication, Assistant, Project, request configuration, and Workbench context are inherited.

The view follows Workbench's resizable desktop split and narrow-screen Sheet. Selection actions must remain usable with long labels, enlarged text, and constrained widths.

## Thread and message model

The platform combines `ChatConversationThread` with the existing `ChatMessage` tree:

- A thread owns its identity, status, checkpoints, Goal, executions, and lifecycle.
- The message tree records shared history and branch ancestry.
- Forking shares the selected sealed reply as its initial message head and copies Agent checkpoint state; it does not duplicate the transcript or historical executions.

```text
Conversation
├─ Thread A: headMessageId = M10A
└─ Thread B: parentThreadId = A
             forkedFromMessageId = M8
             headMessageId = M10B

M1 → M2 → ... → M8
                ├→ M9A → M10A
                └→ M9B → M10B
```

A message tree alone cannot isolate checkpoints and writes, runs and cancellation, HITL operations, Goals and budgets, queued follow-ups, or the Agent Protocol thread lifecycle. A separate thread record makes those boundaries explicit without duplicating shared history.

`ChatConversationThread` stores `conversationId`, `threadId`, `parentThreadId`, `headMessageId`, `forkedFromMessageId`, `status`, `error`, `operation`, metadata, and the standard tenant, organization, creator, and time fields. `ChatConversation.threadId` remains the primary thread ID for legacy clients. `ChatMessage.createdInThreadId` records where a message was first created, not every branch that can see it. Goals are unique by `conversationId + threadId`.

The conversation continues to own the Assistant, Project, workspace, file relationships, and shared `sandboxEnvironmentId`. Branching restores conversation state, not an earlier copy of workspace files.

## Copying and loading a branch

The server prepares a sealed message boundary before the transaction, then locks the source thread, checks for an existing request result and revalidates the selected prefix. Appends after the selected reply do not invalidate it. The child's initial head and fork point are that reply, not a partial streaming message. Only the reply's pinned checkpoint closure is copied, with platform thread identities rebound and pending follow-ups cleared. Pending writes, live Goals/budgets, approvals, run control, queued inputs and execution records are not copied. The child returns idle; its first human message uses the shared head as its parent and advances only the child's head.

Completed messages are shared immutable history. Retry, edit, or regeneration creates a sibling and advances the active thread's head; a streaming AI message may still update in place and is excluded from the sealed prefix. The legacy `threads.copy()` without a mode retains its idle-only behavior. Historical input editing through `beforeMessageId` is also unchanged; it cannot be combined with sealed-reply mode.

Message loading follows the unique ancestor path from root to the selected thread head, with ordered pagination. Filtering only by `createdInThreadId` would omit inherited history. New messages advance the corresponding head atomically. Deleting a branch must retain ancestors reachable from another thread; deleting the primary thread or conversation removes the thread family.

## APIs and runtime scope

- `POST /threads/{thread_id}/copy` accepts `mode: 'latest-sealed-reply'` with a stable `requestId` and optional metadata, and returns the derived thread. Reusing an edit/legacy-copy key for this mode is rejected.
- `GET /conversations/{conversation_id}/threads` lists primary and derived threads.
- Thread metadata includes `conversation_id`, `parent_thread_id`, `primary`, `assistant_id`, and side-chat identification.
- Conversation message, Goal, and task-summary queries accept an active `threadId`; omission preserves primary-thread behavior.
- Runs, executions, cancellation, Goal middleware, LangGraph checkpoints, and Agent middleware use the active thread ID.

The `/threads/{thread_id}` route is authoritative for a run. The server resolves the thread and its conversation before loading messages, Goals, status, and interrupts. Only the primary thread mirrors status, error, and operation into the legacy conversation fields.

## Compatibility and deployment

Historical conversations need a primary thread record, message ownership backfill, a reachable message-tree leaf as their active head, and Goals associated with the primary thread. Old retry siblings remain in the tree but do not all appear on the active path.

Conversation history still has one entry per conversation. Side-chat activity does not create a new entry or update primary-thread unread state. Deploy the platform API changes first, then ChatKit UI and hosts. The SDK source includes the new typed mode. Until that SDK change is released, this repository applies a tracked declaration-only patch to its installed SDK 0.14.0; its existing transport already forwards the copy options unchanged. Remove the patch when adopting an SDK release containing the new contract. OSS platform changes are synchronized to Pro through the normal release flow.

## Verification

Regression coverage should preserve these contracts:

- Backfill, shared heads, pinned checkpoint copying without live writes/Goals, sibling retry, and branch deletion.
- Isolation of main/child messages, runs, Goals, interrupts, and follow-ups.
- Live source execution, sealed ancestor selection, concurrent idempotent retries, tenant/organization access checks, and legacy API defaults.
- Selection actions, keyboard focus, translations, quote deduplication, and one copy per source per mount.
- Draft preservation, tab-close cancellation/confirmation, and no server deletion on local close.
- Main URL/Stream/host-event isolation and recovery from missing remote views or failed forks.
- Desktop split, narrow Sheet, themes, long labels, and enlarged text.

An end-to-end check selects a completed message, opens the side chat, submits the quote and question, observes a streamed child response, and verifies the unchanged main transcript, status, and checkpoint on the server. Unit tests do not replace deployment validation. Production E2E, narrow-screen evidence, and metrics for copy success, 409 races, loading failures, and side-chat run failures remain deployment acceptance tasks; metrics must not record selected text, credentials, or full messages.
