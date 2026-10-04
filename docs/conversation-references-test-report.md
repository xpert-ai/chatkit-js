# Conversation References and read_thread: Test Report

Test date: 2026-09-23. Platform changes and tests ran in `xpert`; the `xpert-pro` workspace remained clean. See the [feature guide](conversation-references.md). All results below are historical acceptance evidence, not a new run against the current repository revision.

## Results

| Scope            | Recorded result                         | Method                                                                                                                                                                  |
| ---------------- | --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ChatKit UI       | 987 tests in 100 files passed           | Full Vitest suite, including real Chat components in jsdom with mocked SDK/services                                                                                     |
| Xpert backend    | 157 tests in 17 selected suites passed  | Jest regressions after the short-handle upgrade, including real Redis/PostgreSQL; two initially failing groups passed after focused fixture corrections described below |
| Xpert SDK        | 103 passed, four existing tests skipped | Full Vitest suite covering query parameters, scope, transport, and cancellation                                                                                         |
| Cloud host       | Nine tests in two suites passed         | Reference normalization and historical attachments; Angular development compilation passed                                                                              |
| Local end-to-end | Listed real flows passed                | API, Cloud, authenticated account, existing model, browser, and persisted tool-call records                                                                             |
| Types and build  | Passed                                  | Server/UI TypeScript and SDK build                                                                                                                                      |
| Diff formatting  | Passed                                  | `git diff --check` in the three modified repositories                                                                                                                   |

The initial backend total of 141 included 11 PostgreSQL cases. The later 157-case total also included two Redis cases; these totals must not be added together. Shared-types and UI ESM/CJS/declaration builds had passed at the implementation checkpoint. This initial test pass did not change UI product code, and the entire platform backend suite was not run.

## Coverage

| Dimension                  | Verified scenarios                                                                                                                                                                                                  |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Search and interaction     | Title search; Assistant/Project scope; exclusion of current/selected conversations; distinct identities for duplicate titles; keyboard selection; Chinese IME composition; Escape; empty results and error recovery |
| Async behavior             | Aborted stale requests; late-response suppression; unmount cancellation; in-flight SDK `AbortError` without retry                                                                                                   |
| Reference lifecycle        | Atomic tokens; Backspace/Delete preserve neighboring text; reference-only submission; queued follow-ups; failed-submit recovery; history normalization/replay; forged DOM labels ignored                            |
| Content boundaries         | Titles rendered as text; client-supplied transcript/permission fields stripped; strict tool parameters; count and parameter limits                                                                                  |
| Middleware                 | Schema hidden without references; activation by current input or history; reevaluation on later input; concurrent-call isolation; other tools and original model messages preserved                                 |
| Authorization and audience | Unreferenced threads; forged conversation/thread pairs; tenant/organization isolation; Assistant families; Project and technical-account audiences; access rechecked on invocation                                  |
| Branches and pagination    | Visible branch only; sibling cursors rejected; captured head isolates pages from new messages; changed branch/deleted head rejects old cursor; soft-deleted parents can be traversed without exposing content       |
| Projection and limits      | Reasoning, unfinished responses, pending/canceled input hidden; outputs off by default; text only; per-item and 60,000-character aggregate limits; at most 20 outputs per message with omission counts              |
| Large history              | A 1,001-message turn scanned at most 500 rows per page without duplicates or omissions; a capacity boundary test, not a concurrency benchmark                                                                       |
| Adjacent regressions       | Conversation ACL, ConversationThread, public principal, persisted follow-up, human input, ToolNode, subgraph registration, conversation search controller                                                           |

## Real database tests and scope

A disposable PostgreSQL 16 container and dedicated `_test` database were used instead of the business database. The container was stopped and removed afterward.

- `thread-reference.integration.spec.ts`: eight cases using real TypeORM tree repositories, closure tables, raw SQL, reader, Middleware, and ToolNode. Coverage included activation from persisted references after reload, output reading, access revocation, forged branch cursors, and malformed JSON.
- `thread-history.query.spec.ts`: three cases using PostgreSQL temporary tables for parent-chain queries, pagination, and scan bounds.

