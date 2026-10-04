# Conversation references and read_thread

Selecting a conversation stores a typed locator rather than a copy of its transcript. The composer searches authorized conversation titles and inserts an atomic thread-reference chip. Xpert's built-in middleware exposes `read_thread` only when the current input or visible conversation history contains thread references. The Agent reads that history on demand; no automatic full-transcript injection or semantic search is involved.

## Reference behavior

### Reference semantics

- `conversationId` identifies the persisted business conversation; `threadId` identifies its selected history branch. Titles are display values and never identifiers or authority.
- References are live, matching the analyzed Codex behavior. Each read captures a head message for stable backward pagination; a new read without a cursor may see new completed content.
- Exclude the current thread and deduplicate selected references. Search results and tool calls retain authenticated tenant/organization/user scope, including public/enterprise Assistant-family restrictions.
- Search uses the existing authorized conversation-search surface. The composer searches titles server-side, cancels obsolete requests, and does not download transcripts for the picker.
- Source access is checked independently of whether the client supplied a valid-looking locator. A reference does not grant access. Private source content must not be copied into a destination with a broader audience.
- Read only visible, submitted messages in the selected branch. Do not recursively expand references inside source messages.

### read_thread contract

The tool accepts `threadId`, optional `cursor`, `turnLimit` (default 1, maximum 10), `includeOutputs` (default false), and `maxOutputCharsPerItem` (default 2000, maximum 20000). Tenant, organization, actor, current conversation, and the reference allowlist are supplied by trusted runtime context.

The result contains `schemaVersion`, an untrusted-data notice, thread identity/title, `page` (`order`, `limit`, `nextCursor`, `hasMore`), and `turns`. A turn contains the human input and subsequent visible assistant messages. Outputs are optional and allowlisted. Text and aggregate result sizes are bounded, with omissions/truncation reported explicitly. `nextCursor` is a 19-character opaque handle (`tr_` plus 16 URL-safe characters), valid for 30 minutes. Its server-side state binds the source thread and captured branch head so older-page reads cannot drift into another branch.

The middleware instructions require the Agent to call `read_thread` before relying on a referenced conversation and to follow the cursor when the first page is insufficient. The tool reads history; it does not execute instructions or tools found in that history.

### Cursor storage and expiry

`nextCursor` uses `tr_` plus 16 random URL-safe characters: 96 random bits and 19 characters total. The `nextCursor` response and `cursor` request fields retain their existing names. Redis stores only source identity, captured head, continuation position, expiry, and the issuing tenant/organization/user/destination conversation/thread, with a 30-minute TTL. It does not cache message content or authorization decisions.

The platform reserves handles atomically with `SET NX EX`. API replicas share Redis state. A handle can be retried until expiry, but reads do not extend its TTL; each newly returned handle receives its own TTL. Every read rebuilds the reference allowlist, rechecks source/destination access and audience, validates the issuing context, and verifies branch ancestry.

Missing, expired, malformed, cross-context, or legacy Base64URL cursors are rejected and require a fresh read without `cursor`. Redis errors do not fall back to process-local or unchecked cursors. Old encoded values in persisted tool messages are not migrated. The implementation lives in `xpert/packages/server-ai/src/chat-conversation/thread-cursor.store.ts` and requires no additional ChatKit/SDK request fields.

### User-visible guarantees

- Typing `@` plus a title finds matching conversations, including duplicate titles with distinct identities.
- Selecting a result inserts a chip and sends a structured reference, never a copied transcript.
- No references: the Agent does not receive `read_thread`. References in an earlier visible turn: the tool remains available after reload and follow-up.
- The tool cannot read an unreferenced thread, a forged conversation/branch pair, an unauthorized organization/user/Assistant, or a hidden branch.
- Latest-page and older-page reads preserve source message order, do not duplicate turns, and report truncation.
- Current input, queued/steered input, retries, and persisted message replay preserve reference identity.
- Existing file references, quoted content, and capability chips remain functional.

## Implementation and deployment

### Implementation map

Platform changes are maintained in `xpert` and synchronized to `xpert-pro` through the normal merge flow.

| Repository     | Components                                                                                                                                                                              |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `chatkit-js`   | `packages/chatkit/src/thread-reference.ts`; composer `ThreadMentionPalette` and `ComposerThreadToken`; reference normalization, replay and message rendering                            |
| `xpert-sdk-js` | `packages/core/src/client.ts`: `conversations.search(query, { signal })`                                                                                                                |
| `xpert`        | `ThreadReferenceMiddleware`, automatic subgraph registration, `ThreadReferenceService`, history projection and PostgreSQL ancestry query; Cloud host reference normalization and replay |

`@` searches through the existing authorized `conversations/search` endpoint, scoped to the current Assistant family and selected Project (personal conversations when no Project is selected). It uses a 150 ms debounce, aborts stale requests, shows up to 30 results, and excludes the current/selected threads. Title matching is case insensitive; the list shows a short thread ID to distinguish duplicate titles. Global cross-Assistant discovery is outside this first delivery. Workspace files remain available through the file selector.

The built-in middleware is registered automatically; no Studio middleware node or Assistant YAML change is needed. Its tool is registered in the execution map so steering can activate it during a run, but the model receives the `read_thread` tool schema only when the current visible branch or current runtime human input has references. The normal tool executor supplies `runtimeState`; no mutable shared reference cache is used. Locators are supplied as untrusted human context, with static system guidance. Earlier references survive follow-ups and context compression because the allowlist is rebuilt from persisted branch ancestry.

