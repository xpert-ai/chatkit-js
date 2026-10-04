# Task Summary Panel: Section and Content Completeness Audit

> Historical audit: 2026-09-01, with implementation updates on 2026-09-02. Scope: `chatkit-js`, `xpert-sdk-js`, `xpert-develop`, and `xpert-plugins`. The implementation status below takes precedence over the initial snapshot. Repository revisions and line references describe that audit, not a fresh review of today's code. Deferred recommendations are not shipped features.

## Implementation status: 2026-09-02

This iteration retained the names, order, and grouping of all six sections. It corrected which items enter them and whether existing content can be viewed completely.

Repository boundaries:

- `xpert-plugins`: no changes or producer migrations.
- `xpert-sdk-js`: no public type or API additions.
- `xpert-develop`: server task-summary extraction and aggregation only; no `plugin-sdk` changes.
- `chatkit-js`: live aggregation, history merging, and content within the existing six sections.

| Issue                                                            | Implemented behavior                                                                               | Repository                    |
| ---------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- | ----------------------------- |
| Non-Agent nodes appeared in Agent activity                       | Both history and live data require `category === 'agent'` and a `parentId`.                        | `xpert-develop`, `chatkit-js` |
| Three preview items replaced the Agent history total             | Merging preserves `history.agents.total`.                                                          | `chatkit-js`                  |
| Pending/running/failed or unopenable entries appeared as outputs | Outputs must be complete and have a `workspace_file`, `artifact`, or `url` resource.               | `xpert-develop`, `chatkit-js` |
| MCP Apps were counted as outputs                                 | MCP App components remain message components, not Output entries.                                  | `xpert-develop`, `chatkit-js` |
| Configured skills/plugins were claimed as sources                | Live Sources no longer derive from capability selection; explicit, traceable contributions remain. | `chatkit-js`                  |
| Todos/services after the third item were inaccessible            | Three-item previews can expand/collapse locally, without a new API.                                | `chatkit-js`                  |
| Descriptions replaced status                                     | Status and description appear on separate lines.                                                   | `chatkit-js`                  |
| Agent failure reasons were hidden                                | Rows show status, elapsed time, and a compact error.                                               | `chatkit-js`                  |
| Truncated text had no complete view                              | Tooltips expose the full title, status, and description.                                           | `chatkit-js`                  |
| Raw English statuses were hard to read                           | Common Goal, Todo, Output, Running, and Agent statuses have English and Chinese labels.            | `chatkit-js`                  |

Explicitly deferred:

- A unified plugin output envelope, Plugin SDK builder, and representative producer migrations.
- SDK contracts for `ThreadGoal.goalSpec`, pending details, and section/page type associations.
- Section restructuring, including moving Pending first, renaming Task, or combining Running and Agent activity visually.
- Producers that emit no openable resource. Readers do not infer outputs from arbitrary text paths or URLs.

## Findings and recommended information structure

The panel needs information hierarchy and presentation improvements, without merging or renaming backend API sections simply to match UI grouping.

The audited UI has six peer sections: Outputs, Sources, Task, Running, Agent activity, and Pending. Outputs, Sources, and Pending have preview and pagination paths for recognized items. End-to-end business completeness still has gaps in every section.

The recommended, deferred layout is:

```text
Needs your attention (first, only when nonempty)
Task progress
Outputs
Execution activity
  ├─ Agent / node executions
  └─ Running services
Reference sources
```

Pending requires immediate action. Task should describe combined Goal/Plan/Todo progress. Outputs deserve higher priority than internal execution details. Running and Agent activity can share a visual container while retaining distinct data sources. Sources must represent actual references, not merely enabled capabilities; this iteration stopped deriving them from capability selection.

## Data flow and ownership

```text
xpert-plugins
  Tool results, files, Artifacts, and App payloads
       ↓
xpert-develop
  Extract/persist message.taskSummary; aggregate history snapshots/pages
       ↓
xpert-sdk-js
  Expose task-summary and sandbox services APIs/types
       ↓
chatkit-js
  Merge history/live data; render the panel; emit resource-open events
       ↓
xpert-develop / ClawXpert host
  Open workspace files, Artifacts, browser services, or URLs
```

