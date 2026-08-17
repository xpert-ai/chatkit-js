import { describe, expect, it } from 'vitest';
import type { Run } from '@xpert-ai/xpert-sdk';
import {
  resolveActiveThreadRunId,
  waitForActiveThreadRunId,
} from './thread-runs';

function createRun(
  runId: string,
  status: Run['status'],
  updatedAt: string,
): Run {
  return {
    run_id: runId,
    thread_id: 'thread-1',
    assistant_id: 'assistant-1',
    created_at: updatedAt,
    updated_at: updatedAt,
    status,
    metadata: {},
    multitask_strategy: null,
  };
}

describe('resolveActiveThreadRunId', () => {
  it('resolves a running execution before an assistant message exists', () => {
    expect(
      resolveActiveThreadRunId([
        createRun('run-finished', 'success', '2026-08-13T10:00:00Z'),
        createRun('run-active', 'running', '2026-08-13T10:01:00Z'),
      ]),
    ).toBe('run-active');
  });

  it('chooses the newest pending or running execution', () => {
    expect(
      resolveActiveThreadRunId([
        createRun('run-older', 'running', '2026-08-13T10:00:00Z'),
        createRun('run-newer', 'pending', '2026-08-13T10:02:00Z'),
      ]),
    ).toBe('run-newer');
  });

  it('ignores terminal executions', () => {
    expect(
      resolveActiveThreadRunId([
        createRun('run-success', 'success', '2026-08-13T10:00:00Z'),
        createRun('run-error', 'error', '2026-08-13T10:01:00Z'),
      ]),
    ).toBeNull();
  });

  it('retries while a newly-created execution is not visible yet', async () => {
    let attempt = 0;

    const runId = await waitForActiveThreadRunId(
      async () => {
        attempt += 1;
        return attempt < 3
          ? []
          : [createRun('run-late', 'running', '2026-08-13T10:02:00Z')];
      },
      { attempts: 3, intervalMs: 0 },
    );

    expect(runId).toBe('run-late');
    expect(attempt).toBe(3);
  });

  it('stops retrying after the user switches to another thread', async () => {
    let active = true;
    let attempt = 0;

    const runId = await waitForActiveThreadRunId(
      async () => {
        attempt += 1;
        active = false;
        return [];
      },
      { attempts: 3, intervalMs: 0, shouldContinue: () => active },
    );

    expect(runId).toBeNull();
    expect(attempt).toBe(1);
  });
});
