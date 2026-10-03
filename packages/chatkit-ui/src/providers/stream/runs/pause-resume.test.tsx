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
    'restores the durable display snapshot on a fresh page while backend status is %s',
    async (status) => {
      const pause = savedDisplay();
      mocks.getThread.mockResolvedValue({
        metadata: { id: 'conversation-thread-1' },
        status,
        displayPause: pause,
      });
      mocks.getConversation.mockResolvedValue({
        id: 'conversation-thread-1',
        status: 'idle',
      });
      mocks.listRuns.mockResolvedValue([
        { run_id: 'run', status: status === 'pausing' ? 'running' : 'success' },
      ]);
      render(provider('thread-1'));
      await waitFor(() => expect(stream.historyLoad.status).toBe('loaded'));
      expect(stream.isDisplayPaused).toBe(true);
      expect(stream.messages).toEqual([
        { id: 'visible-ai', type: 'ai', content: 'Visible prefix' },
      ]);
      expect(stream.displayPause?.pauseId).toBe('pause-token');
      if (status === 'idle') {
        mocks.searchMessages.mockResolvedValue({
          items: [
            { id: 'later', role: 'ai', content: 'Completed after refresh' },
          ],
          total: 1,
        });
        await act(async () => {
          await stream.resumeDisplay();
        });
        expect(mocks.releaseDisplayPause).toHaveBeenCalledWith(
          'thread-1',
          'pause-token',
        );
        expect(
          stream.messages.some(
            (message) => message.content === 'Completed after refresh',
          ),
        ).toBe(true);
        expect(stream.isDisplayPaused).toBe(false);
        expect(mocks.resumeRun).not.toHaveBeenCalled();
      }
    },
  );

  it('keeps the durable snapshot when revealing fails and clears it before a new instruction after completion', async () => {
    mocks.getThread.mockResolvedValue({
      metadata: { id: 'conversation-thread-1' },
      status: 'idle',
      displayPause: savedDisplay(),
    });
    render(provider('thread-1'));
    await waitFor(() => expect(stream.historyLoad.status).toBe('loaded'));
    mocks.releaseDisplayPause.mockRejectedValueOnce(new Error('Reveal failed'));
    await act(async () => {
      await expect(stream.resumeDisplay()).rejects.toThrow('Reveal failed');
    });
    expect(stream.isDisplayPaused).toBe(true);
    await act(async () => {
      await stream.submit({ input: { input: 'New instruction' } });
    });
    expect(mocks.releaseDisplayPause.mock.invocationCallOrder[1]).toBeLessThan(
      mocks.runStream.mock.invocationCallOrder[0],
    );
    expect(stream.isDisplayPaused).toBe(false);
  });

  it('does not apply a completed reveal response to another thread', async () => {
    const release = deferred<void>();
    mocks.getThread.mockImplementation(async (id: string) => ({
      metadata: { id: `conversation-${id}` },
      status: 'idle',
      ...(id === 'thread-1' ? { displayPause: savedDisplay() } : {}),
    }));
    render(provider('thread-1'));
    await waitFor(() => expect(stream.historyLoad.status).toBe('loaded'));
    mocks.releaseDisplayPause.mockReturnValueOnce(release.promise);
    let revealing!: Promise<void>;
    act(() => {
      revealing = stream.resumeDisplay();
    });
    await waitFor(() =>
      expect(mocks.releaseDisplayPause).toHaveBeenCalledTimes(1),
    );
    await act(async () => {
      await stream.loadThread('thread-2');
    });
    await act(async () => {
      release.resolve();
      await revealing;
    });
    expect(stream.threadId).toBe('thread-2');
    expect(stream.messages[1].id).toBe('thread-2-ai');
  });

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

  it('freezes visible output immediately while allowing the backend stream to finish the current step', async () => {
    const done = deferred<undefined>();
    const emitBackground = deferred<undefined>();
    const pauseAcknowledged = deferred<{
      state: string;
      displayPause: ReturnType<typeof savedDisplay>;
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
    expect(stream.isDisplayPaused).toBe(true);
    const frozen = stream.messages;
    await act(async () => {
      emitBackground.resolve(undefined);
    });
    expect(stream.messages).toEqual(frozen);
    await act(async () => {
      pauseAcknowledged.resolve({
        state: 'pausing',
        displayPause: {
          ...savedDisplay(),
          snapshot: mocks.pauseRun.mock.calls[0][2].displaySnapshot,
        },
      });
      await pause;
    });
    expect(mocks.pauseRun).toHaveBeenCalledWith('thread-1', 'run', {
      displaySnapshot: JSON.stringify({ version: 1, messages: frozen }),
    });
    expect(signal?.aborted).toBe(false);
    expect(mocks.cancelRun).not.toHaveBeenCalled();
    await act(async () => {
      done.resolve(undefined);
    });
    expect(stream.messages).toEqual(frozen);
    expect(stream.isDisplayPaused).toBe(true);
    mocks.listRuns.mockResolvedValue([]);
    await act(async () => {
      await stream.loadThread('thread-2');
    });
    expect(stream.isDisplayPaused).toBe(false);
  });

  it('settles a tool that finishes after the pause click without revealing new output', async () => {
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
    expect(stream.isDisplayPaused).toBe(true);
    expect(readStepStatus(stream.messages[0])).toBe('running');

    await act(async () => {
      emitCompletion.resolve(undefined);
    });
    // The settled tool must stop looking active, but its message text stays frozen.
    expect(readStepStatus(stream.messages[0])).toBe('success');
    expect(JSON.stringify(stream.messages)).not.toContain('Text after pause');

    await act(async () => {
      done.resolve(undefined);
    });
    expect(readStepStatus(stream.messages[0])).toBe('success');
    expect(JSON.stringify(stream.messages)).not.toContain('Text after pause');
    expect(stream.isDisplayPaused).toBe(true);
  });

  it('reveals background output again when a pause request fails', async () => {
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
    expect(stream.messages[1].content).toBe('Saved reply');
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

  it('keeps the snapshot on resume failure and releases it after a successful resume', async () => {
    mocks.getThread.mockResolvedValue({
      metadata: { id: 'conversation-thread-1' },
      status: 'paused',
    });
    mocks.pauseRun.mockResolvedValue({
      state: 'paused',
      displayPause: savedDisplay(),
    });
    mocks.resumeRun.mockRejectedValueOnce(new Error('Resume unavailable'));
    mocks.joinStream.mockImplementation(async function* () {});
    render(provider('thread-1'));
    await waitFor(() => expect(stream.messages).toHaveLength(2));
    await act(async () => {
      await stream.pauseRun('run');
    });
    expect(stream.isDisplayPaused).toBe(true);
    await act(async () => {
      await expect(stream.resumeRun('run', 'pause-token')).rejects.toThrow(
        'Resume unavailable',
      );
    });
    expect(stream.isDisplayPaused).toBe(true);
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