| Completeness layer | Question                                                               | Primary owner                   |
| ------------------ | ---------------------------------------------------------------------- | ------------------------------- |
| Production         | Are real outputs, sources, and task state in a common structure?       | `xpert-plugins`                 |
| Contract           | Do API/SDK types declare the fields the UI needs?                      | `xpert-develop`, `xpert-sdk-js` |
| Aggregation        | Are history, live data, deduplication, totals, and pagination correct? | `xpert-develop`, `chatkit-js`   |
| Presentation       | Is available data truncated, overwritten, or hidden?                   | `chatkit-js`                    |
| Actions            | Can an item locate its message or open its resource?                   | `chatkit-js`, ClawXpert host    |

## Section overview at the audit revision

| Section        | Displayed content                                          | Count and expansion                             | End-to-end limitation                                             |
| -------------- | ---------------------------------------------------------- | ----------------------------------------------- | ----------------------------------------------------------------- |
| Task           | Goal, Plan, Todo                                           | One Goal/Plan; three Todos with local expansion | Richer Goal fields are not shown.                                 |
| Outputs        | Completed, openable output title/status/description        | Three-item preview; pages up to 50              | Producer coverage is incomplete.                                  |
| Sources        | Explicit sources, references, attachments, knowledge bases | Three-item preview; pages up to 50              | Invocation evidence for capabilities still needs a contract.      |
| Running        | Active sandbox services                                    | Three-item preview with local expansion         | Richer service details are not shown.                             |
| Agent activity | Latest real child-Agent execution per `agentKey`           | Pagination preserves the server total           | Root and older runs are intentionally collapsed.                  |
| Pending        | Approvals, user input, queued follow-up/steer              | Three-item preview and pagination               | Full questions and approval context are absent from the contract. |

Evidence: `packages/chatkit-ui/src/components/task-summary/TaskSummary.tsx:220-374`. The six sections and their order were also asserted by `TaskSummary.test.tsx:7-36` in that directory.

## Section details

### 1. Task

Displayed fields are Goal `objective`/`status`, Plan `title`/`excerpt`, and Todo `content`/`status`. Todos start with three entries and can expand to the complete current list.

Available but undisplayed data includes Goal `tokensUsed`, `elapsedSeconds`, `continuationCount`, status/completion/blocking timestamps, `goalSpec` (executable objective, success criteria, constraints, verification checklist, recommended strategy), and the Todo group's title.

Plan/Todo prefer canonical contributions in `message.taskSummary`, `data.taskSummary`, or `_meta['xpertai/taskSummary']`. Without these, Plan recognizes only `<proposed_plan>` and the server reduces it to a 160-character excerpt. Todo fallback recognizes only `write_todos`, retaining only the latest group. SDK `ThreadGoal` omits `goalSpec`: JSON retains it at runtime, but typed access is unavailable.

The first loss occurs in ChatKit presentation for Goal metrics/Todo titles, the SDK contract for `goalSpec`, and server extraction for producer coverage.

Evidence:

- `packages/chatkit-ui/src/components/task-summary/TaskSummary.tsx:270-311`
- `packages/chatkit/src/message.ts:678-702`
- `xpert-sdk-js: packages/core/src/schema.ts:1282-1296`
- `xpert-develop: packages/server-ai/src/chat-message/task-summary.ts:193-253`

### 2. Outputs

Recognized inputs include explicit `taskSummary.outputs`, `image_url`, `iframe`, some `artifact`/`artifactLink`/`file` shapes, and some structured tool outputs. Entries must also be complete and contain an openable `workspace_file`, `artifact`, or `url` resource. MCP Apps remain message components.

The item contract contains `id`, `kind`, `title`, `description`, `status`, `resource`, `messageId`, and `updatedAt`. Rows use a generic file icon rather than distinguishing images, documents, spreadsheets, presentations, sites, or URLs. Status and description are both shown, but `updatedAt` is not. MIME, size, author, and version are absent from the contract; richer data belongs in details rather than indefinitely expanding each row.

At the audited workspace and local `origin/main`, `xpert-plugins` had no production `taskSummary` or `xpertai/taskSummary` producers. Detection depended on server heuristics. Relatively reliable shapes were:

- Top-level `artifact`, `artifactLink`, or `file`.
- Top-level `artifactId`.
- `files[]` in `content_and_artifact` results.
- Objects or JSON strings in `data.output`, with a resource at the payload root, `payload.artifact`, or `payload.file`.

The general extractor did not recursively recognize `payload.share`, `payload.export`, `payload.candidate`, `structuredContent`, lone `shareUrl`/`exportUrl`/text paths, or array/tuple entries containing `{ files: [...] }`.

