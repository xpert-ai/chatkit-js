import { act, renderHook } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { Client, type ThreadControlView } from '@xpert-ai/xpert-sdk';
import { useThreadBranches } from './useThreadBranches';
import { ReadRecovery } from '../providers/stream/connection/read-recovery';
const view: ThreadControlView = {
  version: 1,
  threadId: 'thread',
  runId: 'run',
  revision: '5',
  state: 'stopping',
  actions: {
    canPause: false,
    canResume: false,
    canTerminate: false,
    canSend: false,
    canQueue: false,
    canRetry: false,
    canRespond: false,
  },
};
afterEach(() => vi.useRealTimers());
it('retains public state through consecutive 503s on one recovery chain and discards old revisions', async () => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
  let failures = 0,
    active = 0,
    peak = 0;
  const getView = vi.fn(async () => {
    active++;
    peak = Math.max(peak, active);
    try {
      if (failures-- > 0)
        throw Object.assign(new Error('Unavailable'), {
          status: 503,
          retryAfterMs: 10_000,
        });
      return view;
    } finally {
      active--;
    }
  });
  const recovery = new ReadRecovery();
  const client = new Client({ apiUrl: 'https://xpert.example/api/ai' });
  const readControl = () => recovery.read('control:thread', getView);
  const readBranches = async () => [
    {
      thread_id: 'thread',
      status: 'busy' as const,
      created_at: '',
      updated_at: '',
      metadata: {},
      values: {},
      interrupts: {},
    },
  ];
  const { result, unmount } = renderHook(() =>
    useThreadBranches(
      client,
      'conversation',
      'thread',
      true,
      false,
      readBranches,
      readControl,
    ),
  );
  try {
    await act(async () => {});
    expect(result.current.current?.controlView?.state).toBe('stopping');
    failures = 3;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    expect(recovery.getSnapshot()).toBe('reconnecting');
    expect(result.current.current?.controlView?.state).toBe('stopping');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(29_999);
    });
    expect(getView).toHaveBeenCalledTimes(4);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(recovery.getSnapshot()).toBe('connected');
    expect(peak).toBe(1);
    getView.mockResolvedValueOnce({
      ...view,
      revision: '4',
      state: 'running',
      actions: { ...view.actions, canPause: true },
    });
    await act(async () => {
      await result.current.refresh();
    });
    expect(result.current.current?.controlView?.state).toBe('stopping');
    expect(result.current.current?.controlView?.actions.canPause).toBe(false);
  } finally {
    unmount();
    recovery.dispose();
  }
});

it('keeps controls unavailable until the requested branch metadata accompanies its public view', async () => {
  const client = new Client({ apiUrl: 'https://xpert.example/api/ai' });
  const branches = vi.fn().mockResolvedValue([]);
  const read = async () => view;
  const { result, unmount } = renderHook(() =>
    useThreadBranches(
      client,
      'conversation',
      'thread',
      true,
      false,
      branches,
      read,
    ),
  );
  try {
    await act(async () => {});
    expect(result.current.controlUnavailable).toBe(true);
    expect(result.current.current).toBeUndefined();
  } finally {
    unmount();
  }
});

it('disables controls on the first render and on credential-client replacement before effects run', async () => {
  const first = new Client({ apiUrl: 'https://xpert.example/api/ai' });
  const second = new Client({ apiUrl: 'https://xpert.example/api/ai' });
  const branches = async () => [
    {
      thread_id: 'thread',
      status: 'idle' as const,
      values: {},
      interrupts: {},
      metadata: {},
      created_at: '',
      updated_at: '',
    },
  ];
  const read = async () => view;
  const seen: { client: Client; unavailable: boolean }[] = [];
  const { unmount, rerender } = renderHook(
    ({ client }) => {
      const result = useThreadBranches(
        client,
        'conversation',
        'thread',
        true,
        false,
        branches,
        read,
      );
      seen.push({ client, unavailable: result.controlUnavailable });
      return result;
    },
    { initialProps: { client: first } },
  );
  try {
    await act(async () => {});
    expect(seen[0].unavailable).toBe(true);
    rerender({ client: second });
    expect(seen.find((entry) => entry.client === second)?.unavailable).toBe(
      true,
    );
    await act(async () => {});
  } finally {
    unmount();
  }
});

it('keeps controls closed across an old API 404, a compatible response and a rollback to old API', async () => {
  const client = new Client({ apiUrl: 'https://xpert.example/api/ai' });
  const read = vi.spyOn(client.threads, 'getControlView');
  const oldApi = () => Object.assign(new Error('Not found'), { status: 404 });
  read.mockRejectedValue(oldApi());
  const branches = async () => [
    {
      thread_id: 'thread',
      status: 'idle' as const,
      values: {},
      interrupts: {},
      metadata: {},
      created_at: '',
      updated_at: '',
    },
  ];
  const { result, unmount } = renderHook(() =>
    useThreadBranches(client, 'conversation', 'thread', true, false, branches),
  );
  try {
    await act(async () => {});
    expect(result.current.controlUnavailable).toBe(true);
    expect(result.current.current).toBeUndefined();
    read.mockResolvedValue(view);
    await act(() => result.current.refresh());
    expect(result.current.current?.controlView?.state).toBe('stopping');
    read.mockRejectedValue(oldApi());
    await act(() => result.current.refresh());
    expect(result.current.controlUnavailable).toBe(true);
    expect(result.current.current?.controlView?.state).toBe('stopping');
    expect(result.current.current?.controlView?.actions.canSend).toBe(false);
    read.mockResolvedValue({
      ...view,
      revision: '4',
      state: 'completed',
      actions: { ...view.actions, canSend: true },
    });
    await act(() => result.current.refresh());
    expect(result.current.current?.controlView?.state).toBe('stopping');
    expect(result.current.current?.controlView?.actions.canSend).toBe(false);
  } finally {
    unmount();
    read.mockRestore();
  }
});