Fixtures defined only the message fields needed by the reader. Conversation access and thread lookup used controlled substitutes, with separate ACL/public-principal regressions. These tests prove database/ORM/tool paths, not full authenticated HTTP guards or a complete Nest application.

## Defects found and fixed

1. **Branch cursor validation:** TypeORM's `createAncestorsQueryBuilder` already bound `:id` to the descendant. An additional query overwrote it with the ancestor, allowing forged sibling cursors. A separate `:ancestorId` and real-database tests for forged head/next positions fixed this.
2. **Malformed historical references:** Object-valued JSON caused `jsonb_array_elements` to throw. The query now checks `jsonb_typeof` and treats non-arrays as empty, without breaking unrelated Agent calls.
3. **Non-thread references counted toward the thread limit:** 101 quote references incorrectly triggered the thread-reference limit. Only valid thread references are now counted, with the actual bound and normalization retained.
4. **Non-output events consumed the output quota:** Taking the first 20 events lost later valid outputs. The projection now selects at most 20 textual outputs from all events and reports unsupported/excess omissions.
5. **Cloud host omitted the thread reference type:** `apps/cloud/src/app/@shared/chat/references.ts` failed compilation and navigation/history normalization discarded thread references. Normalization, conversation/thread deduplication, labels, and source handling were added. Three new cases plus attachment regressions passed nine tests.

Two stale wording assertions in `human-input.spec.ts` were aligned with the existing implementation; product prompts did not change. An initial UI run overlapped SDK rebuilding: its clean step briefly removed linked `dist`, causing five suites to fail loading. Rebuilding dependencies first and rerunning produced 987 passing tests. This was a build-order issue, not a product-behavior failure.

## Short cursor acceptance and reproduction

`nextCursor` changed from approximately 207 characters of encoded JSON to a 19-character random handle. Redis stores only pagination state and bound context, with a 30-minute TTL, not message content or authorization decisions. Every read rechecks the reference allowlist, access, and branch. Handles cannot cross callers or source/destination conversations. Old encoded cursors require restarting without `cursor`.

- Thirteen store unit cases covered cross-instance reads, retry without TTL extension, tenant/organization/user/destination conversation/branch/source conversation/branch isolation, expiry, malformed/old cursors, missing cache, collisions, and Redis failure.
- Two real Redis cases used independent connections to read one handle, checked TTL and actual expiry, and created 12 concurrent handles with isolated contexts. This verifies correctness, not throughput.
- One reader case verified that even a valid handle rechecks source access. The previous 11 PostgreSQL cases and adjacent regressions continued to pass.
- The first 17-suite run passed 154 and failed three cases: one fixture mistakenly used a 17-character random suffix; unauthenticated temporary Redis with protected mode blocked two cases. Correcting the fixture and configuring Redis authentication while retaining protected mode yielded 18 passing cases in the two focused groups. All 157 cases therefore had passing records; product code was unchanged between those runs.
- Server TypeScript passed. UI/SDK product code was unchanged, so their full suites were not repeated for this cursor-only update.
- A real `qwen3.6-plus` run called `read_thread` three times with `turnLimit=1`, replayed both 19-character handles verbatim, reached `hasMore=false`, and returned the earliest identifier and latest quantity of 49.

Temporary PostgreSQL and Redis containers were removed after testing. Protected local evidence includes `short-cursor-tests.log`, `short-cursor-retry-tests.log`, `short-cursor-e2e-run.json`, and `short-cursor-e2e-result.json`.

To reproduce Redis cases, supply `THREAD_REFERENCE_TEST_REDIS_URL` through the environment; do not put credentials in source or command text:

```sh
corepack pnpm exec jest --config packages/server-ai/jest.config.ts --runInBand \
  packages/server-ai/src/chat-conversation/thread-cursor.store.spec.ts \
  packages/server-ai/src/chat-conversation/thread-cursor.store.integration.spec.ts
```

