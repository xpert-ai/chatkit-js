import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ThreadCapabilities } from '@xpert-ai/xpert-sdk';
import { useThreadCapabilities } from './useThreadCapabilities';

function deferred() {
  let resolve!: (value: ThreadCapabilities) => void;
  const promise = new Promise<ThreadCapabilities>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function fixture() {
  const getCapabilities = vi
    .fn<() => Promise<ThreadCapabilities>>()
    .mockResolvedValue({ canRetry: true });
  return {
    client: { threads: { getCapabilities } },
    threadId: 'thread-1',
    enabled: true,
    isLoading: false,
  };
}

describe('thread action availability', () => {
  it.each([true, false])(
    'uses only the server canRetry flag (%s)',
    async (canRetry) => {
      const options = fixture();
      options.client.threads.getCapabilities.mockResolvedValue({ canRetry });
      const { result } = renderHook(() => useThreadCapabilities(options));
      expect(result.current).toBe(false);
      await act(async () => {});
      expect(result.current).toBe(canRetry);
      expect(
        options.client.threads.getCapabilities,
      ).toHaveBeenCalledExactlyOnceWith('thread-1');
    },
  );

  it('keeps retry disabled while loading availability and after a failed read', async () => {
    const options = fixture();
    const pending = deferred();
    options.client.threads.getCapabilities
      .mockReturnValueOnce(pending.promise)
      .mockRejectedValue(new Error('offline'));
    const { result, rerender } = renderHook(useThreadCapabilities, {
      initialProps: options,
    });
    expect(result.current).toBe(false);
    await act(async () => pending.resolve({ canRetry: true }));
    expect(result.current).toBe(true);
    rerender({ ...options, threadId: 'thread-2' });
    await act(async () => {});
    expect(result.current).toBe(false);
  });

  it('ignores responses for a previous branch, including switching away and back', async () => {
    const options = fixture();
    const stale = deferred();
    const current = deferred();
    options.client.threads.getCapabilities
      .mockReturnValueOnce(stale.promise)
      .mockResolvedValueOnce({ canRetry: false })
      .mockReturnValueOnce(current.promise);
    const { result, rerender } = renderHook(useThreadCapabilities, {
      initialProps: options,
    });
    rerender({ ...options, threadId: 'thread-2' });
    rerender(options);
    await act(async () => stale.resolve({ canRetry: true }));
    expect(result.current).toBe(false);
    await act(async () => current.resolve({ canRetry: true }));
    expect(result.current).toBe(true);
  });

  it('invalidates availability during a run and refreshes when it finishes', async () => {
    const options = fixture();
    const { result, rerender } = renderHook(useThreadCapabilities, {
      initialProps: options,
    });
    await waitFor(() => expect(result.current).toBe(true));
    rerender({ ...options, isLoading: true });
    expect(result.current).toBe(false);
    expect(options.client.threads.getCapabilities).toHaveBeenCalledTimes(1);
    options.client.threads.getCapabilities.mockResolvedValue({
      canRetry: false,
    });
    rerender(options);
    await act(async () => {});
    expect(result.current).toBe(false);
    expect(options.client.threads.getCapabilities).toHaveBeenCalledTimes(2);
  });

  it('refreshes after status or stream errors change without interpreting diagnostics', async () => {
    const options = fixture();
    const { result, rerender } = renderHook(
      ({ status, error }: { status: string; error: unknown }) =>
        useThreadCapabilities({ ...options, status, error }),
      { initialProps: { status: 'idle', error: null as unknown } },
    );
    await waitFor(() => expect(result.current).toBe(true));
    options.client.threads.getCapabilities.mockResolvedValue({
      canRetry: false,
    });
    rerender({ status: 'error', error: new Error('failure') });
    expect(result.current).toBe(false);
    await act(async () => {});
    expect(options.client.threads.getCapabilities).toHaveBeenCalledTimes(2);
  });

  it.each([{ enabled: false }, { threadId: null }, { isLoading: true }])(
    'does not query an inactive session: %j',
    async (overrides) => {
      const options = fixture();
      const { result } = renderHook(() =>
        useThreadCapabilities({ ...options, ...overrides }),
      );
      await act(async () => {});
      expect(result.current).toBe(false);
      expect(options.client.threads.getCapabilities).not.toHaveBeenCalled();
    },
  );
});
