import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { ReadRecovery } from '../connection/read-recovery';
import { useStreamCredentials } from './useStreamCredentials';

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function setup(getClientSecret: () => Promise<{ secret: string }>) {
  const fetch = vi.fn<typeof globalThis.fetch>(async (_url, init) =>
    new Headers(init?.headers).get('Authorization') === 'Bearer cs-x-expired'
      ? new Response(null, { status: 401 })
      : Response.json({
          run_id: 'run',
          thread_id: 'thread',
          status: 'success',
        }),
  );
  vi.stubGlobal('fetch', fetch);
  const view = renderHook(() =>
    useStreamCredentials({
      apiKey: 'cs-x-expired',
      organizationId: 'org',
      apiUrl: 'https://recovery.test',
      locale: 'zh-CN',
      isParentAvailable: false,
      getClientSecret,
      sendCommand: vi.fn(),
      lastEventIdRef: { current: null },
      clientRef: { current: null },
    }),
  );
  const recovery = new ReadRecovery();
  const read = (key = 'status:run') =>
    recovery.read(key, (signal) =>
      view.result.current.readClient.runs.get('thread', 'run', { signal }),
    );
  return { fetch, view, recovery, read };
}

it.each([0, 408, 429, 503])(
  'recovers an expired credential after refresh HTTP %i without dispatching execution',
  async (status) => {
    const refresh = vi
      .fn<() => Promise<{ secret: string }>>()
      .mockRejectedValueOnce(
        Object.assign(new Error('Temporary refresh failure'), {
          status,
          retryAfterMs: 30_000,
        }),
      )
      .mockResolvedValue({ secret: 'cs-x-new' });
    const { fetch, view, recovery, read } = setup(refresh);
    await act(async () => {
      const first = Promise.allSettled([read(), read()]);
      await vi.advanceTimersByTimeAsync(0);
      expect(
        (await first).every((result) => result.status === 'rejected'),
      ).toBe(true);
    });
    expect(recovery.stopped).toBe(false);
    expect(recovery.getSnapshot()).toBe('reconnecting');
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledTimes(1);
    await act(async () => {
      const resumed = Promise.all([read(), read()]);
      await vi.advanceTimersByTimeAsync(29_999);
      expect(refresh).toHaveBeenCalledTimes(1);
      await vi.advanceTimersByTimeAsync(1);
      expect(await resumed).toEqual([
        expect.objectContaining({ run_id: 'run', status: 'success' }),
        expect.objectContaining({ run_id: 'run', status: 'success' }),
      ]);
    });
    expect(refresh).toHaveBeenCalledTimes(2);
    expect(fetch).toHaveBeenCalledTimes(3);
    expect(
      fetch.mock.calls.every(
        ([, init]) => !init?.method || init.method === 'GET',
      ),
    ).toBe(true);
    expect(recovery.getSnapshot()).toBe('connected');
    recovery.dispose();
    view.unmount();
  },
);

it('shares renewal across different reads and cancels their backoff on navigation', async () => {
  let reject!: (reason: Error) => void;
  const refresh = vi.fn(
    () =>
      new Promise<{ secret: string }>((_resolve, fail) => {
        reject = fail;
      }),
  );
  const { fetch, view, recovery, read } = setup(refresh);
  const first = Promise.allSettled([
    read('activity:thread'),
    read('status:run'),
  ]);
  await vi.advanceTimersByTimeAsync(0);
  expect(refresh).toHaveBeenCalledTimes(1);
  reject(
    Object.assign(new Error('Unavailable'), {
      status: 503,
      retryAfterMs: 30_000,
    }),
  );
  await vi.advanceTimersByTimeAsync(0);
  await first;
  const queued = read().catch((error: unknown) => error);
  recovery.dispose();
  expect(await queued).toMatchObject({ name: 'AbortError' });
  await vi.advanceTimersByTimeAsync(60_000);
  expect(refresh).toHaveBeenCalledTimes(1);
  expect(fetch).toHaveBeenCalledTimes(2);
  view.unmount();
});

it('continues one schedule through consecutive refresh outages and reads the original run after recovery', async () => {
  const refresh = vi
    .fn<() => Promise<{ secret: string }>>()
    .mockRejectedValueOnce(
      Object.assign(new Error('Unavailable'), { status: 503 }),
    )
    .mockRejectedValueOnce(
      Object.assign(new Error('Unavailable'), { status: 503 }),
    )
    .mockRejectedValueOnce(
      Object.assign(new Error('Unavailable'), { status: 503 }),
    )
    .mockResolvedValue({ secret: 'cs-x-new' });
  const { fetch, view, recovery, read } = setup(refresh);
  for (let attempt = 1; attempt <= 3; attempt++) {
    const failure = Promise.allSettled([read(), read()]);
    await vi.advanceTimersByTimeAsync(10_000);
    await failure;
    expect(refresh).toHaveBeenCalledTimes(attempt);
    expect(fetch).toHaveBeenCalledTimes(attempt);
  }
  expect(recovery.stopped).toBe(false);
  expect(recovery.getSnapshot()).toBe('unavailable');
  await act(async () => {
    const resumed = read();
    await vi.advanceTimersByTimeAsync(10_000);
    expect(await resumed).toMatchObject({ run_id: 'run', status: 'success' });
  });
  expect(refresh).toHaveBeenCalledTimes(4);
  expect(fetch).toHaveBeenCalledTimes(5);
  expect(
    fetch.mock.calls.every(
      ([, init]) => !init?.method || init.method === 'GET',
    ),
  ).toBe(true);
  expect(recovery.getSnapshot()).toBe('connected');
  view.unmount();
});

it.each([401, 403])(
  'stops on refresh HTTP %i without retrying the old execution',
  async (status) => {
    const refresh = vi
      .fn()
      .mockRejectedValue(Object.assign(new Error('Denied'), { status }));
    const { fetch, view, recovery, read } = setup(refresh);
    const first = Promise.allSettled([read(), read()]);
    await vi.advanceTimersByTimeAsync(0);
    await first;
    expect(recovery.stopped).toBe(true);
    await expect(read()).rejects.toMatchObject({ name: 'AbortError' });
    await vi.advanceTimersByTimeAsync(60_000);
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledTimes(1);
    view.unmount();
  },
);
