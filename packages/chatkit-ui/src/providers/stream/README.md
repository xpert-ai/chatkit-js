# Stream provider composition

`../Stream.tsx` remains the public entry point. It preserves `StreamProvider`,
the default context export, `useStreamContext`, and the existing helper and type
exports. `StreamSession.tsx` composes the feature hooks and projects their state
into the public context.

| Folder        | Responsibility                                                                               |
| ------------- | -------------------------------------------------------------------------------------------- |
| `scope/`      | Thread and conversation identity, URL or memory selection, and connector bindings            |
| `auth/`       | Client secrets, organization context, SDK client creation, and authenticated request retries |
| `messages/`   | Transcript state, message metadata, optimistic updates, and message merging                  |
| `events/`     | Stream envelopes, event decoding, and dispatch to message or runtime state                   |
| `history/`    | Pagination, snapshot reconciliation, thread restoration, and stale request protection        |
| `follow-ups/` | Queued and steer messages, ordering, consumption, and automatic queue draining               |
| `interrupts/` | Client tool responses, user input requests, and HITL request lifecycles                      |
| `runs/`       | Run identity, loading and pause state, cancellation, and stream resumption                   |
| `transport/`  | Request options, SSE consumption, submission, and optimistic rollback                        |
| `host/`       | Host notifications, parent messenger access, and history discovery                           |
| `session/`    | Reset, unmount cleanup, and thread-change invalidation                                       |
| `testing/`    | Shared history integration fixture, mocks, and per-test setup                                |

## Boundaries

- Keep feature hooks mounted together in `StreamSession`. The provider's scope
  key still determines when a change of assistant or project remounts the session.
- `types.ts` and pure helpers do not import the public provider at runtime.
  Feature contracts use type-only imports and select the required fields with
  `Pick` and `ReturnType`.
- Preserve stable callbacks and refs across renders. Pending requests rely on
  thread identity, request identity, and abort checks to reject stale results.
- Keep the submission ref as the bridge used by follow-up and interrupt flows;
  those features must not import or instantiate another submission controller.
- Keep cleanup and reset behavior in `session/`, while each feature owns its
  state. Pausing the display, cancelling a run, and disconnecting a stream remain
  distinct operations.
- Tests live beside their feature and continue to exercise the public exports
  through `../Stream.tsx`. The shared fixture only supplies mocks and setup;
  individual suites retain their assertions.

Follow the file-size guidance in the repository's `AGENTS.md` during review;
no dedicated line-count gate is required.
