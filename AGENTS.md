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
