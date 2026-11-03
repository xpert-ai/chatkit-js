import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Client } from '@xpert-ai/xpert-sdk';
import { ReadRecovery } from '../connection/read-recovery';
import { useThreadActivitySubscription } from './useThreadActivitySubscription';
import type { StateType } from '../types';

const snapshot = { version: 1, threadId: 'branch', runs: [], cards: [] };
const event = (type: string, data: unknown) =>
  `event: ${type}\ndata: ${JSON.stringify(data)}\n\n`;
const headers = { 'content-type': 'text/event-stream' };

function mount(fetch: typeof globalThis.fetch) {
  const recovery = new ReadRecovery();
  const runStream = vi.fn();
  const valuesRef = {
    current: {
      messages: [{ id: 'saved', type: 'ai', content: 'saved answer' }],
    } as StateType,
  };
  const view = renderHook(() =>
    useThreadActivitySubscription({
      recovery,
      client: new Client<StateType>({
        apiUrl: 'https://activity.test/api/ai',
        callerOptions: { fetch, maxRetries: 0 },
      }),
      threadId: 'branch',
      conversationId: 'conversation',
      scopeKey: 'organization',
      enabled: true,
      valuesRef,
      setValues: vi.fn(),
      isLoadingRef: { current: false },
      pauseRequestedRef: { current: false },
      runStream,
    }),
  );
  return { recovery, runStream, valuesRef, view };
}

describe('real SDK activity errors reach the shared recovery policy', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
    vi.spyOn(Math, 'random').mockReturnValue(0);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it.each([401, 403, 404])(
    'stops after SSE %i, preserves history and never dispatches a run',
    async (status) => {
      const fetch = vi.fn<typeof globalThis.fetch>(
        async () =>
          new Response(
            event('thread.snapshot', snapshot) +
              event('error', { version: 1, status, message: 'denied' }),
            { headers },
          ),
      );
      const f = mount(fetch);
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });
      expect(f.recovery.getSnapshot()).toBe('unavailable');
      expect(f.recovery.stopped).toBe(true);
      await act(async () => {
        await vi.advanceTimersByTimeAsync(60_000);
      });
      expect(fetch).toHaveBeenCalledTimes(1);
      expect(f.valuesRef.current.messages[0].content).toBe('saved answer');
      expect(f.runStream).not.toHaveBeenCalled();
      f.view.unmount();
    },
  );

  it('backs off an SSE 503 and recovers with a new snapshot without resubmitting', async () => {
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockResolvedValueOnce(
        new Response(
          event('error', {
            version: 1,
            status: 503,
            message: 'temporary outage',
          }),
          { headers },
        ),
      )
      .mockImplementation(
        async (_url, init) =>
          new Response(
            new ReadableStream({
              start(controller) {
                controller.enqueue(
                  new TextEncoder().encode(event('thread.snapshot', snapshot)),
                );
                init?.signal?.addEventListener(
                  'abort',
                  () => controller.close(),
                  { once: true },
                );
              },
            }),
            { headers },
          ),
      );
    const f = mount(fetch);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(f.recovery.getSnapshot()).toBe('reconnecting');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(999);
    });
    expect(fetch).toHaveBeenCalledTimes(1);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(f.recovery.getSnapshot()).toBe('connected');
    expect(fetch.mock.calls.every(([, init]) => init?.method === 'GET')).toBe(
      true,
    );
    expect(f.runStream).not.toHaveBeenCalled();
    f.view.unmount();
  });
});
