import * as React from 'react';
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Client, type Run } from '@xpert-ai/xpert-sdk';
import { useExternalAssistantRunSync } from './useExternalAssistantRunSync';
import type { ExternalAssistantRun } from './external-assistant-runs';

const runs: ExternalAssistantRun[] = [
  { id: 'writer', info: { id: 'writer', status: 'running' }, segments: [] },
];
function response(status: Run['status'], threadId = 'thread'): Run {
  return {
    run_id: 'writer',
    thread_id: threadId,
    assistant_id: 'assistant',
    status,
    created_at: '2026-10-02T08:00:00Z',
    updated_at: '2026-10-02T08:45:00Z',
    metadata: { agentRun: { id: 'writer', status, elapsedTime: 2700000 } },
    multitask_strategy: 'reject',
  };
}

describe('persisted external assistant status reconciliation', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  function fixture(active = true) {
    const client = new Client({ apiUrl: 'https://example.test' });
    const get = vi
      .spyOn(client.runs, 'get')
      .mockResolvedValue(response('running'));
    const onRunUpdate = vi.fn();
    const props = { client, threadId: 'thread', runs, active, onRunUpdate };
    const hook = renderHook((input) => useExternalAssistantRunSync(input), {
      initialProps: props,
      wrapper: React.StrictMode,
    });
    return { ...hook, props, get, onRunUpdate };
  }

  it('repairs a missed end event on the next tick, then stops polling the finished execution', async () => {
    const f = fixture();
    await act(async () => {});
    expect(f.get).toHaveBeenCalledTimes(1);
    f.get.mockResolvedValue(response('interrupted'));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });
    expect(f.result.current.runs[0].info).toMatchObject({
      status: 'interrupted',
      elapsedTime: 2700000,
    });
    expect(f.onRunUpdate).toHaveBeenCalledExactlyOnceWith(
      'thread',
      expect.objectContaining({ id: 'writer', status: 'interrupted' }),
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(15000);
    });
    expect(f.get).toHaveBeenCalledTimes(2);
  });

  it('retains running status on a failed read and recovers without another cancel request', async () => {
    const f = fixture(false);
    expect(f.get).not.toHaveBeenCalled();
    f.get.mockRejectedValueOnce(new Error('offline'));
    f.rerender({ ...f.props, active: true });
    await act(async () => {});
    expect(f.result.current.runs[0].info.status).toBe('running');
    expect(f.onRunUpdate).not.toHaveBeenCalled();
    f.get.mockResolvedValue(response('interrupted'));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });
    expect(f.result.current.runs[0].info.status).toBe('interrupted');
  });

  it('drops a response from a previous thread after navigation', async () => {
    const f = fixture(false);
    let complete!: (run: Run) => void;
    f.get.mockImplementationOnce(
      () =>
        new Promise<Run>((resolve) => {
          complete = resolve;
        }),
    );
    f.rerender({ ...f.props, active: true });
    f.rerender({ ...f.props, active: true, threadId: 'other-thread' });
    await act(async () => {
      complete(response('interrupted'));
    });
    expect(f.result.current.runs[0].info.status).toBe('running');
    expect(f.onRunUpdate).not.toHaveBeenCalled();
  });

  it('does not update shared conversation state after the view unmounts', async () => {
    const f = fixture(false);
    let complete!: (run: Run) => void;
    f.get.mockImplementationOnce(
      () =>
        new Promise<Run>((resolve) => {
          complete = resolve;
        }),
    );
    f.rerender({ ...f.props, active: true });
    f.unmount();
    await act(async () => {
      complete(response('interrupted'));
    });
    expect(f.onRunUpdate).not.toHaveBeenCalled();
  });
});