The first loss is at the producer when no canonical envelope is emitted, in ChatKit live aggregation for richer shapes recognized only by the server, and in presentation for existing kind/time fields.

Evidence:

- UI: `packages/chatkit-ui/src/components/task-summary/TaskSummary.tsx:220-246`
- Live extraction: `packages/chatkit-ui/src/lib/task-summary.ts:395-505`
- Server extraction: `xpert-develop: packages/server-ai/src/chat-message/task-summary.ts:445-695`
- SDK contract: `xpert-sdk-js: packages/core/src/schema.ts:1310-1327`

### 3. Sources

Recognized sources include explicit `taskSummary.sources`, code/quote/image/web-element/file-element references, message attachments/file assets, `xpert://knowledgebase/chunk` references, and traceable skill/plugin contributions explicitly supplied in `taskSummary.sources`.

Capability selection no longer directly creates sources. Evidence of actual connector/skill/plugin invocation still lacks a contract. Explicit skill/plugin titles remain producer-supplied without common name resolution. `kind` and `updatedAt` exist but are not displayed. A normal web URL is not automatically a source unless represented as a reference or contribution. Server-side `sub_agent` sources are excluded in favor of Agent activity.

Recommended semantics: sources should be real references, attachments, knowledge bases, and traceable web/file inputs. Selected but unused capabilities belong in a separate enabled-capabilities area, if shown at all. A future used-capabilities display requires invocation records and connector coverage.

The first loss is in server/contracts for usage evidence and ChatKit presentation for name resolution, kind, and time. The live selection-as-source error was fixed; historical explicit contributions remain producer-supplied facts.

Evidence:

- `packages/chatkit-ui/src/lib/task-summary.ts:507-620`
- `packages/chatkit/src/message.ts:413-434`
- `xpert-develop: packages/server-ai/src/chat-message/task-summary.ts:698-835`
- `xpert-develop: packages/server-ai/src/chat-conversation/task-summary.service.ts:142-146`

### 4. Running

Rows show the service name, active status (`starting`, `running`, `stopping`), actual or requested port, and a browser resource for opening a preview.

Running is not a task-summary snapshot/page section. ChatKit reads the separate, authoritative sandbox services API. It hydrates on thread changes, refreshes on service start/list/stop tool events, polls transitioning services every two seconds and running services every 20 seconds, then retains active services for display. It does not reconstruct service state from old tool messages.

The first three entries can expand locally. Port description and status appear on separate lines. Available command, cwd, owner, start/stop times, and exit code are not shown. Errors may exist only in server `metadata.error`; SDK metadata is typed `unknown`. Service-loading errors and refresh status are not presented within this section. The first loss is in the ChatKit view model and presentation.

Evidence:

- `packages/chatkit-ui/src/components/chat.tsx:1526-1552`
- `packages/chatkit-ui/src/components/task-summary/TaskSummary.tsx:314-334`
- `packages/chatkit-ui/src/providers/runtime-activities.ts:156-285,376-499`
- `packages/chatkit-ui/src/lib/runtime-activity.ts:17-24`
- `xpert-sdk-js: packages/core/src/schema.ts:1126-1183`

### 5. Agent activity

Server aggregation queries thread executions, keeps only `category=agent` children with a `parentId`, groups by `agentKey` (or ID when absent), retains the latest execution for each key, and sorts by update time descending. It is not a complete execution history.

Rows show title, status, elapsed time, and a compact error when available. Clicking locates the corresponding message, or focuses the composer if no message exists. Root/primary executions and earlier runs of the same Agent are excluded. `level` and `updatedAt` are not displayed. ChatKit now retains the real server total, allowing history beyond three Agents to load.

Root exclusion and historical collapsing are server product semantics requiring a decision before change. Missing level/time is a presentation gap; errors are now visible.

Evidence:

- Server collection: `xpert-develop: packages/server-ai/src/chat-conversation/task-summary.service.ts:147-173`
- Server grouping: the same file at `287-298`
- Live collection: `packages/chatkit-ui/src/lib/task-summary.ts:647-668`
- Total merging: the same file at `710-761`
- UI: `packages/chatkit-ui/src/components/task-summary/TaskSummary.tsx:336-355`

### 6. Pending

Sources are conversation operation tasks, queued follow-up/steer messages, interrupted-conversation fallback, live `request_user_input`, and live HITL approvals.

