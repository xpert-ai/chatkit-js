# Message skill usage

## Implementation plan

Add a Skills control to each assistant message footer, with a popover listing the
skills whose main instructions were successfully loaded while producing that
message. This is a runtime observation, not a claim that the model followed every
instruction. Selecting, installing, listing, or unsuccessfully reading a skill
does not count as using it.

### Scope and data flow

1. Extend the shared ChatKit task summary contract with optional `skillUsages`.
   Each record snapshots the skill identity, display name, version, origin,
   tool call, execution, and load time. Do not send local paths or file contents.
2. Instrument the built-in Xpert skills middleware after a successful
   `read_skill_file` read of a registered skill's `SKILL.md`. Cover runtime resource,
   sandbox, and fallback reads. Do not infer usage by parsing shell commands.
3. Attach the observation to the existing tool component event. Keep attribution
   on the assistant message and persist it in the existing JSON task summary.
   Merge all skill observations; the latest contribution must not hide earlier
   skills. Deduplicate repeated reads without mixing separate messages.
4. Preserve the optional field through live streaming and history normalization.
   Render a localized, keyboard-accessible message footer popover showing names
   and actual origins. Older messages without observations remain unchanged.
5. Verify successful/failed/main/reference-file reads, duplicate and multi-skill
   aggregation, message isolation, history restoration, and footer interactions.

### Boundaries

- Platform changes belong in `xpert`; shared contracts and React UI belong in
  `chatkit-js`. No database migration or SDK endpoint is required.
- Existing conversation-reference work is outside this change. Do not alter its
  behavior or local API/Cloud processes.
- This first version observes registered skills read through the built-in tool.
  It cannot retrospectively reconstruct usage for old messages or arbitrary shell
  reads. A future direct instruction-injection path must emit the same contract.
- Skill titles and origin labels are display data, never executable instructions.
  Client-submitted metadata must not create authoritative skill observations.

## Acceptance criteria

- Two successfully read skills appear together under the corresponding answer.
- Repeated reads show a single row; reference files and failed reads add no row.
- Merely selecting a skill does not display it as used.
- Reloading history retains the list; later answers do not inherit the list.
- The control supports pointer, keyboard, Escape, and touch/click interaction.
- Names and origin labels are localized appropriately; no filesystem paths leak.

## Progress

- Plan recorded before implementation.
- Implemented shared contract, runtime observations, persistence and footer UI.

## Implemented protocol

`TChatTaskSummaryContribution` retains `version: 1` and adds an optional
`skillUsages: ChatSkillUsage[]`. The record contains `skillId`, `name`, `version`,
`source: { type, id }`, `activation: 'read'`, `toolCallId`, optional `executionId`,
and `loadedAt`. Identity includes origin type, origin ID, skill ID, and version.
Repeated reads of that identity keep the first observation in the message.

The built-in `read_skill_file` tool uses LangChain `content_and_artifact`:
instructions remain the model-facing content; the artifact carries a typed
`xpert_skill_usage` observation. The stream mapper accepts it only on a successful
`read_skill_file` completion with a matching tool-call ID, and attaches it to that
tool component's `taskSummary`. No additional stream event or endpoint is needed.

The existing upsert handler extracts all successful component observations and
saves the result in the message's JSON summary. A skill-only contribution does not
replace an earlier plan/output contribution. Public message create/update requests
strip client-authored skill observations from both root summaries and components.

ChatKit normalizes the new field for history and reads the same component data for
live messages. The footer is shown after streaming completes. It supports hover,
keyboard focus, click/touch pinning, and Escape. The source labels are Workspace,
Project, Assistant, and Plugin, with Chinese translations. For an explicitly
collapsed process group, its observations are included in the final answer's
footer using the existing human-turn/execution grouping rules.

## Integration and release

1. Publish the shared types and ChatKit UI changes together using
   `.changeset/message-skill-usage.md` and the normal package release workflow.
2. Update Xpert's resolved `@xpert-ai/chatkit-types` dependency and lockfile to the
   actual published version containing this contract, then rebuild API/Cloud with
   the corresponding UI version. Do not assume an existing registry version
