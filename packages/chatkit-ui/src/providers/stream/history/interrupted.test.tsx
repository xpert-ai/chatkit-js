import { act, render, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  history,
  deferred,
  savedDisplay,
  mocks,
  provider,
  setupHistoryTests,
  stream,
} from '../testing/history-fixture';

// Deliberately opaque to ChatKit: interrupted lifecycle handling must not
// depend on any provider, runtime, tool name or interrupt payload schema.
const operation = { tasks: [{ interrupts: [{ value: { opaque: true } }] }] };
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

function reads() {
  return (
    mocks.getThread.mock.calls.length +
    mocks.getConversation.mock.calls.length +
    mocks.searchMessages.mock.calls.length
  );
}

describe('generic interrupted thread lifecycle', () => {
  setupHistoryTests();
  afterEach(() => vi.useRealTimers());

  it('reconciles a busy task after SSE ends without marking it interrupted', async () => {
    render(provider('thread-1'));
    await waitFor(() => expect(stream.historyLoad.status).toBe('loaded'));
    vi.useFakeTimers();
    mocks.getThread.mockResolvedValue({ status: 'busy', operation: null });
    mocks.getConversation.mockResolvedValue({
      id: 'conversation-thread-1',
      status: 'interrupted',
      operation,
    });
    let run!: Promise<void>;
    await act(async () => {
      run = stream.submit({ input: { input: 'Run a bounded task' } });
    });
    expect(stream.isLoading).toBe(true);
    expect(stream.isThreadInterrupted).toBe(false);
    expect(stream.error).toBeNull();

    mocks.getThread.mockResolvedValue({ status: 'busy', operation: null });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2_000);
    });
    expect(stream.isLoading).toBe(true);
    expect(stream.isThreadInterrupted).toBe(false);

    mocks.getThread.mockResolvedValue({ status: 'idle', operation: null });
    mocks.getConversation.mockResolvedValue({ status: 'idle' });
    mocks.searchMessages.mockResolvedValue({
      items: [
        {
          id: 'thread-1-ai',
          role: 'ai',
          content: 'Completed with artifacts',
          status: 'success',
        },
      ],
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2_000);
      await run;
    });
    expect(stream.isLoading).toBe(false);
    expect(stream.isThreadInterrupted).toBe(false);
    expect(
      stream.messages.find((message) => message.id === 'thread-1-ai')?.content,
    ).toBe('Completed with artifacts');
    expect(mocks.runStream).toHaveBeenCalledOnce();
    expect(mocks.resumeRun).not.toHaveBeenCalled();
  });

  it.each([operation, null, undefined])(
    'restores interrupted history without restarting or polling: %j',
    async (operation) => {
      mocks.getThread.mockResolvedValue({
        status: 'interrupted',
        operation,
        metadata: { id: 'conversation-thread-1' },
      });
      mocks.getConversation.mockResolvedValue({
        id: 'conversation-thread-1',
        threadId: 'thread-1',
        status: 'interrupted',
        operation,
      });
      mocks.joinStream.mockClear();
      vi.useFakeTimers();
      await act(async () => {
        render(provider('thread-1'));
      });
      expect(stream.historyLoad.status).toBe('loaded');
      expect(stream.isThreadInterrupted).toBe(true);
      expect(stream.isLoading).toBe(false);
      const before = reads();
      await act(async () => {
        await vi.advanceTimersByTimeAsync(602_000);
      });
      expect(reads()).toBe(before);
      expect(mocks.joinStream).not.toHaveBeenCalled();
      expect(mocks.runStream).not.toHaveBeenCalled();
      expect(mocks.resumeRun).not.toHaveBeenCalled();
    },
  );

  it('shows a real parent continuation error after waiting instead of silently ending', async () => {
    render(provider('thread-1'));
    await waitFor(() => expect(stream.historyLoad.status).toBe('loaded'));
    vi.useFakeTimers();
    mocks.getThread.mockResolvedValue({ status: 'busy', operation: null });
    mocks.getConversation.mockResolvedValue({
      status: 'interrupted',
      operation,
    });
    let run!: Promise<void>;
    await act(async () => {
      run = stream.submit({ input: { input: 'Run a bounded task' } });
    });
    mocks.getThread.mockResolvedValue({ status: 'error', operation: null });
    mocks.getConversation.mockResolvedValue({
      threadId: 'thread-1',
      status: 'error',
      error: 'The runtime is unavailable.',
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2_000);
      await run;
    });
    expect(stream.isLoading).toBe(false);
    expect(stream.isThreadInterrupted).toBe(false);
    expect(stream.error).toEqual(new Error('The runtime is unavailable.'));
  });

  it('finishes local reconciliation when SSE ends interrupted', async () => {
    render(provider('thread-1'));
    await waitFor(() => expect(stream.historyLoad.status).toBe('loaded'));
    mocks.getThread.mockResolvedValue({ status: 'interrupted', operation });
    vi.useFakeTimers();
    await act(async () => {
      await stream.submit({ input: { input: 'Run task' } });
    });
    expect(stream.isLoading).toBe(false);
    expect(stream.isThreadInterrupted).toBe(true);
    expect(stream.error).toBeNull();
    const before = reads();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(602_000);
    });
    expect(reads()).toBe(before);
    expect(mocks.runStream).toHaveBeenCalledOnce();
  });

  it('restores approval without polling and resumes only after an explicit decision', async () => {
    mocks.getThread.mockResolvedValue({
      status: 'interrupted',
      operation: approval,
      metadata: { id: 'conversation-thread-1' },
    });
    mocks.getConversation.mockResolvedValue({
      id: 'conversation-thread-1',
      status: 'interrupted',
      operation: approval,
    });
    mocks.joinStream.mockClear();
    render(provider('thread-1'));
    await waitFor(() => expect(stream.historyLoad.status).toBe('loaded'));
    expect(stream.isThreadInterrupted).toBe(true);
    expect(stream.pendingHITLRequest?.request.actionRequests[0]?.name).toBe(
      'delete_file',
    );
    expect(mocks.joinStream).not.toHaveBeenCalled();
    expect(stream.isLoading).toBe(false);
    vi.useFakeTimers();
    const before = reads();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });
    expect(reads()).toBe(before);
    expect(mocks.runStream).not.toHaveBeenCalled();
    expect(mocks.resumeRun).not.toHaveBeenCalled();
    mocks.getThread.mockResolvedValue({ status: 'idle', operation: null });
    mocks.getConversation.mockResolvedValue({ status: 'idle' });
    await act(async () => {
      stream.submitHITLDecision([{ type: 'approve' }]);
    });
    expect(mocks.runStream).toHaveBeenCalledOnce();
    expect(
      mocks.runStream.mock.calls[0]?.[2]?.input?.decision?.payload,
    ).toEqual({
      decisions: [{ type: 'approve' }],
    });
    expect(stream.pendingHITLRequest).toBeNull();
  });

  it('exposes a new approval encountered after a server continuation without submitting it', async () => {
    render(provider('thread-1'));
    await waitFor(() => expect(stream.historyLoad.status).toBe('loaded'));
    vi.useFakeTimers();
    mocks.getThread.mockResolvedValue({ status: 'busy', operation: null });
    await act(async () => {
      void stream.submit({ input: { input: 'Run task' } });
    });
    expect(stream.pendingHITLRequest).toBeNull();
    mocks.getThread.mockResolvedValue({ status: 'busy', operation: null });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2_000);
    });
    mocks.getThread.mockResolvedValue({
      status: 'interrupted',
      operation: approval,
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2_000);
    });
    expect(stream.pendingHITLRequest?.request.actionRequests[0]?.name).toBe(
      'delete_file',
    );
    expect(stream.isLoading).toBe(false);
    const before = reads();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });
    expect(reads()).toBe(before);
    expect(mocks.runStream).toHaveBeenCalledOnce();
    expect(mocks.resumeRun).not.toHaveBeenCalled();
  });

  it('keeps the persisted execution error when reconciling a transport failure', async () => {
    render(provider('thread-1'));
    await waitFor(() => expect(stream.historyLoad.status).toBe('loaded'));
    mocks.runStream.mockImplementation(async function* () {
      throw new Error('Stream closed');
    });
    mocks.getThread.mockResolvedValue({ status: 'error' });
    mocks.getConversation.mockResolvedValue({
      threadId: 'thread-1',
      status: 'error',
      error: 'Execution failed',
    });
    await act(async () => {
      await stream.submit({ input: { input: 'Run task' } });
    });
    expect(stream.error).toEqual(new Error('Execution failed'));
  });

  it('clears interruption when switching threads and leaves the new transcript intact', async () => {
    render(provider('thread-1'));
    await waitFor(() => expect(stream.historyLoad.status).toBe('loaded'));
    vi.useFakeTimers();
    mocks.getThread.mockResolvedValue({ status: 'interrupted', operation });
    mocks.getConversation.mockResolvedValue({
      status: 'interrupted',
      operation,
    });
    let run!: Promise<void>;
    await act(async () => {
      run = stream.submit({ input: { input: 'Run a bounded task' } });
    });
    expect(stream.isThreadInterrupted).toBe(true);
    mocks.getThread.mockImplementation(async (id: string) => ({
      status: 'idle',
      metadata: { id: `conversation-${id}` },
    }));
    mocks.getConversation.mockImplementation(async (id: string) => ({
      id,
      status: 'idle',
    }));
    mocks.searchMessages.mockImplementation(
      async (_id: string, query: { where: { threadId: string } }) =>
        history(query.where.threadId),
    );
    await act(async () => {
      await stream.loadThread('thread-2');
      await run;
    });
    expect(stream.threadId).toBe('thread-2');
    expect(stream.isThreadInterrupted).toBe(false);
    expect(
      stream.messages.every((message) => message.id?.startsWith('thread-2')),
    ).toBe(true);
    expect(mocks.cancelRun).not.toHaveBeenCalled();
  });

  it('can reveal a frozen display while the workflow remains interrupted', async () => {
    mocks.getThread.mockResolvedValue({
      metadata: { id: 'conversation-thread-1' },
      status: 'interrupted',
      operation,
      displayPause: savedDisplay(),
    });
    render(provider('thread-1'));
    await waitFor(() => expect(stream.historyLoad.status).toBe('loaded'));
    expect(stream.isDisplayPaused).toBe(true);
    await act(async () => {
      await stream.resumeDisplay();
    });
    expect(mocks.releaseDisplayPause).toHaveBeenCalledOnce();
    expect(stream.isDisplayPaused).toBe(false);
    expect(stream.isThreadInterrupted).toBe(true);
    expect(mocks.resumeRun).not.toHaveBeenCalled();
  });

  it('reports failed reconciliation after bounded retries', async () => {
    render(provider('thread-1'));
    await waitFor(() => expect(stream.historyLoad.status).toBe('loaded'));
    vi.useFakeTimers();
    mocks.getThread.mockResolvedValue({ status: 'busy', operation: null });
    let run!: Promise<void>;
    await act(async () => {
      run = stream.submit({ input: { input: 'Wait' } });
    });
    mocks.getThread.mockRejectedValue(
      new Error('Status temporarily unavailable'),
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(6_000);
      await run;
    });
    expect(stream.isLoading).toBe(false);
    expect(stream.isThreadInterrupted).toBe(false);
    expect(stream.error).toEqual(new Error('Status temporarily unavailable'));
  });

  it('ignores a reconciliation response arriving after a thread switch', async () => {
    render(provider('thread-1'));
    await waitFor(() => expect(stream.historyLoad.status).toBe('loaded'));
    const pending = deferred<{ status: string }>();
    mocks.getThread.mockImplementation((id: string) =>
      id === 'thread-1'
        ? pending.promise
        : Promise.resolve({
            metadata: { id: `conversation-${id}` },
            status: 'idle',
          }),
    );
    let run!: Promise<void>;
    await act(async () => {
      run = stream.submit({ input: { input: 'Run task' } });
    });
    await act(async () => {
      await stream.loadThread('thread-2');
    });
    await act(async () => {
      pending.resolve({ status: 'interrupted' });
      await run;
    });
    expect(stream.threadId).toBe('thread-2');
    expect(stream.isThreadInterrupted).toBe(false);
    expect(stream.error).toBeNull();
    expect(
      stream.messages.every((message) => message.id?.startsWith('thread-2')),
    ).toBe(true);
    expect(mocks.cancelRun).not.toHaveBeenCalled();
  });

  it('does not start observation on unmount or cancel the backend task', async () => {
    mocks.getThread.mockResolvedValue({
      metadata: { id: 'conversation-thread-1' },
      status: 'interrupted',
      operation,
    });
    const view = render(provider('thread-1'));
    await waitFor(() => expect(stream.isThreadInterrupted).toBe(true));
    vi.useFakeTimers();
    view.unmount();
    const reads = mocks.getThread.mock.calls.length;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });
    expect(mocks.getThread).toHaveBeenCalledTimes(reads);
    expect(mocks.cancelRun).not.toHaveBeenCalled();
  });
});