Items have `kind`, `title`, optional `description`, optional `messageId`, and optional `createdAt`. The UI shows title/description and uses `messageId` for navigation. It does not display kind or creation time.

The contract lacks approval payloads, tool/operation parameters, Agent identity, question arrays, and options. Server operations project task title/description or a generic title. Queued follow-ups have a generic title rather than their message body. Live `request_user_input` includes only the first question's `header`, not its `question` or `options`. Full input interaction remains in the composer; this section is a compact entry point.

The first loss is in server/SDK contracts for historical questions, options, and approval context; the Chat adapter for live question summaries; and presentation for kind/time.

Evidence:

- `packages/chatkit/src/interrupt.ts:15-29`
- `packages/chatkit-ui/src/components/chat.tsx:1482-1519`
- `packages/chatkit-ui/src/components/composer/request-user-input-panel.tsx:487-675`
- `xpert-develop: packages/server-ai/src/chat-conversation/task-summary.service.ts:218-271`
- `xpert-sdk-js: packages/core/src/schema.ts:1395-1402`

## Shared presentation limitations

`SummaryButton` uses a one-line truncated title and a two-line clamped description. Full title, status, and description are available through a tooltip, with no inline expansion or details button. This keeps rows compact while exposing long tasks, filenames, source descriptions, and errors. Evidence: `packages/chatkit-ui/src/components/task-summary/TaskSummary.tsx:414-455`.

The translated **View all** label does not display the supplied total. Todo and Running expand locally rather than calling a nonexistent pagination API. Output/Running show both status and description. Common Goal, Output, Agent, and Running statuses are localized; unknown values remain unchanged.

## Plugin output coverage at the audit revision

This matrix compares actual workspace payloads with the audited server extractor. It describes output-list recognition, not complete task, Todo, or source coverage. Paths are within `xpert-plugins`.

| App                 | Coverage                | Reason and evidence                                                                                                                                                                                                           |
| ------------------- | ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Office CLI          | Relatively complete     | create/edit/restore/get-file/apply-design use `content_and_artifact + files[]`; `xpertai/apps/office-cli/src/lib/office-cli.middleware.ts:142-315`                                                                            |
| Sites               | Recognized              | deploy/create-and-deploy/publish return top-level `artifactId`; `xpertai/apps/sites/src/lib/sites.middleware.ts:191`                                                                                                          |
| draw.io             | Recognized              | publish returns top-level Artifact IDs; the server also special-cases tool names; `xpertai/apps/drawio/src/lib/drawio.middleware.ts:252`                                                                                      |
| Lucidchart          | Recognized              | publish returns top-level `artifactId/artifactLinkId`; `xpertai/apps/lucidchart/src/lib/lucidchart.middleware.ts:224`                                                                                                         |
| Office Editor       | Partial                 | Excel edit/restore/get-file return standard files; document/presentation create/read/queue-edit return ordinary JSON; `xpertai/apps/office-editor/src/lib/office-editor.middleware.ts:228`                                    |
| Presentation Studio | Partial                 | theme preview/export return files; `presentation_share_html` returns only `shareUrl`; `xpertai/apps/presentation-studio/src/lib/presentation-studio.middleware.ts:195-278`                                                    |
| Docx Editor         | Partial                 | publish returns top-level `artifactId`; imported paths are nested in `importedFile`; `xpertai/apps/docx-editor/src/lib/docx-editor.middleware.ts:288`                                                                         |
| Cut                 | Limited                 | Subtitle export has a top-level file; ordinary export nests `fileReference`, native MCP uses `structuredContent`; `xpertai/apps/cut/src/lib/cut.middleware.ts:862` and `cut-native-capabilities.ts:249` in the same directory |
| Canvas              | Missed                  | Artifact IDs are in `payload.share`; `xpertai/apps/canvas/src/lib/canvas-artifact-export.service.ts:521`                                                                                                                      |
| Pencil              | Missed                  | Files are in `payload.export.workspacePath`; publish returns only `shareUrl`; `xpertai/apps/pencil/src/lib/pencil-agent-response.ts:15`                                                                                       |
| Motion              | Missed                  | Returns `exportPath/exportUrl`, not canonical file/artifact shapes; `xpertai/apps/motion/src/lib/motion-agent-response.ts:125`                                                                                                |
| Story Studio        | Missed or misidentified | Files are in `payload.candidate.workspacePath`; a business `id` may be mistaken for an Artifact ID; `xpertai/apps/story-studio/src/lib/story-generated-media.service.ts:187-220`                                              |
| Excalidraw          | Missed                  | Preview returns array/tuple `{files}` without a standard response format; publish returns only `shareUrl`; `xpertai/apps/excalidraw/src/lib/diagram-engine/diagram.middleware.ts:171-188`                                     |