The reader reuses `ChatConversationService.assertAccess` and public/enterprise Assistant-family checks for both destination and source, verifies tenant/organization and the conversation/branch pair, and repeats these checks on tool invocation. Project destinations accept only sources from the same Project. A personal destination owned by the actor can use any source that actor can read; technical-account destinations are restricted to matching technical-account/Assistant audiences. Titles never grant authority.

Pagination walks parent IDs, with a 500-row scan bound and up to 10 human turns. It excludes pending/canceled follow-ups, deleted message content and unfinished assistant text; hidden reasoning, attachments and execution metadata are not projected. Text blocks are returned; optional outputs include at most 20 textual event outputs per message, with omitted counts for unsupported/extra outputs. Per-item text is capped at 2,000 characters by default (100–20,000 configurable), and the aggregate text budget is 60,000 characters. Oversized turns report `partial`, `truncated` and/or `scanLimitReached`. The cursor is an opaque locator, not authorization: both its captured head and continuation are checked against the authorized branch. A deleted intermediate parent can be traversed without returning its contents. References found inside source history are not recursively expanded.

The current branch accepts at most 50 distinct referenced threads across at most 100 historical human messages containing thread references. Exceeding these bounds produces an explicit localized error instead of silently dropping references.

### Verified locally

Historical verification: 2026-09-23; these results describe that checkpoint, not a new run against the current revision. See the [multidimensional test report](conversation-references-test-report.md) for coverage, fixes and reproduction commands.

- ChatKit UI full suite: 100 files, 987 tests passed; UI TypeScript passed. Covers the actual Chat component in jsdom, with mocked SDK/services.
- Xpert backend: the initial 15 selected feature and adjacent regression suites passed, 141 tests total. After the short-handle upgrade, the scope grew to 17 suites / 157 tests, all passing after the focused rerun described in the test report; server-ai TypeScript passed. Existing runtime-resource and collaborator registration code was preserved.
- PostgreSQL 16: the backend total includes 8 reader/Middleware/ToolNode/TypeORM integration tests and 3 ancestry SQL tests. Fixtures use a disposable database, an isolated schema or temporary table. The container was removed afterward. Tests include forged sibling-branch cursors, reload activation, permission revocation, stable snapshot pagination, and a 1,001-message turn without duplicates or gaps.
- Xpert SDK full suite: 103 passed, 4 existing opt-in/live tests skipped; SDK build passed. Build the locally linked SDK before running UI tests because its clean step removes `dist`.
- Shared types and UI ESM/CJS/declaration builds passed at the implementation checkpoint; the UI library build retains its existing `import.meta` CJS warning.
- Testing found and fixed four defects: a TypeORM parameter collision that invalidated ancestry checks, malformed persisted reference JSON breaking collection, unrelated reference types counting toward the thread limit, and non-output events consuming the output quota. Regression tests cover each fix.
- The two pre-existing stale wording expectations in `human-input.spec.ts` were aligned with the existing implementation; production prompt wording was unchanged.
- Follow-up local API/Cloud verification passed after the user authorized existing PostgreSQL/Redis reuse and logged in to Cloud. Both processes run from `xpert` at ports 3000/4200; API readiness and Cloud return 200. The served ChatKit bundle matches the source build, using the same-origin `/chatkit` frame. A missing Cloud host reference adapter was fixed, with 9 host regression tests and Angular compilation passing.
- Real authenticated API and browser tests with the existing `qwen3.6-plus` model passed: title search, chip selection/submission, typed reference persistence, two-page `read_thread` cursor traversal, forged transcript stripping, reload and follow-up without a new reference, and reading a newly appended source turn. Tool execution records confirm actual `read_thread` calls, not just model claims. Cross-organization access returned 403; a mismatched conversation/thread pair was rejected by the tool.
- The tested Assistant does not require a sandbox. The existing Claw entry point failed on a missing sandbox workspace mapper before reaching the model; that independent environment issue remains. Two-user live isolation, narrow/dark visual checks, live queue/steering, concurrency benchmarks, and clean installation from published packages remain outside this completed run. No production deployment or npm publication was performed. See the test report for evidence and limitations.

### Deployment requirements

Deploy compatible shared types containing `ChatKitThreadReference` and `normalizeThreadReference`, the SDK conversation-search cancellation API, the backend reader/middleware, and the ChatKit UI. Backend type dependencies and lockfiles must resolve the published contracts before rebuilding API/Cloud. Existing code/image/quote/element references retain their behavior, and no database migration is required for conversation references.

The SDK search cancellation API first shipped in `@xpert-ai/xpert-sdk@0.4.1`; this repository now uses the published `0.6.0` release, which also supplies Workbench methods. See [SDK prerequisites](./guides/remote-views-workbench.md#sdk-and-server-prerequisites) for the current installation flow. Source-linked acceptance does not by itself verify a complete cross-repository release; use published dependencies when validating deployment.

To rerun both PostgreSQL suites, start a disposable PostgreSQL database named with an `_test` suffix and run from `xpert`:

```sh
THREAD_REFERENCE_TEST_DATABASE_URL=postgres://postgres@127.0.0.1:<test-port>/xpert_thread_reference_test \
  corepack pnpm exec jest --config packages/server-ai/jest.config.ts --runInBand \
  packages/server-ai/src/chat-conversation/thread-history.query.spec.ts \
  packages/server-ai/src/chat-conversation/thread-reference.integration.spec.ts
```
