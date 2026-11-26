import { act, render, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  deferred,
  history,
  mocks,
  provider,
  setupHistoryTests,
  stream,
} from '../testing/history-fixture';

describe('accepted follow-up recovery', () => {
  setupHistoryTests();

  it.each([
    { receipt: 'consumed', disconnected: false, remaining: 0 },
    { receipt: 'canceled', disconnected: false, remaining: 0 },
    { receipt: 'pending', disconnected: false, remaining: 1 },
    { receipt: undefined, disconnected: false, remaining: 1 },
    { receipt: 'consumed', disconnected: true, remaining: 0 },
  ])(
    'does not resend an accepted steer after receipt=$receipt, disconnected=$disconnected',
    async ({ receipt, disconnected, remaining }) => {
      render(provider('thread-1'));
      await waitFor(() => expect(stream.historyLoad.status).toBe('loaded'));
      const finished = deferred<void>();
      mocks.runStream.mockImplementationOnce(async function* (_t, _a, options) {
        options.onRunCreated({ run_id: 'run-1', thread_id: 'thread-1' });
        await finished.promise;
        if (disconnected) throw new TypeError('Connection lost');
        yield { event: 'complete', data: { type: 'complete' } };
      });
      let run!: Promise<void>;
      await act(async () => {
        run = stream.submit({ input: { input: 'Original work' } });
      });
      await act(async () => {
        await stream.submit(
          { input: { input: 'Correct the existing work' } },
          { followUpMode: 'steer' },
        );
      });
      expect(mocks.createRun).toHaveBeenCalledOnce();
      expect(stream.pendingFollowUps).toHaveLength(1);
      const clientMessageId = stream.pendingFollowUps[0].clientMessageId;
      mocks.getThread.mockResolvedValue({ status: 'idle', operation: null });
      mocks.getRun.mockResolvedValue({
        run_id: 'run-1',
        thread_id: 'thread-1',
        status: 'success',
      });
      mocks.searchMessages.mockImplementation(async (_id, query) => {
        if (query.where.role === 'human') {
          return {
            items: receipt
              ? [
                  {
                    id: 'persisted-follow-up',
                    role: 'human',
                    content: 'Correct the existing work',
                    followUpMode: 'steer',
                    followUpStatus: receipt,
                    visibleAt:
                      receipt === 'consumed' ? '2026-01-01T00:00:00Z' : null,
                    thirdPartyMessage: {
                      followUpClientMessageId: clientMessageId,
                    },
                  },
                ]
              : [],
            total: receipt ? 1 : 0,
          };
        }
        return history('thread-1');
      });
      await act(async () => {
        finished.resolve();
        await run;
      });
      await waitFor(() => expect(stream.isLoading).toBe(false));
      await waitFor(
        () => expect(stream.pendingFollowUps).toHaveLength(remaining),
        { timeout: 4_000 },
      );
      expect(mocks.runStream).toHaveBeenCalledTimes(1);
      expect(stream.pendingFollowUps).toHaveLength(remaining);
      if (remaining) expect(stream.pendingFollowUps[0].mode).toBe('steer');
    },
  );
});