There were no production MCP App producers in the audited Apps, only `xpertai/examples/echarts-mcp-app`. Story Studio's `StoryVideoTaskSummary` is a video-task DTO, not the ChatKit task-summary contract. Model generation tools from Kling, SiliconFlow, Veo, Volcengine, and Zhipu, plus zip/unzip/pdfium, generally use `content_and_artifact + files[]` and were recognized more reliably. Standardize the producer contract rather than adding more tool-name special cases.

## SDK and API contracts

Supported at the audit revision:

- `GET /conversations/:conversationId/task-summary`
- `GET /conversations/:conversationId/task-summary/:section`
- Paginated sections: `outputs | sources | agents | pending`
- Snapshot: `task` plus four preview lists.
- Page: `section + items + total + offset + limit`.

The SDK parses JSON and asserts the return type; it does not strip extra server fields. Most existing-but-undisplayed data is therefore not lost in transport.

Contract gaps were `ThreadGoal.goalSpec`, Pending question/option/approval/operation data, and a page union that did not associate the section discriminator with its item type. ChatKit consequently needed assertions while loading pages. Running uses a separate services API.

Evidence: `xpert-sdk-js: packages/core/src/client.ts:3054-3078`, `packages/core/src/schema.ts:1282-1443`, and `packages/chatkit-ui/src/hooks/useTaskSummary.ts:105-149`.

## Historical and live consistency

The server snapshot returns three items and the true total for each paginated section. Pages default to three items and cap at 50. Each page recomputes the full aggregation and slices it; this is not database cursor pagination.

For historical messages with `taskSummary IS NULL`, summary GET requests backfill in batches of 100 without a total bound, so this read path performs writes. Existing version-1 summaries only have outputs re-extracted and supplemented, not sources/plans/todos.

The live ChatKit extractor is not identical to the server extractor. The server recognizes `artifact.files`, `filePath`, MIME/extensions, structured `data.output`, and knowledge-base Markdown links more broadly. An item can therefore be absent during a run and appear only after reloading a historical snapshot.

Prefer canonical producer contributions and ensure persisted `message.taskSummary` reaches live state. Separate, growing frontend/backend heuristics would continue to drift.

## Resource opening at the audit revision

| Resource         | Handler                                               |
| ---------------- | ----------------------------------------------------- |
| `message`        | ChatKit locates the message.                          |
| `workspace_file` | ClawXpert opens a file preview.                       |
| `artifact`       | ClawXpert requests a signed link and opens a preview. |
| `browser`        | ClawXpert opens or reuses a browser tab.              |
| `url`            | ClawXpert opens an HTTP(S) browser tab.               |

Evidence: `packages/chatkit/src/task-summary.ts:1-27`, `packages/chatkit-ui/src/components/chat.tsx:1630-1650`, and `xpert-develop: apps/cloud/src/app/features/chat/clawxpert/clawxpert-task-summary-effect.utils.ts:51-90`.

At final audit verification, uncommitted `xpert-develop` work added authenticated download fallback for private workspace files without public URLs. The local `origin/develop` baseline lacked it, so universal private-file opening was not a released capability at that point.

## Confirmed issues and recorded status

