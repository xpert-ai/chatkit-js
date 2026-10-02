import { act, render, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  deferred,
  history,
  mocks,
  provider,
  setupHistoryTests,
  stream,
} from '../testing/history-fixture';

function reads() {
  return (
    mocks.getThread.mock.calls.length +
    mocks.getConversation.mock.calls.length +
    mocks.searchMessages.mock.calls.length
  );
}

const approval = {
  tasks: [
    {
      interrupts: [
        {
          value: {
            actionRequests: [{ name: 'delete_file', args: {} }],
            reviewConfigs: [
              {
                actionName: 'delete_file',
                allowedDecisions: ['approve', 'reject'],
              },
            ],
          },
        },
      ],
    },
  ],
};

describe('task lifecycle and transport recovery', () => {
  setupHistoryTests();
  afterEach(() => vi.useRealTimers());

  it('does not revive a cancelled conversation as an unfinished task', async () => {
    mocks.getThread.mockResolvedValue({
      status: 'interrupted',
      operation: null,
      metadata: { id: 'conversation-thread-1' },
    });
    mocks.getConversation.mockResolvedValue({
      id: 'conversation-thread-1',
      threadId: 'thread-1',
      status: 'interrupted',
      error: 'Canceled by user',
      operation: null,
    });
    mocks.searchMessages.mockResolvedValue({
      items: history('thread-1').items.map((message) =>
        message.role === 'ai'
          ? { ...message, status: 'aborted', error: 'Canceled by user' }
          : message,
      ),
      total: 2,
    });
    vi.useFakeTimers();
    await act(async () => {
      render(provider('thread-1'));
    });
    const before = reads();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });
    expect(stream.isLoading).toBe(false);
    expect(reads()).toBe(before);
    expect(stream.pendingHITLRequest).toBeNull();
    expect(mocks.runStream).not.toHaveBeenCalled();
    expect(mocks.resumeRun).not.toHaveBeenCalled();
  });

  it('keeps a normal long task streaming without frontend status polling', async () => {
    render(provider('thread-1'));
    await waitFor(() => expect(stream.historyLoad.status).toBe('loaded'));
    const finished = deferred<void>();
    mocks.runStream.mockImplementation(async function* () {
      await finished.promise;
    });
    vi.useFakeTimers();
    let run!: Promise<void>;
    await act(async () => {
      run = stream.submit({ input: { input: 'Run a long task' } });
    });
    const before = reads();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });
    expect(stream.isLoading).toBe(true);
    expect(stream.isThreadInterrupted).toBe(false);
    expect(reads()).toBe(before);
    await act(async () => {
      finished.resolve();
      await run;
    });
    expect(stream.isLoading).toBe(false);
  });

  it.each([
    { status: 'idle', operation: null, runCount: 2 },
    { status: 'interrupted', operation: null, runCount: 1 },
    { status: 'interrupted', operation: approval, runCount: 1 },
  ])(
    'drains follow-ups only after completion: $status / $operation',
    async ({ status, operation, runCount }) => {
      render(provider('thread-1'));
      await waitFor(() => expect(stream.historyLoad.status).toBe('loaded'));
      const finished = deferred<void>();
      mocks.runStream.mockImplementationOnce(async function* () {
        await finished.promise;
      });
      let run!: Promise<void>;
      await act(async () => {
        run = stream.submit({ input: { input: 'Run task' } });
      });
      await act(async () => {
        await stream.submit(
          { input: { input: 'Do this next' } },
          { followUpMode: 'queue' },
        );
      });
      expect(stream.pendingFollowUps).toHaveLength(1);
      mocks.getThread.mockResolvedValue({ status, operation });
      await act(async () => {
        finished.resolve();
        await run;
      });
      expect(stream.isLoading).toBe(false);
      expect(mocks.runStream).toHaveBeenCalledTimes(runCount);
      expect(stream.pendingFollowUps).toHaveLength(2 - runCount);
      if (stream.pendingFollowUps.length) {
        expect(
          stream.canSendPendingFollowUpNow(stream.pendingFollowUps[0].id),
        ).toBe(false);
      }
      if (operation) expect(stream.pendingHITLRequest).not.toBeNull();
    },
  );

  it('keeps a live approval idle until the user answers', async () => {
    render(provider('thread-1'));
    await waitFor(() => expect(stream.historyLoad.status).toBe('loaded'));
    mocks.runStream.mockImplementationOnce(async function* () {
      yield {
        event: 'message',
        data: {
          type: 'event',
          event: 'on_interrupt',
          data: {
            tasks: [
              {
                interrupts: [
                  {
                    value: {
                      actionRequests: [{ name: 'delete_file', args: {} }],
                      reviewConfigs: [
                        {
                          actionName: 'delete_file',
                          allowedDecisions: ['approve', 'reject'],
                        },
                      ],
                    },
                  },
                ],
              },
            ],
          },
        },
      };
    });
    let run!: Promise<void>;
    await act(async () => {
      run = stream.submit({ input: { input: 'Run task' } });
    });
    expect(stream.pendingHITLRequest?.request.actionRequests[0]?.name).toBe(
      'delete_file',
    );
    expect(stream.isLoading).toBe(false);
    expect(mocks.runStream).toHaveBeenCalledOnce();
    await act(async () => {
      stream.submitHITLDecision([{ type: 'approve' }]);
      await run;
    });
    expect(mocks.runStream).toHaveBeenCalledTimes(2);
    expect(stream.pendingHITLRequest).toBeNull();
  });

  it('does not clear a transport error using another thread’s execution error', async () => {
    render(provider('thread-1'));
    await waitFor(() => expect(stream.historyLoad.status).toBe('loaded'));
    mocks.runStream.mockImplementation(async function* () {
      throw new Error('Stream closed');
    });
    mocks.getThread.mockResolvedValue({ status: 'error' });
    mocks.getConversation.mockResolvedValue({
      threadId: 'thread-2',
      status: 'error',
      error: 'Unrelated error',
    });
    await act(async () => {
      await stream.submit({ input: { input: 'Run task' } });
    });
    expect(stream.error).toEqual(new Error('Stream closed'));
  });

  it('keeps fallback reconciliation bounded when the server stays busy', async () => {
    render(provider('thread-1'));
    await waitFor(() => expect(stream.historyLoad.status).toBe('loaded'));
    mocks.getThread.mockResolvedValue({ status: 'busy' });
    vi.useFakeTimers();
    let run!: Promise<void>;
    await act(async () => {
      run = stream.submit({ input: { input: 'Run task' } });
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(602_000);
      await run;
    });
    expect(stream.isLoading).toBe(false);
    expect(stream.isThreadInterrupted).toBe(false);
    const before = reads();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });
    expect(reads()).toBe(before);
    expect(mocks.cancelRun).not.toHaveBeenCalled();
  });

  it('does not let an old stream failure clear or overwrite the new thread', async () => {
    render(provider('thread-1'));
    await waitFor(() => expect(stream.historyLoad.status).toBe('loaded'));
    const finished = deferred<void>();
    mocks.runStream.mockImplementation(async function* () {
      await finished.promise;
      throw new Error('Old stream failed');
    });
    let run!: Promise<void>;
    await act(async () => {
      run = stream.submit({ input: { input: 'Run task' } });
    });
    await act(async () => {
      await stream.loadThread('thread-2');
    });
    const before = reads();
    await act(async () => {
      finished.resolve();
      await run;
    });
    expect(reads()).toBe(before);
    expect(stream.error).toBeNull();
    expect(
      stream.messages.every((message) => message.id?.startsWith('thread-2')),
    ).toBe(true);
  });
});
