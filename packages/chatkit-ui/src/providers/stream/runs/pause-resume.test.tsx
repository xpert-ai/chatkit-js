import { act, render, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  deferred,
  mocks,
  provider,
  readStepStatus,
  savedDisplay,
  setupHistoryTests,
  stream,
} from '../testing/history-fixture';

describe('thread history restoration', () => {
  setupHistoryTests();

  it.each(['paused', 'pausing', 'idle'])(
    'loads persisted messages, ignoring legacy snapshots while status is %s',
    async (status) => {
      mocks.getThread.mockResolvedValue({
        metadata: { id: 'conversation-thread-1' },
        status,
        displayPause: { ...savedDisplay(), snapshot: 'invalid legacy JSON' },
      });
      mocks.listRuns.mockResolvedValue([{ run_id: 'run', status: 'running' }]);
      mocks.joinStream.mockImplementation(async function* () {});
      render(provider('thread-1'));
      await waitFor(() => expect(stream.historyLoad.status).toBe('loaded'));
      expect(stream.isDisplayPaused).toBe(false);
      expect(stream.messages[1].content).toBe('Saved reply');
      expect(stream.displayPause).toBeNull();
      expect(mocks.releaseDisplayPause).not.toHaveBeenCalled();
    },
  );

  it('resumes a reloaded paused thread using its saved token and the new run stream', async () => {
    mocks.getThread.mockResolvedValue({
      metadata: { id: 'conversation-thread-1' },
      status: 'paused',
    });
    mocks.resumeRun.mockResolvedValue({ run_id: 'resumed-run' });
    mocks.joinStream.mockImplementation(async function* () {
      yield { event: 'end', data: {} };
    });
    render(provider('thread-1'));
    await waitFor(() => expect(stream.messages).toHaveLength(2));
    expect(mocks.joinStream).not.toHaveBeenCalled();
    await act(async () => {
      await stream.resumeRun('paused-run', 'saved-token');
    });
    await waitFor(() => expect(mocks.joinStream).toHaveBeenCalled());
    expect(mocks.resumeRun).toHaveBeenCalledWith(
      'thread-1',
      'paused-run',
      'saved-token',
    );
    expect(mocks.joinStream.mock.calls[0].slice(0, 2)).toEqual([
      'thread-1',
      'resumed-run',
    ]);
    expect(mocks.cancelRun).not.toHaveBeenCalled();
  });

  it('keeps output live and sends a small pause command while the current step finishes', async () => {
    const done = deferred<undefined>();
    const emitBackground = deferred<undefined>();
    const pauseAcknowledged = deferred<{
      state: string;
      pauseId: string;
    }>();
    mocks.listRuns.mockResolvedValue([{ run_id: 'run', status: 'running' }]);
    let signal: AbortSignal | undefined;
    mocks.joinStream.mockImplementation(async function* (
      _thread: string,
      _run: string,
      options: { signal: AbortSignal },
    ) {
      signal = options.signal;
      await emitBackground.promise;
      yield {
        event: 'message',
        data: { type: 'message', data: 'Background completion' },
      };
      await done.promise;
    });
    mocks.pauseRun.mockReturnValue(pauseAcknowledged.promise);
    render(provider('thread-1'));
    await waitFor(() => expect(stream.isLoading).toBe(true));
    let pause!: Promise<void>;
    act(() => {
      pause = stream.pauseRun('run');
    });
    expect(stream.isDisplayPaused).toBe(false);
    await act(async () => {
      emitBackground.resolve(undefined);
    });
    expect(JSON.stringify(stream.messages)).toContain('Background completion');
    await act(async () => {
      pauseAcknowledged.resolve({
        state: 'pausing',
        pauseId: 'pause-token',
      });
      await pause;
    });
    expect(mocks.pauseRun).toHaveBeenCalledWith('thread-1', 'run', {
      pollTimeoutMs: 0,
    });
    expect(signal?.aborted).toBe(false);
    expect(mocks.cancelRun).not.toHaveBeenCalled();
    mocks.searchMessages.mockResolvedValue({
      items: [
        { id: 'thread-1-ai', role: 'ai', content: 'Background completion' },
      ],
      total: 1,
    });
    await act(async () => {
      done.resolve(undefined);
    });
    expect(JSON.stringify(stream.messages)).toContain('Background completion');
    expect(stream.isDisplayPaused).toBe(false);
    mocks.listRuns.mockResolvedValue([]);
    await act(async () => {
      await stream.loadThread('thread-2');
    });
    expect(stream.isDisplayPaused).toBe(false);
  });

  it('shows tool completion and text that arrive after the pause click', async () => {
    const runningStep = {
      id: 'shell-1',
      type: 'component',
      data: {
        category: 'Tool',
        type: 'command',
        tool: 'shell',
        status: 'running',
      },
    };
    mocks.searchMessages.mockResolvedValue({
      items: [
        {
          id: 'thread-1-ai',
          role: 'ai',
          executionId: 'run',
          content: [runningStep],
        },
      ],
      total: 1,
    });
    const emitCompletion = deferred<undefined>();
    const done = deferred<undefined>();
    mocks.listRuns.mockResolvedValue([{ run_id: 'run', status: 'running' }]);
    mocks.joinStream.mockImplementation(async function* () {
      await emitCompletion.promise;
      yield {
        event: 'message',
        data: {
          type: 'message',
          data: {
            ...runningStep,
            data: { ...runningStep.data, status: 'success' },
          },
        },
      };
      yield {
        event: 'message',
        data: { type: 'message', data: 'Text after pause' },
      };
      await done.promise;
    });
    render(provider('thread-1'));
    await waitFor(() => expect(stream.isLoading).toBe(true));

    await act(async () => {
      await stream.pauseRun('run');
    });
    expect(stream.isDisplayPaused).toBe(false);
    expect(readStepStatus(stream.messages[0])).toBe('running');

    await act(async () => {
      emitCompletion.resolve(undefined);
    });
    // Pausing is an execution boundary, not a transcript freeze.
    expect(readStepStatus(stream.messages[0])).toBe('success');
    expect(JSON.stringify(stream.messages)).toContain('Text after pause');

    mocks.searchMessages.mockResolvedValue({
      items: [
        {
          id: 'thread-1-ai',
          role: 'ai',
          content: [
            {
              ...runningStep,
              data: { ...runningStep.data, status: 'success' },
            },
            { type: 'text', text: 'Text after pause' },
          ],
        },
      ],
      total: 1,
    });
    await act(async () => {
      done.resolve(undefined);
    });
    expect(readStepStatus(stream.messages[0])).toBe('success');
    expect(JSON.stringify(stream.messages)).toContain('Text after pause');
    expect(stream.isDisplayPaused).toBe(false);
  });

  it('keeps output live when a pause request fails', async () => {
    const done = deferred<undefined>();
    const emitBackground = deferred<undefined>();
    let rejectPause!: (error: Error) => void;
    mocks.listRuns.mockResolvedValue([{ run_id: 'run', status: 'running' }]);
    mocks.joinStream.mockImplementation(async function* () {
      await emitBackground.promise;
      yield { event: 'message', data: 'Background completion' };
      await done.promise;
    });
    mocks.pauseRun.mockReturnValue(
      new Promise((_resolve, reject) => {
        rejectPause = reject;
      }),
    );
    render(provider('thread-1'));
    await waitFor(() => expect(stream.isLoading).toBe(true));
    let pause!: Promise<void>;
    act(() => {
      pause = stream.pauseRun('run');
    });
    await act(async () => {
      emitBackground.resolve(undefined);
    });
    expect(stream.messages[1].content).toContain('Background completion');
    await act(async () => {
      rejectPause(new Error('Pause unavailable'));
      await expect(pause).rejects.toThrow('Pause unavailable');
    });
    expect(stream.isDisplayPaused).toBe(false);
    expect(stream.messages[1].content).toContain('Background completion');
    expect(stream.isLoading).toBe(true);
    expect(mocks.cancelRun).not.toHaveBeenCalled();
    await act(async () => {
      done.resolve(undefined);
    });
  });

  it('preserves messages on resume failure and joins a successful resume', async () => {
    mocks.getThread.mockResolvedValue({
      metadata: { id: 'conversation-thread-1' },
      status: 'paused',
    });
    mocks.pauseRun.mockResolvedValue({
      state: 'paused',
      pauseId: 'pause-token',
    });
    mocks.resumeRun.mockRejectedValueOnce(new Error('Resume unavailable'));
    mocks.joinStream.mockImplementation(async function* () {});
    render(provider('thread-1'));
    await waitFor(() => expect(stream.messages).toHaveLength(2));
    await act(async () => {
      await stream.pauseRun('run');
    });
    expect(stream.isDisplayPaused).toBe(false);
    await act(async () => {
      await expect(stream.resumeRun('run', 'pause-token')).rejects.toThrow(
        'Resume unavailable',
      );
    });
    expect(stream.isDisplayPaused).toBe(false);
    expect(mocks.joinStream).not.toHaveBeenCalled();
    mocks.resumeRun.mockResolvedValue({ run_id: 'resumed-run' });
    await act(async () => {
      await stream.resumeRun('run', 'pause-token');
    });
    expect(stream.isDisplayPaused).toBe(false);
    expect(mocks.joinStream.mock.calls[0].slice(0, 2)).toEqual([
      'thread-1',
      'resumed-run',
    ]);
  });

  it.each(['pausing', 'paused'])(
    'can stop a reloaded %s run without an SSE connection',
    async (status) => {
      mocks.getThread.mockResolvedValue({
        metadata: { id: 'conversation-thread-1' },
        status,
      });
      mocks.listRuns.mockResolvedValue([{ run_id: 'run', status: 'running' }]);
      mocks.joinStream.mockImplementation(async function* () {});
      render(provider('thread-1'));
      await waitFor(() => expect(stream.historyLoad.status).toBe('loaded'));
      await act(async () => {
        await stream.stop('run');
      });
      expect(mocks.cancelRun).toHaveBeenCalledWith('thread-1', 'run', true);
      expect(stream.isThreadInterrupted).toBe(true);
    },
  );

  it('surfaces stop failures so a paused run can be retried', async () => {
    mocks.getThread.mockResolvedValue({
      metadata: { id: 'conversation-thread-1' },
      status: 'paused',
    });
    mocks.cancelRun.mockRejectedValueOnce(new Error('Cancel unavailable'));
    render(provider('thread-1'));
    await waitFor(() => expect(stream.historyLoad.status).toBe('loaded'));
    await act(async () => {
      await expect(stream.stop('run')).rejects.toThrow('Cancel unavailable');
    });
    expect(stream.isThreadInterrupted).toBe(false);
    await act(async () => {
      await stream.stop('run');
    });
    expect(mocks.cancelRun).toHaveBeenCalledTimes(2);
  });

  it('reconciles a lost pause response without freezing or retrying execution', async () => {
    render(provider('thread-1'));
    await waitFor(() => expect(stream.historyLoad.status).toBe('loaded'));
    mocks.pauseRun.mockRejectedValueOnce(new Error('Response lost'));
    mocks.getThread.mockResolvedValue({
      status: 'pausing',
      runControl: { executionId: 'run', pauseId: 'token', state: 'pausing' },
    });
    await act(async () => {
      await stream.pauseRun('run');
    });
    expect(stream.isDisplayPaused).toBe(false);
    expect(mocks.pauseRun).toHaveBeenCalledOnce();
    expect(mocks.cancelRun).not.toHaveBeenCalled();
  });

  it('does not send a new message until the backend has saved the pause', async () => {
    const done = deferred<undefined>();
    mocks.getThread.mockResolvedValue({
      metadata: { id: 'conversation-thread-1' },
      status: 'pausing',
    });
    mocks.listRuns.mockResolvedValue([{ run_id: 'run', status: 'running' }]);
    mocks.joinStream.mockImplementation(async function* () {
      await done.promise;
    });
    render(provider('thread-1'));
    await waitFor(() => expect(stream.isLoading).toBe(true));
    await act(async () => {
      await expect(
        stream.submit({ input: { input: 'New instruction' } }),
      ).rejects.toThrow('still pausing');
    });
    expect(mocks.cancelRun).not.toHaveBeenCalled();
    expect(mocks.runStream).not.toHaveBeenCalled();
    await act(async () => {
      done.resolve(undefined);
    });
  });

  it('ends the paused run before sending a new message, without resuming it', async () => {
    mocks.getThread.mockResolvedValue({
      metadata: { id: 'conversation-thread-1' },
      status: 'paused',
      runControl: {
        executionId: 'paused-run',
        state: 'paused',
        pauseId: 'token',
      },
    });
    render(provider('thread-1'));
    await waitFor(() => expect(stream.messages).toHaveLength(2));
    await act(async () => {
      await stream.submit({ input: { input: 'New instruction' } });
    });
    expect(mocks.cancelRun).toHaveBeenCalledWith(
      'thread-1',
      'paused-run',
      true,
    );
    expect(mocks.runStream).toHaveBeenCalledTimes(1);
    expect(mocks.cancelRun.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.runStream.mock.invocationCallOrder[0],
    );
    expect(mocks.resumeRun).not.toHaveBeenCalled();
  });

  it('does not start a new request if ending the paused run fails', async () => {
    mocks.getThread.mockResolvedValue({
      metadata: { id: 'conversation-thread-1' },
      status: 'paused',
      runControl: {
        executionId: 'paused-run',
        state: 'paused',
        pauseId: 'token',
      },
    });
    mocks.cancelRun.mockRejectedValueOnce(new Error('Cancel failed'));
    render(provider('thread-1'));
    await waitFor(() => expect(stream.messages).toHaveLength(2));
    await act(async () => {
      await expect(
        stream.submit({ input: { input: 'New instruction' } }),
      ).rejects.toThrow('Cancel failed');
    });
    expect(mocks.runStream).not.toHaveBeenCalled();
  });

  it.each(['idle', 'paused'])(
    'does not hydrate primary-thread approvals into an %s branch',
    async (status) => {
      const operation = {
        tasks: [
          {
            id: 'task',
            name: 'review',
            interrupts: [
              {
                value: {
                  actionRequests: [{ name: 'send_email', args: {} }],
                  reviewConfigs: [
                    {
                      actionName: 'send_email',
                      allowedDecisions: ['approve', 'reject'],
                    },
                  ],
                },
              },
            ],
          },
        ],
      };
      mocks.getConversation.mockResolvedValue({
        id: 'conversation',
        status: 'interrupted',
        operation,
      });
      mocks.getThread.mockResolvedValue({
        metadata: { id: 'conversation' },
        status,
        operation: null,
      });
      render(provider('branch'));
      await waitFor(() => expect(stream.historyLoad.status).toBe('loaded'));
      expect(stream.pendingHITLRequest).toBeNull();
    },
  );
});