| ID    | Issue                                                 | Primary owner                   | Status in this iteration         |
| ----- | ----------------------------------------------------- | ------------------------------- | -------------------------------- |
| TS-01 | Agent history total overwritten by preview length     | `chatkit-js`                    | Fixed                            |
| TS-02 | Todos after the third item inaccessible               | `chatkit-js`                    | Fixed                            |
| TS-03 | Services after the third item inaccessible            | `chatkit-js`                    | Fixed                            |
| TS-04 | Existing Agent errors hidden                          | `chatkit-js`                    | Fixed                            |
| TS-05 | Descriptions replaced Output/Running status           | `chatkit-js`                    | Fixed                            |
| TS-06 | Truncated titles/descriptions without complete detail | `chatkit-js`                    | Full-text tooltip added          |
| TS-07 | Non-Agent child executions in Agent activity          | `xpert-develop`                 | Fixed                            |
| TS-08 | Missing Pending questions/options/approval context    | `xpert-develop`, `xpert-sdk-js` | Deferred                         |
| TS-09 | No common task-summary/artifact producer contract     | `xpert-plugins`                 | Deferred; no plugin changes      |
| TS-10 | Live extraction lags historical extraction            | `chatkit-js`, `xpert-develop`   | Partially aligned; still present |
| TS-11 | Capability selections treated as sources              | `xpert-develop`, `chatkit-js`   | Live aggregation fixed           |
| TS-12 | SDK omits `ThreadGoal.goalSpec`                       | `xpert-sdk-js`                  | Deferred; no SDK changes         |
| TS-13 | SDK page section/item types are not associated        | `xpert-sdk-js`                  | Deferred; no SDK changes         |

## Deferred work and completed portions

### Slice A: ChatKit presentation

The proposed slice moved Pending to a conditional top action area, renamed Task to Task progress, and grouped Running/Agent activity visually while keeping separate data groups. It also preserved server totals, expanded Todos/services, showed status with description, displayed compact Agent errors, localized kinds/statuses, and exposed complete text.

Totals, expansion, status/description, errors, tooltips, and status translations were completed. Section restructuring and kind icons were deferred. This slice needs no public API change and must not combine services and Agents into one pagination contract.

### Slice B: Server aggregation semantics

Distinguishing Agent executions from workflow/tool/code nodes was completed. Capability selection stopped being treated as a source; a real used-capabilities contract was deferred. Decisions about root exclusion, latest-per-Agent grouping, supplementation of historical version-1 sources/plans/todos, and moving backfill out of GET remained open.

### Slice C: Producer standardization

Prefer canonical `content_and_artifact + files[]` or top-level artifact/file envelopes. Rich summaries should emit explicit `xpertai/taskSummary` contributions rather than hiding files in arbitrary nested payloads or returning only share/export URLs. Tighten inference from arbitrary top-level IDs to require canonical envelopes or Artifact type evidence. Representative fixtures should cover Office CLI, Presentation Studio, Canvas, Story Studio, and Cut.

### Slice D: Contract enhancements

Add `goalSpec` to SDK `ThreadGoal`, associate page sections with item types through a discriminated/generic mapping, and define server pending details before updating SDK/ChatKit if full historical details become a product requirement.

## Acceptance criteria for remaining work

1. Nonempty Pending content is first; empty Pending occupies no space.
2. Every section has a route to entries after the third item.
3. Server Agent totals survive preview merging.
4. Failed Agents expose status and a compact reason.
5. Outputs/services show both status and description.
6. Long titles and descriptions are fully accessible.
7. Merely selected capabilities are not factual sources.
8. Representative plugin outputs agree between live and historical views.
9. Non-Agent executions do not appear as collaborating Agents.
10. All five resource actions have targeted verification.

These are acceptance requirements, not a claim that all deferred work was completed.

## Audit snapshots and verification limits

- **`chatkit-js`:** `main` at `354c40a`, matching `origin/main`; clean at audit start.
- **`xpert-sdk-js`:** `update/workbuddy-composer-sdk@554b8bf`, behind live `origin/main@571e77e` by three commits and ahead by zero. Task-summary source matched `origin/main`; ChatKit's lockfile used SDK `0.1.0`.
- **`xpert-develop`:** initially `update/xpert-workspace-data-isolation@4a0bebec42`. External work moved the shared checkout to `2a2bf1d01` during documentation. It contained substantial pre-existing staged, unstaged, and untracked work. Server task-summary source still matched local `origin/develop` at final verification. Unreleased ClawXpert resource-opening work is identified above.
- **`xpert-plugins`:** `update/cut-native-mcp-publication@107bdca8`, behind local `origin/main` by 37 commits and ahead by zero, with substantial pre-existing work. Absence of production task-summary producers was checked both in the workspace and local `origin/main`. The payload matrix describes workspace code; release status needed rechecking before implementation.

The initial audit used static source and existing tests. After implementation on 2026-09-02, focused ChatKit aggregation/component tests, type checking, lint, and the production build ran. A temporary local bridge verified that the bundle served by `xpert-develop:4200` matched the ChatKit build checksum; no browser was opened, as agreed. Focused server Jest, type checking, and lint passed. The local API was not proactively restarted.