### Original feature tests

Run SDK tests/build in `xpert-sdk-js/packages/core` before the UI tests that depend on it:

```sh
corepack pnpm exec vitest run
corepack pnpm run build
```

In `chatkit-js/packages/chatkit-ui`:

```sh
corepack pnpm exec vitest run
corepack pnpm exec tsc --noEmit
```

In `xpert`, set `THREAD_REFERENCE_TEST_DATABASE_URL` to a disposable PostgreSQL database whose name ends in `_test`. These commands cover the original 15 suites; the 11 database cases skip when the variable is absent:

```sh
corepack pnpm exec jest --config packages/server-ai/jest.config.ts --runInBand \
  packages/server-ai/src/chat-conversation/conversation.service.spec.ts \
  packages/server-ai/src/chat-conversation/conversation-thread.service.spec.ts \
  packages/server-ai/src/ai/public-xpert-principal.spec.ts \
  packages/server-ai/src/shared/agent/persisted-follow-up.spec.ts \
  packages/server-ai/src/shared/agent/human-input.spec.ts \
  packages/server-ai/src/xpert-agent/commands/handlers/tool_node.spec.ts \
  packages/server-ai/src/xpert-agent/commands/handlers/subgraph.handler.spec.ts \
  packages/server-ai/src/ai/conversation.controller.spec.ts \
  packages/server-ai/src/chat-conversation/thread-reference.integration.spec.ts \
  packages/server-ai/src/chat-conversation/thread-reference.contract.spec.ts \
  packages/server-ai/src/chat-conversation/thread-reference.service.spec.ts \
  packages/server-ai/src/chat-conversation/thread-read-projection.spec.ts \
  packages/server-ai/src/chat-conversation/thread-history.query.spec.ts \
  packages/server-ai/src/xpert-middleware/thread-reference.middleware.spec.ts \
  packages/server-ai/src/xpert-middleware/thread-reference.runtime.spec.ts
corepack pnpm exec tsc --project packages/server-ai/tsconfig.lib.json --noEmit --incremental false
```

Initial tests used source-built, locally linked types and SDK packages, before npm publication. Those results alone did not prove a clean published-package installation. The later SDK 0.4.1 check below supersedes that limitation for the SDK dependency.

## Local API/Cloud end-to-end acceptance

On 2026-09-23, after the user authorized reuse of existing PostgreSQL/Redis and logged in to Cloud, real acceptance used API and Cloud processes verified to run from `xpert`. No `xpert-pro` source, existing Assistant definition, or model configuration changed.

- API: `http://localhost:3000`; `/api/health/ready` returned 200.
- Cloud: `http://localhost:4200`; page and ChatKit JS/CSS returned 200. `/chatkit/index.html` matched the build and the iframe used same-origin `/chatkit`.
- Ports, API URL, `VITE_CHATKIT_FRAME_URL=/chatkit`, and `DB_SCHEMA_SYNC_MODE=external` were process-only overrides. No `.env` edit or schema synchronization ran. Dedicated acceptance conversations were created through normal APIs.
- API scripts used the platform CLI's Keychain authentication and organization headers. The user logged in to the browser; scripts did not read browser credentials.
- The existing sandbox-independent `Plugin Quickstart Acceptance` Assistant and `qwen3.6-plus` model were used without changing their definitions.