contains unpublished source changes.
3. Merge platform changes from `xpert` into `xpert-pro` together with those package
   updates. No schema migration or SDK endpoint changes are required.

Local checks use the workspace's existing linked ChatKit packages; they do not
prove that a fresh registry install contains the new exports. This change does not
publish packages. The initial implementation did not restart API/Cloud; the live
acceptance run below subsequently rebuilt the app and restarted its local Cloud.

## Validation

- ChatKit UI: 996 tests passed in the initial full regression, followed by passing
  tests for the two additional history-restoration/process-group cases.
- Shared types and ChatKit UI library builds, UI TypeScript checks, and
  `git diff --check` passed.
- Backend: 92 tests across 11 focused suites passed. Checks cover all three read paths, failed/reference/unregistered reads,
  concurrent execution attribution, multi-skill/repeated-read aggregation, stream
  component merging, upsert persistence, JSON history restoration, regeneration,
  client metadata stripping, source identity, and existing summary compatibility.
- Runtime tests invoke the real built-in middleware tool, stream mapper, content
  reducer, and upsert handler with mocked filesystem/sandbox/repository boundaries.
  They do not call a live LLM, database, API or browser session.

## Local API / Cloud acceptance — 2026-09-23

Tested the `xpert` API on port 3000 and Cloud on port 4200, with linked local
`chatkit-js` packages. Both serving processes were verified to run from the
`xpert` checkout. Only the previously authorized PostgreSQL and Redis containers
were reused from the `xpert-pro` environment; no `xpert-pro` source was changed.

- Re-ran 10 focused backend suites: **53 tests passed**.
- Re-ran the Skills footer, skill normalization and chat integration suites:
  **85 tests passed**. The production ChatKit app build passed.
- Real model / API: two registered main skills, one repeated read and one missing
  file produced three successful reads, one failure and exactly two persisted
  skill observations. The failed read added no observation.
- Real model / API negatives: selecting skills without reading them, mentioning
  their names in response text, reading only `reference.md`, and a subsequent
  no-tool answer all produced zero observations.
- Browser: the corresponding answer displayed both skill names and Plugin origin;
  Enter opened the popover and Escape closed it after its exit animation.
- Browser live streaming: an answer which merely claimed to have loaded skills
  displayed no Skills control. A subsequent answer which actually called
  `read_skill_file` twice displayed both skills immediately after completion.
  The four persisted answers had usage counts **2, 0, 0, 2**.
- History reload was checked against the same persisted observations. Broader
  regeneration, branching, concurrency and child-agent cases remain covered by
  automated tests, not by this live browser run.

### Environment findings

Cloud initially returned its own Xpert AI HTML for `/chatkit`, causing recursively
nested Cloud iframes. The local `.env` contains a standalone frame URL on port
5173, while this acceptance process deliberately overrides it with `/chatkit`.
The same-origin route requires the ChatKit app build to exist before Cloud starts.
`build:lib` uses `--clean` and can remove `dist/app`; rebuilding the app alone did
not make the existing Cloud dev server rediscover the asset directory. Rebuilding
with `build:app` and restarting only this Cloud process restored the correct
ChatKit document. Its served HTML matched the latest local build; its JavaScript
and stylesheet both returned HTTP 200, and the browser rendered normally.

For this same-origin setup, build the UI app after any clean library build and
before starting Cloud, and verify `/chatkit/index.html` has title `ChatKit`.
Process overrides were retained; the shared `.env` was not rewritten.

The existing Exa and Notion catalog entries pointed to missing local package
files. Their failed reads correctly created no usage records. To test successful
reads independently, this run imported a dedicated local package containing two
inert Markdown skills, with no MCP servers, scripts or external actions. That
does not establish that the existing Exa/Notion installation is healthy. Runtime
identifiers and raw receipts are retained only in the protected local test folder.
The test-only binding was disabled after acceptance; historical test messages were
retained for review. Existing resource bindings and Assistant configuration were
not changed.
