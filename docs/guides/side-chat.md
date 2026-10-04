# Native Side Chats and Thread Branching

A side chat lets a user select text in a message, open a native Chat view in Workbench, and ask a question with that selection attached as a structured quote. It forks the source thread's latest state. Subsequent messages, runs, and Agent checkpoints are independent; Project, workspace files, and sandbox resources remain shared at the conversation level.

This guide describes the implemented V1 flow. Nested side chats and separate conversation-history entries for side chats are not supported. Creating a separate conversation from a completed reply is a different action; see [Conversation branching](../conversation-branching.md).

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

Text selection is restricted to a single referenceable message. The selection toolbar offers the existing quote action and **Ask in side chat**. The latter is available only when the source thread exists, authentication is ready, and the source is not generating a response.

1. Selecting the action opens Workbench in a loading state.
2. ChatKit copies the current source thread through the SDK.
3. The first quote supplies a short, stable tab title.
4. The existing `ChatKitQuoteReference` is merged into the side-chat composer, which receives focus.
5. Sending starts a run in the derived thread without changing the main transcript.

The server checks the idle state again to handle a race between the click and a new run. If copying fails, Workbench retains the pending quote and offers an inline retry. The main composer is not modified. Side chats remain available when remote views are absent or fail to load.

## Reuse, drafts, and closing

Within one ChatKit mount, one source thread reuses one side-chat thread. Repeated selections activate that view and append deduplicated references. Switching tabs, closing the whole Workbench panel, or navigating away from and back to the source thread within the page preserves the draft.

Explicitly closing a side-chat tab asks for confirmation, with an option not to ask again. Confirming removes the local view and reuse mapping; it does not delete the server thread. A later selection creates a new fork. Reloading the page does not discover or restore old side chats. Server threads follow the platform's retention policy rather than unreliable unload-time deletion.

## Native Chat isolation

Side chats render the production React `Chat` in the internal `surface="workbench"` mode, not a remote-component iframe.

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
- Forking shares the current message head and copies Agent checkpoint state; it does not duplicate the transcript or historical executions.

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

The server locks the source thread and checks that it is idle, reads its head and latest checkpoint, then creates a child in the same conversation. The child's initial head and fork point are the source head. Checkpoint, checkpoint writes, and Goal state are copied to the new thread ID. The child returns idle; its first human message uses the shared head as its parent and advances only the child's head.

Forking and starting a run must use the same locking or compare-and-set rules. Completed messages are shared immutable history. Retry, edit, or regeneration creates a sibling and advances the active thread's head; a streaming AI message may still update in place, which is why a busy thread cannot be copied.

Message loading follows the unique ancestor path from root to the selected thread head, with ordered pagination. Filtering only by `createdInThreadId` would omit inherited history. New messages advance the corresponding head atomically. Deleting a branch must retain ancestors reachable from another thread; deleting the primary thread or conversation removes the thread family.

## APIs and runtime scope

- `POST /threads/{thread_id}/copy` accepts optional metadata and returns the derived thread.
- `GET /conversations/{conversation_id}/threads` lists primary and derived threads.
- Thread metadata includes `conversation_id`, `parent_thread_id`, `primary`, `assistant_id`, and side-chat identification.
- Conversation message, Goal, and task-summary queries accept an active `threadId`; omission preserves primary-thread behavior.
- Runs, executions, cancellation, Goal middleware, LangGraph checkpoints, and Agent middleware use the active thread ID.

The `/threads/{thread_id}` route is authoritative for a run. The server resolves the thread and its conversation before loading messages, Goals, status, and interrupts. Only the primary thread mirrors status, error, and operation into the legacy conversation fields.

## Compatibility and deployment

Historical conversations need a primary thread record, message ownership backfill, a reachable message-tree leaf as their active head, and Goals associated with the primary thread. Old retry siblings remain in the tree but do not all appear on the active path.

Conversation history still has one entry per conversation. Side-chat activity does not create a new entry or update primary-thread unread state. Deploy the platform data/API changes first, then a compatible SDK, ChatKit UI, and host configuration. OSS platform changes are synchronized to Pro through the normal release flow.

## Verification

Regression coverage should preserve these contracts:

- Backfill, shared heads, copied checkpoints/writes/Goals, sibling retry, and branch deletion.
- Isolation of main/child messages, runs, Goals, interrupts, and follow-ups.
- Idle/busy races, tenant/organization access checks, and legacy API defaults.
- Selection actions, keyboard focus, translations, quote deduplication, and one copy per source per mount.
- Draft preservation, tab-close cancellation/confirmation, and no server deletion on local close.
- Main URL/Stream/host-event isolation and recovery from missing remote views or failed forks.
- Desktop split, narrow Sheet, themes, long labels, and enlarged text.

An end-to-end check selects a completed message, opens the side chat, submits the quote and question, observes a streamed child response, and verifies the unchanged main transcript, status, and checkpoint on the server. Unit tests do not replace deployment validation. Production E2E, narrow-screen evidence, and metrics for copy success, 409 races, loading failures, and side-chat run failures remain deployment acceptance tasks; metrics must not record selected text, credentials, or full messages.
