import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Client, HTTPError } from '@xpert-ai/xpert-sdk';
import { ReadRecovery } from './read-recovery';

describe('recovery read scheduling', () => {
  beforeEach(() =>
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] }),
  );
  afterEach(() => vi.useRealTimers());
  it('shares each read, honors Retry-After, and recovers the same run without a write request', async () => {
    const backend = { status: 'running', toolCalls: 1 };
    let available = false;
    const attempts: number[] = [];
    const fetch = vi.fn<typeof globalThis.fetch>(async () => {
      attempts.push(Date.now());
      return available
        ? Response.json({
            run_id: 'run',
            thread_id: 'thread',
            status: backend.status,
          })
        : new Response('temporary outage', {
            status: 503,
            headers: { 'Retry-After': '30' },
          });
    });
    const client = new Client({
      apiUrl: 'https://recovery.test',
      callerOptions: { fetch, maxRetries: 0 },
    });
    const recovery = new ReadRecovery();
    const read = () =>
      recovery.read('status:run', (signal) =>
        client.runs.get('thread', 'run', { signal }),
      );
    const first = Promise.allSettled([read(), read()]);
    await vi.advanceTimersByTimeAsync(0);
    expect((await first).every((result) => result.status === 'rejected')).toBe(
      true,
    );
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(recovery.getSnapshot()).toBe('reconnecting');
    for (let i = 0; i < 2; i++) {
      const attempt = Promise.allSettled([read(), read()]);
      await vi.advanceTimersByTimeAsync(29_999);
      expect(fetch).toHaveBeenCalledTimes(i + 1);
      await vi.advanceTimersByTimeAsync(1);
      await attempt;
    }
    expect(recovery.getSnapshot()).toBe('unavailable');
    available = true;
    const final = read();
    await vi.advanceTimersByTimeAsync(30_000);
    expect(await final).toMatchObject({ run_id: 'run', status: 'running' });
    expect(recovery.getSnapshot()).toBe('connected');
    expect(backend.toolCalls).toBe(1);
    expect(attempts.slice(1).map((at, i) => at - attempts[i])).toEqual([
      30_000, 30_000, 30_000,
    ]);
    expect(
      fetch.mock.calls.every(
        ([, options]) => !options?.method || options.method === 'GET',
      ),
    ).toBe(true);
    console.log(
      JSON.stringify({
        backend,
        attempts: attempts.map((at) => at - attempts[0]),
        connectionState: recovery.getSnapshot(),
      }),
    );
  });
  it('does not clear one failed channel when another succeeds or a quiet tool produces no text', async () => {
    const recovery = new ReadRecovery();
    recovery.failed('activity', new Error('Disconnected'));
    recovery.succeeded('run:run');
    expect(recovery.getSnapshot()).toBe('reconnecting');
    recovery.succeeded('activity');
    await vi.advanceTimersByTimeAsync(600_000);
    expect(recovery.getSnapshot()).toBe('connected');
  });
  it.each([401, 403, 404])(
    'stops retries on HTTP %i and resets only for a new scope',
    async (status) => {
      const recovery = new ReadRecovery();
      recovery.failed('activity', new HTTPError(status, 'denied'));
      const operation = vi.fn();
      await expect(recovery.read('run', operation)).rejects.toMatchObject({
        name: 'AbortError',
      });
      expect(operation).not.toHaveBeenCalled();
      expect(recovery.getSnapshot()).toBe('unavailable');
      recovery.reset();
      expect(recovery.getSnapshot()).toBe('connected');
    },
  );
  it('aborts a queued retry on navigation and rejects a late response without changing the new scope', async () => {
    const recovery = new ReadRecovery();
    let finish!: (value: string) => void;
    const pending = recovery
      .read(
        'status',
        () =>
          new Promise<string>((resolve) => {
            finish = resolve;
          }),
      )
      .catch((error) => error);
    await vi.advanceTimersByTimeAsync(0);
    recovery.reset();
    finish('old thread');
    expect(await pending).toMatchObject({ name: 'AbortError' });
    expect(recovery.getSnapshot()).toBe('connected');
    recovery.failed(
      'activity',
      new HTTPError(
        503,
        '',
        new Response('', { headers: { 'Retry-After': '30' } }),
      ),
    );
    const operation = vi.fn();
    const queued = recovery.read('queued', operation).catch((error) => error);
    recovery.dispose();
    expect(await queued).toMatchObject({ name: 'AbortError' });
    expect(operation).not.toHaveBeenCalled();
  });
});
