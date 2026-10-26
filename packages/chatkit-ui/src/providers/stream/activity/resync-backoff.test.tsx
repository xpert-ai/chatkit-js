import { act, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  mocks,
  provider,
  setupHistoryTests,
  stream,
} from '../testing/history-fixture';

describe('an unavailable replay does not become a successful reconnect', () => {
  setupHistoryTests();
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it.each([false, true])(
    'backs off repeated resyncs (stream_start: %s) without dispatching another run',
    async (start) => {
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
      vi.spyOn(Math, 'random').mockReturnValue(0);
      const attempts: number[] = [];
      mocks.watchActivity.mockImplementation(async function* (_id, options) {
        yield {
          version: 1,
          threadId: 'thread-1',
          cards: [],
          runs: [
            {
              id: 'run',
              status: 'running',
              createdAt: '1',
              updatedAt: '2',
              messageRevision: '',
            },
          ],
        };
        await new Promise<void>((resolve) =>
          options.signal.addEventListener('abort', () => resolve(), {
            once: true,
          }),
        );
      });
      mocks.joinStream.mockImplementation(async function* () {
        attempts.push(Date.now());
        if (start) yield { event: 'message', data: { type: 'stream_start' } };
        yield {
          event: 'message',
          data: { type: 'stream_resync', retryable: true },
        };
        yield { event: 'complete', data: { type: 'complete' } };
      });
      const view = render(provider('thread-1'));
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(30_000);
      });
      expect(attempts.length).toBeGreaterThanOrEqual(4);
      expect(attempts.length).toBeLessThanOrEqual(6);
      const gaps = attempts.slice(1).map((at, i) => at - attempts[i]);
      expect(gaps.at(-1)).toBeGreaterThanOrEqual(8_000);
      expect(stream.connectionState).toBe('unavailable');
      expect(mocks.runStream).not.toHaveBeenCalled();
      expect(mocks.resumeRun).not.toHaveBeenCalled();
      expect(mocks.cancelRun).not.toHaveBeenCalled();
      view.unmount();
    },
  );
});
