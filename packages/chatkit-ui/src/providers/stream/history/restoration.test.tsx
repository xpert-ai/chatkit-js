import { act, render, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  deferred,
  history,
  mocks,
  Probe,
  provider,
  setupHistoryTests,
  stream,
  StreamProvider,
  useTestStream,
} from '../testing/history-fixture';

describe('thread history restoration', () => {
  setupHistoryTests();

  it('reveals history and the view scope while sandbox discovery is still pending', async () => {
    const services = deferred<void>();
    mocks.refreshServices.mockReturnValue(services.promise);
    render(provider('thread-1'));
    await waitFor(() => expect(mocks.refreshServices).toHaveBeenCalled());
    await waitFor(() => expect(stream.historyLoad.status).toBe('loaded'));
    expect(stream.runtimeScopeReady).toBe(true);
    expect(stream.messages).toHaveLength(2);
    await act(async () => services.resolve());
  });

  it('keeps history and views available when background sandbox discovery fails', async () => {
    const warning = vi
      .spyOn(console, 'warn')
      .mockImplementation(() => undefined);
    mocks.refreshServices.mockRejectedValue(new Error('Provider unavailable'));
    try {
      render(provider('thread-1'));
      await waitFor(() => expect(stream.historyLoad.status).toBe('loaded'));
      expect(stream.runtimeScopeReady).toBe(true);
      expect(stream.messages).toHaveLength(2);
      expect(warning).toHaveBeenCalledWith(
        '[chatkit-ui] Background sandbox service refresh failed',
        expect.any(Error),
      );
    } finally {
      warning.mockRestore();
    }
  });

  it('acknowledges a resume only after the SDK receives its server run identity', async () => {
    render(provider('thread-1'));
    await waitFor(() => expect(stream.historyLoad.status).toBe('loaded'));
    const accepted = vi.fn();
    const resolved = vi.fn();
    const response = deferred<void>();
    const finished = deferred<void>();
    mocks.runStream.mockImplementation(
      async function* (_thread, _assistant, options) {
        await response.promise;
        options.onRunCreated({ run_id: 'run-1', thread_id: 'thread-1' });
        await finished.promise;
      },
    );
    let run!: Promise<void>;
    await act(async () => {
      run = stream.submit(
        {
          action: 'resume',
          conversationId: 'conversation-thread-1',
          target: {},
          decision: { type: 'confirm', payload: {} },
        },
        { onThreadResolved: resolved, onRunAccepted: accepted },
      );
    });
    expect(resolved).toHaveBeenCalledOnce();
    expect(accepted).not.toHaveBeenCalled();
    await act(async () => response.resolve());
    expect(accepted).toHaveBeenCalledOnce();
    expect(stream.isLoading).toBe(true);
    await act(async () => {
      finished.resolve();
      await run;
    });
  });

  it('propagates a rejected resume without acknowledging it', async () => {
    render(provider('thread-1'));
    await waitFor(() => expect(stream.historyLoad.status).toBe('loaded'));
    const accepted = vi.fn();
    mocks.runStream.mockImplementation(async function* () {
      throw new Error('HTTP 409 resume rejected');
    });
    await act(async () => {
      await expect(
        stream.submit(
          {
            action: 'resume',
            conversationId: 'conversation-thread-1',
            target: {},
            decision: { type: 'confirm', payload: {} },
          },
          { onRunAccepted: accepted },
        ),
      ).rejects.toThrow('HTTP 409');
    });
    expect(accepted).not.toHaveBeenCalled();
  });

  it('exposes a stable runtime scope only after initial history restoration', async () => {
    const snapshots: {
      ready: boolean;
      conversation: string | null;
      project?: string;
    }[] = [];
    function ScopeProbe() {
      useTestStream();
      snapshots.push({
        ready: stream.runtimeScopeReady,
        conversation: stream.conversationId,
        project: stream.projectId,
      });
      return null;
    }
    mocks.getConversation.mockImplementation(async (id: string) => ({
      id,
      projectId: 'saved-project',
      status: 'idle',
    }));
    const messages = deferred<ReturnType<typeof history>>();
    mocks.searchMessages.mockReturnValue(messages.promise);
    render(
      <StreamProvider
        apiKey="cs-x-test"
        apiUrl="https://api.example.test/api/ai"
        xpertId="assistant-1"
        initialThread="thread-1"
        threadStateMode="memory"
      >
        <ScopeProbe />
      </StreamProvider>,
    );
    expect(snapshots[0].ready).toBe(false);
    await waitFor(() => expect(mocks.searchMessages).toHaveBeenCalledOnce());
    expect(stream.runtimeScopeReady).toBe(false);
    await act(async () => messages.resolve(history('thread-1')));
    await waitFor(() => expect(stream.runtimeScopeReady).toBe(true));
    expect(snapshots.filter((snapshot) => snapshot.ready)).not.toHaveLength(0);
    expect(
      snapshots
        .filter((snapshot) => snapshot.ready)
        .every(
          (snapshot) =>
            snapshot.conversation === 'conversation-thread-1' &&
            snapshot.project === 'saved-project',
        ),
    ).toBe(true);
    act(() => stream.reset(null));
    expect(stream.runtimeScopeReady).toBe(true);
    expect(stream.conversationId).toBeNull();
  });

  it('loads a preselected initial thread instead of treating its ID as loaded history', async () => {
    render(provider('thread-1'));
    await waitFor(() => expect(stream.messages).toHaveLength(2));
    expect(stream.messages[1].content).toBe('Saved reply');
    expect(mocks.searchMessages).toHaveBeenCalledTimes(1);
  });

  it('notifies the host after history and its persisted Project have loaded', async () => {
    mocks.getConversation.mockImplementation(async (id: string) => ({
      id,
      projectId: 'project-b',
      status: 'idle',
    }));
    const messages = deferred<ReturnType<typeof history>>();
    mocks.searchMessages.mockReturnValue(messages.promise);
    render(provider('thread-1'));
    await waitFor(() => expect(mocks.searchMessages).toHaveBeenCalledOnce());
    expect(mocks.sendEvent).toHaveBeenCalledWith(
      'public_event',
      ['thread.load.start', { threadId: 'thread-1' }],
      undefined,
    );
    expect(mocks.sendEvent).not.toHaveBeenCalledWith(
      'public_event',
      ['thread.load.end', { threadId: 'thread-1' }],
      undefined,
    );
    await act(async () => messages.resolve(history('thread-1')));
    await waitFor(() => expect(stream.historyLoad.status).toBe('loaded'));
    expect(
      mocks.sendEvent.mock.calls.filter(
        ([, data]) => data?.[0] === 'thread.load.end',
      ),
    ).toEqual([
      [
        'public_event',
        ['thread.load.end', { threadId: 'thread-1' }],
        undefined,
      ],
    ]);
    expect(stream.projectId).toBe('project-b');
  });

  it('does not notify successful history completion on a failed load', async () => {
    mocks.searchMessages.mockRejectedValue(new Error('History unavailable'));
    render(provider('thread-1'));
    await waitFor(() => expect(stream.historyLoad.status).toBe('error'));
    expect(mocks.sendEvent).not.toHaveBeenCalledWith(
      'public_event',
      ['thread.load.end', { threadId: 'thread-1' }],
      undefined,
    );
  });

  it('does not treat a completed history execution as the active run on an idle thread', async () => {
    mocks.getThread.mockResolvedValue({
      metadata: { id: 'conversation-thread-1' },
      status: 'idle',
    });
    mocks.getConversation.mockResolvedValue({
      id: 'conversation-thread-1',
      status: 'idle',
    });
    render(provider('thread-1'));
    await waitFor(() => expect(stream.messages).toHaveLength(2));
    expect(stream.activeRunId).toBeNull();
  });

  it('restores root execution ancestry before displaying a resumed history message', async () => {
    mocks.searchMessages.mockResolvedValue({
      items: [
        {
          id: 'reply',
          role: 'ai',
          executionId: 'resumed-root',
          content: [
            {
              type: 'text',
              text: 'Saved output',
              executionId: 'original-root',
            },
          ],
        },
      ],
      total: 1,
    });
    mocks.getRun.mockImplementation(async (_thread: string, id: string) => ({
      metadata:
        id === 'resumed-root'
          ? { resumedFromExecutionId: 'original-root' }
          : {},
    }));
    render(provider('thread-1'));
    await waitFor(() => expect(stream.historyLoad.status).toBe('loaded'));
    expect(stream.messages[0]).toMatchObject({
      rootExecutionIds: ['resumed-root', 'original-root'],
    });
    expect(mocks.getRun).toHaveBeenCalledWith('thread-1', 'resumed-root');
    expect(mocks.getRun).toHaveBeenCalledWith('thread-1', 'original-root');
  });

  it('restores a thread opened directly from the URL', async () => {
    mocks.queryThread = 'thread-1';
    render(provider());
    await waitFor(() => expect(stream.messages).toHaveLength(2));
  });

  it('uses the saved Project for a historical conversation opened from a no-Project entry', async () => {
    mocks.getConversation.mockImplementation(async (id: string) => ({
      id,
      status: 'idle',
      projectId: 'saved-project',
    }));
    render(
      <StreamProvider
        apiKey="cs-x-test"
        apiUrl="https://api.example.test/api/ai"
        xpertId="assistant-1"
        initialThread="thread-1"
        projectSelection={{ mode: 'none' }}
        threadStateMode="memory"
      >
        <Probe />
      </StreamProvider>,
    );
    await waitFor(() => expect(stream.historyLoad.status).toBe('loaded'));
    expect(stream.projectId).toBe('saved-project');
    await act(async () => {
      await stream.submit({ input: { input: 'Continue the outline' } });
    });
    expect(mocks.runStream).toHaveBeenCalledWith(
      'thread-1',
      'assistant-1',
      expect.objectContaining({
        input: expect.objectContaining({
          projectId: 'saved-project',
          projectSelection: { mode: 'existing', projectId: 'saved-project' },
        }),
      }),
    );
  });

  it.each(['project-b', undefined])(
    'continues history in its saved scope %s instead of the mounted Project',
    async (projectId) => {
      mocks.getConversation.mockImplementation(async (id: string) => ({
        id,
        status: 'idle',
        projectId,
      }));
      render(provider('thread-1'));
      await waitFor(() => expect(stream.historyLoad.status).toBe('loaded'));
      expect(stream.projectId).toBe(projectId);
      expect(stream.projectScopeResolved).toBe(true);
      await act(async () => {
        await stream.submit({ input: { input: 'Continue the outline' } });
      });
      expect(mocks.runStream).toHaveBeenCalledWith(
        'thread-1',
        'assistant-1',
        expect.objectContaining({
          input: expect.objectContaining({
            projectId,
            projectSelection: projectId
              ? { mode: 'existing', projectId }
              : { mode: 'none' },
          }),
        }),
      );
    },
  );

  it('finds cross-project history when protocol metadata is unavailable', async () => {
    mocks.getThread.mockResolvedValue({ metadata: {} });
    mocks.searchConversations.mockResolvedValue({
      items: [
        {
          id: 'conversation-thread-1',
          threadId: 'thread-1',
          status: 'idle',
          projectId: 'project-b',
        },
      ],
    });
    mocks.getConversation.mockResolvedValue({
      id: 'conversation-thread-1',
      projectId: 'project-b',
    });
    render(provider('thread-1'));
    await waitFor(() => expect(stream.historyLoad.status).toBe('loaded'));
    expect(mocks.searchConversations).toHaveBeenCalledWith({
      where: { xpertId: 'assistant-1', threadId: 'thread-1' },
      limit: 1,
    });
    expect(stream.projectId).toBe('project-b');
  });

  it('allows reopening the same thread to refresh a partial transcript', async () => {
    render(provider());
    act(() =>
      stream.reset('thread-1', [
        { id: 'human', type: 'human', content: 'Question' },
      ]),
    );
    await act(async () => {
      await stream.loadThread('thread-1');
    });
    expect(stream.messages).toHaveLength(2);
    await act(async () => {
      await stream.loadThread('thread-1');
    });
    expect(mocks.searchMessages).toHaveBeenCalledTimes(2);
  });
});
