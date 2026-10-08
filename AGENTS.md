# AGENTS.md

## Conventions and guardrails

Guidance for AI agents working in this repository. Keep changes scoped to the target
app and follow existing patterns.

## ChatKit UI file organization

- Keep maintained source, test, and configuration files in `packages/chatkit-ui`
  below 1,000 lines. Split growing files by responsibility, usually aiming for
  300–700 lines per module and reusing existing components and hooks.
- Preserve public interfaces, behavior, and state lifecycles during structural
  refactors. Keep shared types and pure helpers independent of UI entry points.
- Do not meet the size guideline by compressing formatting, removing useful
  comments or tests, or moving the same oversized implementation into one new file.
- Apply this through normal development and review; do not add dedicated line-count
  scripts, CI gates, or lint rules unless explicitly requested.

## Types and platform APIs

- AVOID using arbitrary type checks `asRecord`, for example:
  ```typescript
  ❌const asRecord = (value: unknown): Record<string, unknown> | null => {
  ❌  if (!value || typeof value !== 'object') {
  ❌    return null;
  ❌  }
  ❌  return value as Record<string, unknown>;
  ❌};
  ```
- If the input and output data types are unknown, use a placeholder and request the type definitions from the user.
- Xpert API calls in this repository must go through the `@xpert-ai/xpert-sdk`
  `Client`. Do not call Xpert APIs with native `fetch`, `axios`, or other
  ad hoc HTTP clients. If the SDK does not expose the needed endpoint yet,
  update `@xpert-ai/xpert-sdk` first and ask the user to use that SDK version.

## CI parity and release verification

- Before preparing a PR for release or fixing CI, read the relevant workflow and
  root package scripts. Match the workflow's Node.js major version, the pinned
  `packageManager`, dependency installation mode, and test scope. Check
  `node --version` and `corepack pnpm --version`; do not assume the shell defaults
  match CI or treat a pass on another Node.js major as equivalent.
- Reproduce CI failures using the failing revision and CI runtime before changing
  behavior. Determine whether the failure comes from production code, dependencies,
  or the test environment, and fix it at that boundary.
- Verify the exact changes intended for submission. When unrelated work or local
  dependency patches are present, use an isolated snapshot with
  `corepack pnpm install --frozen-lockfile`. Preserve other work and do not replace
  dependencies used by running services just to reproduce CI.
- Use targeted tests while iterating. Before declaring a code PR ready for release,
  run the full test scope required by its workflow, plus the applicable type and
  build checks. For the release workflow, use the root `corepack pnpm test` script;
  do not substitute only changed test files. Reuse results for the same verified
  tree when appropriate; documentation-only edits do not require application tests.
- Report the tested revision or snapshot, runtime versions, commands, and results.
  If a required check could not run, state that limitation. Local test success does
  not establish that remote CI passed, especially across different operating systems.

## Browser API tests and timers

- Treat Node.js, jsdom, and browser APIs as distinct environments. Tests crossing
  `Response`, `Blob`, `File`, or `FileReader` boundaries must exercise compatible
  real objects and verify bytes, not only mocks that bypass those boundaries.
- Supply missing jsdom APIs conditionally in the shared test setup, preserving
  compatible constructors and binary semantics. Do not add production fallbacks,
  skip failing tests, or downgrade the CI runtime solely to hide a test-environment
  limitation.
- With fake timers, explicitly choose `toFake`. Keep asynchronous I/O scheduling
  such as `setImmediate` live when the tested API needs it, or deliberately advance
  it. Restore real timers after each test; do not hide stalled I/O by increasing
  timeouts.
- Changes to shared test setup affect the entire suite. Add focused regression
  coverage for the affected API boundary and run the full CI test scope under the
  CI runtime before considering the fix verified.