| Live scenario                    | Result and evidence                                                                                                                                 |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| No-reference baseline            | The source completed two turns; no-reference schema hiding was separately covered by Middleware tests.                                              |
| Title search                     | Lowercase SDK queries matched uppercase title markers; typing `@` and title keywords showed the conversation.                                       |
| Select and send                  | Selection created a chip; sending persisted conversation/thread locators and displayed the reference/source.                                        |
| Paged reading                    | With `turnLimit=1`, the model made two real calls; the first returned `hasMore=true`, the second used `nextCursor`, and the answer used both turns. |
| Forged client transcript         | A supplied fake transcript was stripped; the answer came from source history.                                                                       |
| Browser/model flow               | Search, selection, send, and answer completed; persisted successful `ThreadReferenceMiddleware/read_thread` components confirmed tool execution.    |
| Reload and historical activation | The reference/source survived reload. A follow-up with empty human-message references still activated `read_thread`.                                |
| Live source updates              | A new source turn changed quantity 37 to 49. A follow-up without a new reference returned 49, with the new source message in tool output.           |
| Cross-organization access        | The same account, scoped to another authorized organization, received 403 for the source. Authorization was not bypassed.                           |
| Forged locator pairing           | A mismatched conversation/thread pair failed in the real tool; the model reported it unavailable without exposing source facts.                     |

Two observed pagination calls took approximately 26/28 ms. These were single observations, not concurrency benchmarks. Desktop screenshots passed inspection and the file entry remained visible.

Receipts, scripts, and raw calls were retained in the protected local `.xpert-local-environment/thread-reference-20260923/` folder, not committed because they contain environment-specific identifiers. At acceptance close, API/Cloud and the acceptance/source conversations were left available for further inspection; this is not a claim about processes running today.

### Environment limits and remaining acceptance

- The original Claw entry failed before model invocation because `docker-sandbox` lacked `SANDBOX_WORKSPACE_MAPPER`. The successful Assistant did not require a sandbox, so this did not validate the complete Claw sandbox environment.
- Existing Lark plugin SDK-export incompatibility and old scheduler configuration missing OIDC fields remained outside scope. Readiness and the tested flow passed.
- Two distinct users were not tested live. Access revocation, Project/technical-account audiences, and sibling-branch attacks had unit/database coverage but were not all repeated with real login sessions.
- Narrow/dark views, live queued/steered input, concurrency benchmarks, and the complete cross-repository clean published-package installation were not tested. Types/SDK/UI releases still needed coordination.

## SDK 0.4.1 upgrade and review: 2026-09-23

- The UI dependency became `^0.4.1`, resolving the actual published artifact and integrity. Other locked versions were unchanged.
- Frozen-lockfile installation passed. Resolution used the pnpm `0.4.1` package rather than a sibling source link.
- Direct published-package tests verified title and Assistant/Project search scope, cancellation with `AbortError`, and no retry.
- UI regression passed 998 tests in 102 files. UI types, shared types, UI ESM/CJS/declarations, and the production app built successfully. Existing API Extractor TypeScript-version, CJS `import.meta`, and large-bundle warnings remained.
- Review covered normalization, IME/atomic chips, search cancellation/stale results, submission/recovery/history, skill deduplication, attribution, and popover interactions.
- Cloud initially failed to discover newly hashed assets. Restarting only that Cloud process restored matching `/chatkit/index.html` and HTTP 200 JS/CSS. API/database processes were not restarted.

### Fixed P2: Enter on the reference removal button submitted a message

The removal button in `ComposerThreadToken.tsx` sits inside the composer's contenteditable. It handled mouse-down/click without isolating keyboard events. Enter bubbled into `Chat.handleComposerKeyDown` and triggered `submitDraft` instead of only removing the reference, even with no message text.

A temporary real-Chat test reproduced one unexpected `stream.submit` call. It was not retained in the default suite; the 998 passing tests above did not include that failure. Raw diagnostic output remains in protected local receipts.

The fix ignores events from child buttons at the start of `Chat.handleComposerKeyDown`, preserving native Enter/Space activation without treating removal as send, autocomplete, or cursor shortcuts. Permanent Enter/Space regressions check that default button behavior is not canceled, `stream.submit` is not called, the reference is removed, and adjacent draft text remains. Enter failed before the fix; afterward all 1,000 tests in 102 UI files and type checking passed.

Library/app builds passed. Real browser Enter/Space removed only the reference, retained the draft, and did not change message count. The test draft was cleared afterward.
