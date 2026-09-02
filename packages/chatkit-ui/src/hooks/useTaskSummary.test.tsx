import { act, renderHook, waitFor } from '@testing-library/react';
import type { Client } from '@xpert-ai/xpert-sdk';
import { describe, expect, it, vi } from 'vitest';
import type {
  TaskSummaryLiveData,
  TaskSummarySnapshot,
} from '../lib/task-summary';
import { useTaskSummary } from './useTaskSummary';

describe('useTaskSummary', () => {
  it('clears stale history and ignores the old request when the conversation changes', async () => {
    const first = deferred<TaskSummarySnapshot>();
    const second = deferred<TaskSummarySnapshot>();
    const getTaskSummary = vi
      .fn()
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);
    const client = {
      conversations: {
        getTaskSummary,
        listTaskSummaryItems: vi.fn(),
      },
    } as unknown as Client;
    const live = emptyLive();
    const { result, rerender } = renderHook(
      ({ conversationId }) =>
        useTaskSummary({
          enabled: true,
          conversationId,
          client,
          live,
        }),
      { initialProps: { conversationId: 'conversation-1' } },
    );

    rerender({ conversationId: 'conversation-2' });
    await act(async () => {
      first.resolve(snapshot('conversation-1', 'Old plan'));
      await Promise.resolve();
    });
    expect(result.current.summary.plan).toBeUndefined();

    await act(async () => {
      second.resolve(snapshot('conversation-2', 'Current plan'));
      await Promise.resolve();
    });
    await waitFor(() =>
      expect(result.current.summary.plan?.title).toBe('Current plan'),
    );
  });

  it('keeps live summary data when historical loading fails', async () => {
    const client = {
      conversations: {
        getTaskSummary: vi.fn().mockRejectedValue(new Error('offline')),
        listTaskSummaryItems: vi.fn(),
      },
    } as unknown as Client;
    const live = emptyLive({
      outputs: [
        {
          id: 'live',
          kind: 'document',
          title: 'Live output',
          resource: { type: 'artifact', artifactId: 'artifact-live' },
        },
      ],
    });
    const { result } = renderHook(() =>
      useTaskSummary({
        enabled: true,
        conversationId: 'conversation-1',
        client,
        live,
      }),
    );

    await waitFor(() => expect(result.current.historyError).toBeTruthy());
    expect(result.current.summary.outputs[0]?.title).toBe('Live output');
  });

  it('refreshes transient pending state when persisted messages are reconciled', async () => {
    const stale = snapshot('conversation-1', 'Plan');
    stale.pending = {
      items: [
        {
          id: 'operation:request_user_input:0',
          kind: 'user_input',
          title: 'request_user_input',
        },
      ],
      total: 1,
    };
    const current = snapshot('conversation-1', 'Plan');
    const getTaskSummary = vi
      .fn()
      .mockResolvedValueOnce(stale)
      .mockResolvedValueOnce(current);
    const client = {
      conversations: {
        getTaskSummary,
        listTaskSummaryItems: vi.fn(),
      },
    } as unknown as Client;
    const { result, rerender } = renderHook(
      ({ refreshVersion }) =>
        useTaskSummary({
          enabled: true,
          conversationId: 'conversation-1',
          client,
          live: emptyLive(),
          refreshVersion,
        }),
      { initialProps: { refreshVersion: 0 } },
    );

    await waitFor(() => expect(result.current.summary.pending).toHaveLength(1));
    rerender({ refreshVersion: 1 });

    await waitFor(() => expect(result.current.summary.pending).toEqual([]));
    expect(getTaskSummary).toHaveBeenCalledTimes(2);
  });

  it('aborts an in-flight section page when the conversation changes', async () => {
    const page = deferred<never>();
    let pageSignal: AbortSignal | undefined;
    const client = {
      conversations: {
        getTaskSummary: vi.fn((conversationId: string) =>
          Promise.resolve(snapshot(conversationId, 'Plan')),
        ),
        listTaskSummaryItems: vi.fn(
          (
            _conversationId: string,
            _section: string,
            query?: { signal?: AbortSignal },
          ) => {
            pageSignal = query?.signal;
            return page.promise;
          },
        ),
      },
    } as unknown as Client;
    const { result, rerender } = renderHook(
      ({ conversationId }) =>
        useTaskSummary({
          enabled: true,
          conversationId,
          client,
          live: emptyLive(),
        }),
      { initialProps: { conversationId: 'conversation-1' } },
    );
    await waitFor(() =>
      expect(result.current.summary.plan?.title).toBe('Plan'),
    );

    act(() => {
      void result.current.loadSection('outputs');
    });
    expect(pageSignal?.aborted).toBe(false);
    rerender({ conversationId: 'conversation-2' });
    await waitFor(() => expect(pageSignal?.aborted).toBe(true));
  });
});

function snapshot(conversationId: string, title: string): TaskSummarySnapshot {
  return {
    version: 1,
    conversationId,
    threadId: `thread-${conversationId}`,
    task: {
      plan: { title, excerpt: title, updatedAt: '2026-07-13T00:00:00.000Z' },
    },
    outputs: { items: [], total: 0 },
    sources: { items: [], total: 0 },
    agents: { items: [], total: 0 },
    pending: { items: [], total: 0 },
    updatedAt: '2026-07-13T00:00:00.000Z',
  };
}

function emptyLive(
  partial: Partial<TaskSummaryLiveData> = {},
): TaskSummaryLiveData {
  return {
    outputs: [],
    sources: [],
    agents: [],
    pending: [],
    running: [],
    ...partial,
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}
