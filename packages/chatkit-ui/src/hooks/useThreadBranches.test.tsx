import { act, renderHook, waitFor } from '@testing-library/react';
import type { Client, Thread } from '@xpert-ai/xpert-sdk';
import { expect, it, vi } from 'vitest';
import { useThreadBranches } from './useThreadBranches';

it('uses conversation branches and ignores a late response after selecting another branch', async () => {
  let resolveOld!: (threads: Thread[]) => void;
  const oldResponse = new Promise<Thread[]>((resolve) => {
    resolveOld = resolve;
  });
  const listThreads = vi
    .fn()
    .mockReturnValueOnce(oldResponse)
    .mockResolvedValueOnce([{ thread_id: 'new', status: 'idle' }]);
  const client = { conversations: { listThreads } } as unknown as Client;
  const { result, rerender } = renderHook(
    ({ threadId }) =>
      useThreadBranches(client, 'conversation', threadId, true, false),
    { initialProps: { threadId: 'old' } },
  );
  rerender({ threadId: 'new' });
  await waitFor(() => expect(result.current.current?.thread_id).toBe('new'));
  await act(async () => {
    resolveOld([]);
  });
  expect(result.current.current?.thread_id).toBe('new');
  expect(listThreads).toHaveBeenCalledWith('conversation');
});

it('hides unavailable branch controls on older platforms while surfacing real errors', async () => {
  const listThreads = vi
    .fn()
    .mockRejectedValueOnce({ status: 404 })
    .mockRejectedValueOnce(new Error('Access denied'));
  const client = { conversations: { listThreads } } as unknown as Client;
  const { result } = renderHook(() =>
    useThreadBranches(client, 'conversation', 'thread', true, false),
  );
  await waitFor(() => expect(listThreads).toHaveBeenCalledTimes(1));
  expect(result.current.branches).toEqual([]);
  expect(result.current.error).toBeNull();
  await act(async () => {
    await result.current.refresh();
  });
  expect(result.current.error).toBe('Access denied');
});

it('refreshes when loading changes and does not poll on an interval', async () => {
  const setIntervalSpy = vi.spyOn(globalThis, 'setInterval');
  const listThreads = vi.fn().mockResolvedValue([{ thread_id: 'thread', status: 'busy' }]);
  const client = { conversations: { listThreads } } as unknown as Client;
  try {
    const { rerender } = renderHook(
      ({ isLoading }) => useThreadBranches(client, 'conversation', 'thread', true, isLoading),
      { initialProps: { isLoading: true } },
    );
    await waitFor(() => expect(listThreads).toHaveBeenCalledTimes(1));
    expect(setIntervalSpy.mock.calls.some((call) => call[1] === 2000)).toBe(false);
    rerender({ isLoading: false });
    await waitFor(() => expect(listThreads).toHaveBeenCalledTimes(2));
  } finally {
    setIntervalSpy.mockRestore();
  }
});
