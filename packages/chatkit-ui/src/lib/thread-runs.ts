import type { Run } from '@xpert-ai/xpert-sdk';

const ACTIVE_RUN_STATUSES = new Set<Run['status']>(['pending', 'running']);

function runTimestamp(run: Run): number {
  const timestamp = Date.parse(run.updated_at || run.created_at);
  return Number.isFinite(timestamp) ? timestamp : 0;
}

/**
 * Resolve the newest active root run returned by the thread runs endpoint.
 *
 * A newly-created run can exist before the first assistant message is
 * persisted. Thread loading must therefore use the run ledger as the source
 * of truth instead of waiting for a message.executionId to appear.
 */
export function resolveActiveThreadRunId(runs: readonly Run[]): string | null {
  const activeRun = runs
    .filter(
      (run) =>
        ACTIVE_RUN_STATUSES.has(run.status) && Boolean(run.run_id?.trim()),
    )
    .sort((left, right) => runTimestamp(right) - runTimestamp(left))[0];

  return activeRun?.run_id.trim() || null;
}

export async function waitForActiveThreadRunId(
  loadRuns: () => Promise<readonly Run[]>,
  options: {
    attempts?: number;
    intervalMs?: number;
    shouldContinue?: () => boolean;
  } = {},
): Promise<string | null> {
  const attempts = Math.max(1, options.attempts ?? 20);
  const intervalMs = Math.max(0, options.intervalMs ?? 250);

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    if (options.shouldContinue && !options.shouldContinue()) return null;

    const runId = resolveActiveThreadRunId(await loadRuns());
    if (runId) return runId;
    if (attempt === attempts - 1) break;

    await new Promise<void>((resolve) => setTimeout(resolve, intervalMs));
  }

  return null;
}
