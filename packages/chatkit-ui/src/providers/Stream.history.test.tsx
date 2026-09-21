import React from 'react';
import { act, cleanup, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  queryThread: null as string | null,
  isParentAvailable: false,
  getThread: vi.fn(),
  getRun: vi.fn(),
  releaseDisplayPause: vi.fn(),
  getConversation: vi.fn(),
  searchMessages: vi.fn(),
  searchConversations: vi.fn(),
  listRuns: vi.fn(),
  joinStream: vi.fn(),
  runStream: vi.fn(),
  cancelRun: vi.fn(),
  pauseRun: vi.fn(),
  resumeRun: vi.fn(),
  clearActivities: vi.fn(),
  refreshServices: vi.fn(),
  sendEvent: vi.fn(),
  sendCommand: vi.fn(),
}));

vi.mock('@xpert-ai/xpert-sdk', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@xpert-ai/xpert-sdk')>();
  class Client {
    threads = { get: mocks.getThread, releaseDisplayPause: mocks.releaseDisplayPause };
    conversations = {
      get: mocks.getConversation,
      search: mocks.searchConversations,
      searchMessages: mocks.searchMessages,
    };
    runs = {
      get: mocks.getRun,
      list: mocks.listRuns,
      joinStream: mocks.joinStream,
      stream: mocks.runStream,
      cancel: mocks.cancelRun,
      pause: mocks.pauseRun,
      resume: mocks.resumeRun,
    };
  }
  return { ...actual, Client };
});
vi.mock('nuqs', async () => {
  const react = await import('react');
  return { useQueryState: () => react.useState(mocks.queryThread) };
});
vi.mock('../hooks/useParentMessenger', () => ({
  useParentMessenger: () => ({
    isParentAvailable: mocks.isParentAvailable,
    sendCommand: mocks.sendCommand,
    sendEvent: mocks.sendEvent,
  }),
}));
vi.mock('./runtime-activities', () => ({
  logRuntimeActivity: vi.fn(),
  useRuntimeActivities: () => ({
    runtimeActivities: {},
    clearRuntimeActivities: mocks.clearActivities,
    refreshSandboxServices: mocks.refreshServices,
    handleRuntimeActivityTrigger: mocks.clearActivities,
    stopRuntimeActivityItem: mocks.clearActivities,
  }),
}));

import {
  StreamProvider,
  useStreamContext,
  type StreamContextType,
} from './Stream';

let stream: StreamContextType;
function Probe() {
  stream = useStreamContext();
  return null;
}
function provider(
  initialThread?: string,
  apiKey = 'cs-x-test',
  projectId = 'project-1',
) {
  return (
    <StreamProvider
      apiKey={apiKey}
      apiUrl="https://api.example.test/api/ai"
      xpertId="assistant-1"
      projectId={projectId}
      initialThread={initialThread}
      threadStateMode={mocks.queryThread ? 'url' : 'memory'}
    >
      <Probe />
    </StreamProvider>
  );
}
function history(threadId: string) {
  return {
    items: [
      { id: `${threadId}-human`, role: 'human', content: 'Question' },
      {
        id: `${threadId}-ai`,
        role: 'ai',
        content: 'Saved reply',
        executionId: `${threadId}-run`,
      },
    ],
    total: 2,
  };
}
function savedDisplay(messages = [{ id: 'visible-ai', type: 'ai', content: 'Visible prefix' }]) {
  return { executionId: 'run', pauseId: 'pause-token', createdAt: '2026-09-19T00:00:00Z', snapshot: JSON.stringify({ version: 1, messages }) };
}

function readStepStatus(message: { content?: unknown } | undefined) {
  const content = message?.content;
  if (!Array.isArray(content)) return undefined;
  const step = content.find(
    (part): part is { data: { status?: unknown } } =>
      typeof part === 'object' &&
      part !== null &&
      'type' in part &&
      part.type === 'component',
  );
  return step?.data?.status;
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

describe('thread history restoration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.queryThread = null;
    mocks.isParentAvailable = false;
    mocks.sendCommand.mockReset();
    mocks.getThread.mockImplementation(async (id: string) => ({
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
    mocks.listRuns.mockResolvedValue([]);
    mocks.getRun.mockReset().mockResolvedValue({ metadata: {} });
    mocks.refreshServices.mockResolvedValue(undefined);
    mocks.cancelRun.mockResolvedValue(undefined);
    mocks.releaseDisplayPause.mockReset().mockResolvedValue(undefined);
    mocks.pauseRun.mockReset().mockImplementation(async (_thread, _run, options) => ({ state: 'pausing', displayPause: { ...savedDisplay(), snapshot: options.displaySnapshot } }));
    mocks.runStream.mockReset().mockImplementation(async function* () {});
  });
  afterEach(cleanup);

  it('loads a preselected initial thread instead of treating its ID as loaded history', async () => {
    render(provider('thread-1'));
    await waitFor(() => expect(stream.messages).toHaveLength(2));
    expect(stream.messages[1].content).toBe('Saved reply');
    expect(mocks.searchMessages).toHaveBeenCalledTimes(1);
  });

  it('restores root execution ancestry before displaying a resumed history message', async () => {
    mocks.searchMessages.mockResolvedValue({ items: [{
      id: 'reply', role: 'ai', executionId: 'resumed-root',
      content: [{ type: 'text', text: 'Saved output', executionId: 'original-root' }],
    }], total: 1 });
    mocks.getRun.mockImplementation(async (_thread: string, id: string) => ({
      metadata: id === 'resumed-root' ? { resumedFromExecutionId: 'original-root' } : {},
    }));
    render(provider('thread-1'));
    await waitFor(() => expect(stream.historyLoad.status).toBe('loaded'));
    expect(stream.messages[0]).toMatchObject({ rootExecutionIds: ['resumed-root', 'original-root'] });
    expect(mocks.getRun).toHaveBeenCalledWith('thread-1', 'resumed-root');
    expect(mocks.getRun).toHaveBeenCalledWith('thread-1', 'original-root');
  });

  it.each(['paused', 'pausing', 'idle'])('restores the durable display snapshot on a fresh page while backend status is %s', async (status) => {
    const pause = savedDisplay();
    mocks.getThread.mockResolvedValue({ metadata: { id: 'conversation-thread-1' }, status, displayPause: pause });
    mocks.getConversation.mockResolvedValue({ id: 'conversation-thread-1', status: 'idle' });
    mocks.listRuns.mockResolvedValue([{ run_id: 'run', status: status === 'pausing' ? 'running' : 'success' }]);
    render(provider('thread-1'));
    await waitFor(() => expect(stream.historyLoad.status).toBe('loaded'));
    expect(stream.isDisplayPaused).toBe(true);
    expect(stream.messages).toEqual([{ id: 'visible-ai', type: 'ai', content: 'Visible prefix' }]);
    expect(stream.displayPause?.pauseId).toBe('pause-token');
    if (status === 'idle') {
      mocks.searchMessages.mockResolvedValue({ items: [{ id: 'later', role: 'ai', content: 'Completed after refresh' }], total: 1 });
      await act(async () => { await stream.resumeDisplay(); });
      expect(mocks.releaseDisplayPause).toHaveBeenCalledWith('thread-1', 'pause-token');
      expect(stream.messages.some((message) => message.content === 'Completed after refresh')).toBe(true);
      expect(stream.isDisplayPaused).toBe(false);
      expect(mocks.resumeRun).not.toHaveBeenCalled();
    }
  });

  it('keeps the durable snapshot when revealing fails and clears it before a new instruction after completion', async () => {
    mocks.getThread.mockResolvedValue({ metadata: { id: 'conversation-thread-1' }, status: 'idle', displayPause: savedDisplay() });
    render(provider('thread-1'));
    await waitFor(() => expect(stream.historyLoad.status).toBe('loaded'));
    mocks.releaseDisplayPause.mockRejectedValueOnce(new Error('Reveal failed'));
    await act(async () => { await expect(stream.resumeDisplay()).rejects.toThrow('Reveal failed'); });
    expect(stream.isDisplayPaused).toBe(true);
    await act(async () => { await stream.submit({ input: { input: 'New instruction' } }); });
    expect(mocks.releaseDisplayPause.mock.invocationCallOrder[1]).toBeLessThan(mocks.runStream.mock.invocationCallOrder[0]);
    expect(stream.isDisplayPaused).toBe(false);
  });

  it('does not apply a completed reveal response to another thread', async () => {
    const release = deferred<void>();
    mocks.getThread.mockImplementation(async (id: string) => ({ metadata: { id: `conversation-${id}` }, status: 'idle', ...(id === 'thread-1' ? { displayPause: savedDisplay() } : {}) }));
    render(provider('thread-1'));
    await waitFor(() => expect(stream.historyLoad.status).toBe('loaded'));
    mocks.releaseDisplayPause.mockReturnValueOnce(release.promise);
    let revealing!: Promise<void>;
    act(() => { revealing = stream.resumeDisplay(); });
    await waitFor(() => expect(mocks.releaseDisplayPause).toHaveBeenCalledTimes(1));
    await act(async () => { await stream.loadThread('thread-2'); });
    await act(async () => { release.resolve(); await revealing; });
    expect(stream.threadId).toBe('thread-2');
    expect(stream.messages[1].id).toBe('thread-2-ai');
  });

  it('restores a thread opened directly from the URL', async () => {
    mocks.queryThread = 'thread-1';
    render(provider());
    await waitFor(() => expect(stream.messages).toHaveLength(2));
  });

  it('waits for credentials before loading the initial thread', async () => {
    const { rerender } = render(provider('thread-1', ''));
    expect(mocks.getThread).not.toHaveBeenCalled();
    rerender(provider('thread-1'));
    await waitFor(() => expect(stream.messages).toHaveLength(2));
  });

  it('uses current credentials when a host callback was captured before initialization', async () => {
    const { rerender } = render(provider(undefined, ''));
    const loadThread = stream.loadThread;
    rerender(provider());
    await act(async () => {
      await loadThread('thread-1');
    });
    expect(stream.historyLoad.status).toBe('loaded');
    expect(stream.messages[1].content).toBe('Saved reply');
  });

  it('waits for a shared credential request before loading host-selected history', async () => {
    mocks.isParentAvailable = true;
    const secret = deferred<string>();
    mocks.sendCommand.mockReturnValue(secret.promise);
    render(provider(undefined, ''));
    let loading!: Promise<void>;
    let duplicate!: Promise<void>;
    act(() => {
      loading = stream.loadThread('thread-1');
      duplicate = stream.loadThread('thread-1');
    });
    await waitFor(() =>
      expect(mocks.sendCommand).toHaveBeenCalledWith('onGetClientSecret', null),
    );
    expect(stream.historyLoad.status).toBe('loading');
    expect(mocks.getThread).not.toHaveBeenCalled();
    expect(mocks.searchMessages).not.toHaveBeenCalled();
    await act(async () => {
      secret.resolve('cs-x-ready');
      await Promise.all([loading, duplicate]);
    });
    expect(stream.historyLoad.status).toBe('loaded');
    expect(stream.messages[1].content).toBe('Saved reply');
    expect(mocks.sendCommand).toHaveBeenCalledTimes(1);
    expect(mocks.searchMessages).toHaveBeenCalledTimes(1);
  });

  it('initializes credentials for a directly opened conversation', async () => {
    mocks.isParentAvailable = true;
    mocks.sendCommand.mockResolvedValue('cs-x-ready');
    render(provider('thread-1', ''));
    await waitFor(() => expect(stream.historyLoad.status).toBe('loaded'));
    expect(stream.messages[1].content).toBe('Saved reply');
    expect(mocks.sendCommand).toHaveBeenCalledTimes(1);
  });

  it('also initializes credentials for the direct conversation history entry point', async () => {
    mocks.isParentAvailable = true;
    mocks.sendCommand.mockResolvedValue('cs-x-ready');
    render(provider(undefined, ''));
    await act(async () => {
      const messages = await stream.loadConversationMessages(
        'conversation-1',
        'thread-1',
      );
      expect(messages).toHaveLength(2);
    });
    expect(stream.historyLoad.status).toBe('loaded');
    expect(mocks.sendCommand).toHaveBeenCalledTimes(1);
  });

  it('loads only the latest thread when selection changes while waiting for credentials', async () => {
    mocks.isParentAvailable = true;
    const secret = deferred<string>();
    mocks.sendCommand.mockReturnValue(secret.promise);
    render(provider(undefined, ''));
    let oldLoad!: Promise<void>;
    let newLoad!: Promise<void>;
    act(() => {
      oldLoad = stream.loadThread('old');
    });
    await waitFor(() => expect(mocks.sendCommand).toHaveBeenCalledTimes(1));
    act(() => {
      newLoad = stream.loadThread('new');
    });
    await act(async () => {
      secret.resolve('cs-x-ready');
      await Promise.all([oldLoad, newLoad]);
    });
    expect(mocks.sendCommand).toHaveBeenCalledTimes(1);
    expect(mocks.getThread.mock.calls).toEqual([['new']]);
    expect(stream.threadId).toBe('new');
    expect(stream.messages[1].id).toBe('new-ai');
  });

  it('does not reopen history after starting fresh while credentials are pending', async () => {
    mocks.isParentAvailable = true;
    const secret = deferred<string>();
    mocks.sendCommand.mockReturnValue(secret.promise);
    render(provider(undefined, ''));
    let loading!: Promise<void>;
    act(() => {
      loading = stream.loadThread('thread-1');
    });
    await waitFor(() => expect(mocks.sendCommand).toHaveBeenCalledTimes(1));
    act(() => stream.reset(null, []));
    await act(async () => {
      secret.resolve('cs-x-ready');
      await loading;
    });
    expect(mocks.getThread).not.toHaveBeenCalled();
    expect(stream.threadId).toBeNull();
    expect(stream.historyLoad.status).toBe('idle');
  });

  it('exposes credential initialization failure and permits an explicit retry', async () => {
    mocks.isParentAvailable = true;
    mocks.sendCommand.mockRejectedValueOnce(new Error('session unavailable'));
    render(provider('thread-1', ''));
    await waitFor(() => expect(stream.historyLoad.status).toBe('error'));
    expect(mocks.getThread).not.toHaveBeenCalled();
    expect(mocks.sendCommand).toHaveBeenCalledTimes(1);
    mocks.sendCommand.mockResolvedValue('cs-x-ready');
    await act(async () => {
      await stream.loadThread('thread-1');
    });
    expect(stream.historyLoad.status).toBe('loaded');
    expect(stream.messages[1].content).toBe('Saved reply');
    expect(mocks.sendCommand).toHaveBeenCalledTimes(2);
  });

  it('does not request history without credentials when no host can provide them', async () => {
    render(provider(undefined, ''));
    await act(async () => {
      await expect(stream.loadThread('thread-1')).rejects.toThrow(
        'Missing ChatKit client secret',
      );
    });
    expect(stream.historyLoad.status).toBe('error');
    expect(mocks.getThread).not.toHaveBeenCalled();
    expect(mocks.sendCommand).not.toHaveBeenCalled();
  });

  it('uses current credentials in a previously captured history pagination callback', async () => {
    mocks.searchMessages.mockImplementation(
      async (_id: string, query: { offset: number }) =>
        query.offset === 0
          ? { ...history('thread-1'), total: 4 }
          : history('older'),
    );
    const { rerender } = render(provider(undefined, ''));
    const loadMore = stream.loadMoreConversationMessages;
    rerender(provider('thread-1'));
    await waitFor(() => expect(stream.historyLoad.status).toBe('loaded'));
    await act(async () => {
      expect(await loadMore()).toHaveLength(2);
    });
    expect(stream.messages).toHaveLength(4);
    expect(mocks.sendCommand).not.toHaveBeenCalled();
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

  it('does not let an older thread lookup overwrite a newer selection', async () => {
    const slow = deferred<{ metadata: { id: string } }>();
    mocks.getThread.mockImplementation((id: string) =>
      id === 'slow'
        ? slow.promise
        : Promise.resolve({ metadata: { id: `conversation-${id}` } }),
    );
    render(provider());
    let oldLoad!: Promise<void>;
    act(() => {
      oldLoad = stream.loadThread('slow');
    });
    await act(async () => {
      await stream.loadThread('fast');
    });
    await act(async () => {
      slow.resolve({ metadata: { id: 'conversation-slow' } });
      await oldLoad;
    });
    expect(stream.threadId).toBe('fast');
    expect(stream.messages[1].id).toBe('fast-ai');
  });

  it('does not let an old branch response replace another branch of the same conversation', async () => {
    const slow = deferred<ReturnType<typeof history>>();
    mocks.getThread.mockResolvedValue({
      metadata: { id: 'shared-conversation' },
    });
    mocks.searchMessages.mockImplementation(
      (_id: string, query: { where: { threadId: string } }) =>
        query.where.threadId === 'slow'
          ? slow.promise
          : Promise.resolve(history('fast')),
    );
    render(provider());
    let oldLoad!: Promise<void>;
    act(() => {
      oldLoad = stream.loadThread('slow');
    });
    await waitFor(() => expect(mocks.searchMessages).toHaveBeenCalled());
    await act(async () => {
      await stream.loadThread('fast');
    });
    await act(async () => {
      slow.resolve(history('slow'));
      await oldLoad;
    });
    expect(stream.threadId).toBe('fast');
    expect(stream.messages[1].id).toBe('fast-ai');
  });

  it('deduplicates simultaneous requests for the same thread', async () => {
    const pending = deferred<ReturnType<typeof history>>();
    mocks.searchMessages.mockReturnValue(pending.promise);
    render(provider());
    let first!: Promise<void>;
    let second!: Promise<void>;
    act(() => {
      first = stream.loadThread('thread-1');
      second = stream.loadThread('thread-1');
    });
    await waitFor(() => expect(mocks.searchMessages).toHaveBeenCalled());
    await act(async () => {
      pending.resolve(history('thread-1'));
      await Promise.all([first, second]);
    });
    expect(mocks.searchMessages).toHaveBeenCalledTimes(1);
  });

  it('returns loaded messages to both callers of the direct history loader', async () => {
    const pending = deferred<ReturnType<typeof history>>();
    mocks.searchMessages.mockReturnValue(pending.promise);
    render(provider());
    let first!: ReturnType<StreamContextType['loadConversationMessages']>;
    let second!: ReturnType<StreamContextType['loadConversationMessages']>;
    act(() => {
      first = stream.loadConversationMessages('conversation-1', 'thread-1');
      second = stream.loadConversationMessages('conversation-1', 'thread-1');
    });
    await waitFor(() => expect(mocks.searchMessages).toHaveBeenCalled());
    await act(async () => {
      pending.resolve(history('thread-1'));
      expect(await first).toHaveLength(2);
      expect(await second).toHaveLength(2);
    });
    expect(mocks.searchMessages).toHaveBeenCalledTimes(1);
  });

  it('exposes a failed initial load and retries the same thread without an automatic retry loop', async () => {
    mocks.searchMessages.mockRejectedValueOnce(
      new Error('history unavailable'),
    );
    render(provider('thread-1'));
    await waitFor(() => expect(stream.historyLoad.status).toBe('error'));
    expect(mocks.searchMessages).toHaveBeenCalledTimes(1);
    await act(async () => {
      await stream.loadThread('thread-1');
    });
    expect(stream.historyLoad.status).toBe('loaded');
    expect(stream.messages).toHaveLength(2);
  });

  it('distinguishes loaded empty history from a new conversation', async () => {
    mocks.searchMessages.mockResolvedValue({ items: [], total: 0 });
    render(provider('empty'));
    await waitFor(() =>
      expect(stream.historyLoad).toEqual({
        threadId: 'empty',
        status: 'loaded',
      }),
    );
    expect(stream.messages).toEqual([]);
  });

  it('invalidates pending history when starting a new conversation', async () => {
    const pending = deferred<ReturnType<typeof history>>();
    mocks.searchMessages.mockReturnValue(pending.promise);
    render(provider());
    let loading!: Promise<void>;
    act(() => {
      loading = stream.loadThread('thread-1');
    });
    await waitFor(() => expect(mocks.searchMessages).toHaveBeenCalled());
    act(() => stream.reset(null, []));
    await act(async () => {
      pending.resolve(history('thread-1'));
      await loading;
    });
    expect(stream.threadId).toBeNull();
    expect(stream.messages).toEqual([]);
    expect(stream.historyLoad.status).toBe('idle');
  });

  it('survives StrictMode effect cleanup and remount', async () => {
    render(<React.StrictMode>{provider('thread-1')}</React.StrictMode>);
    await waitFor(() => expect(stream.historyLoad.status).toBe('loaded'));
    expect(stream.messages).toHaveLength(2);
  });

  it('keeps a live resumed stream intact when the host selects the same thread again', async () => {
    const done = deferred<undefined>();
    mocks.listRuns.mockResolvedValue([{ run_id: 'run-1', status: 'running' }]);
    mocks.joinStream.mockImplementation(async function* () {
      await done.promise;
      yield* [];
    });
    render(provider('thread-1'));
    await waitFor(() => expect(stream.isLoading).toBe(true));
    await act(async () => {
      await stream.loadThread('thread-1');
    });
    expect(mocks.searchMessages).toHaveBeenCalledTimes(1);
    expect(mocks.joinStream).toHaveBeenCalledTimes(1);
    expect(mocks.cancelRun).not.toHaveBeenCalled();
    await act(async () => {
      done.resolve(undefined);
    });
    await waitFor(() => expect(stream.isLoading).toBe(false));
  });

  it('does not restore the initial thread again after manually switching or starting fresh', async () => {
    render(provider('thread-1'));
    await waitFor(() => expect(stream.historyLoad.status).toBe('loaded'));
    await act(async () => {
      await stream.loadThread('thread-2');
    });
    expect(stream.threadId).toBe('thread-2');
    act(() => stream.reset(null, []));
    await act(async () => {});
    expect(stream.threadId).toBeNull();
    expect(mocks.getThread).toHaveBeenCalledTimes(2);
  });

  it('loads the requested thread in a new project scope without accepting the old response', async () => {
    const old = deferred<ReturnType<typeof history>>();
    mocks.searchMessages.mockReturnValueOnce(old.promise);
    const { rerender } = render(provider('thread-1'));
    await waitFor(() => expect(mocks.searchMessages).toHaveBeenCalled());
    rerender(provider('thread-2', 'cs-x-test', 'project-2'));
    await waitFor(() => expect(stream.messages[1]?.id).toBe('thread-2-ai'));
    await act(async () => {
      old.resolve(history('thread-1'));
    });
    expect(stream.threadId).toBe('thread-2');
    expect(stream.messages[1].id).toBe('thread-2-ai');
  });
  it('ignores a late page from a previous branch of the same conversation', async () => {
    const olderPage = deferred<ReturnType<typeof history>>();
    mocks.getThread.mockResolvedValue({
      metadata: { id: 'shared-conversation' },
    });
    mocks.searchMessages.mockImplementation(
      (_id: string, query: { where: { threadId: string }; offset: number }) =>
        query.offset > 0
          ? olderPage.promise
          : Promise.resolve({ ...history(query.where.threadId), total: 4 }),
    );
    render(provider('thread-1'));
    await waitFor(() => expect(stream.historyLoad.status).toBe('loaded'));
    let page!: ReturnType<StreamContextType['loadMoreConversationMessages']>;
    act(() => {
      page = stream.loadMoreConversationMessages();
    });
    await act(async () => {
      await stream.loadThread('thread-2');
    });
    await act(async () => {
      olderPage.resolve(history('thread-1'));
      await page;
    });
    expect(stream.messages.map((message) => message.id)).toEqual([
      'thread-2-human',
      'thread-2-ai',
    ]);
  });

  it('ignores late stream output and completion from the previously opened thread', async () => {
    const oldDone = deferred<undefined>();
    const newDone = deferred<undefined>();
    const signals: AbortSignal[] = [];
    mocks.listRuns.mockImplementation(async (threadId: string) => [
      { run_id: `${threadId}-run`, status: 'running' },
    ]);
    mocks.joinStream.mockImplementation(async function* (
      threadId: string,
      _runId: string,
      options: { signal: AbortSignal },
    ) {
      signals.push(options.signal);
      await (threadId === 'thread-1' ? oldDone.promise : newDone.promise);
      yield {
        event: 'message',
        data: { type: 'message', data: 'Late output' },
      };
    });
    render(provider('thread-1'));
    await waitFor(() => expect(mocks.joinStream).toHaveBeenCalledTimes(1));
    await act(async () => {
      await stream.loadThread('thread-2');
    });
    await waitFor(() => expect(mocks.joinStream).toHaveBeenCalledTimes(2));
    expect(signals[0].aborted).toBe(true);
    expect(mocks.cancelRun).not.toHaveBeenCalled();
    await act(async () => {
      oldDone.resolve(undefined);
    });
    expect(stream.threadId).toBe('thread-2');
    expect(stream.messages[1].content).toBe('Saved reply');
    expect(stream.isLoading).toBe(true);
    await act(async () => {
      newDone.resolve(undefined);
    });
    await waitFor(() => expect(stream.isLoading).toBe(false));
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
    const pauseAcknowledged = deferred<{ state: string; displayPause: ReturnType<typeof savedDisplay> }>();
    mocks.listRuns.mockResolvedValue([{ run_id: 'run', status: 'running' }]);
    let signal: AbortSignal | undefined;
    mocks.joinStream.mockImplementation(async function* (
      _thread: string,
      _run: string,
      options: { signal: AbortSignal },
    ) {
      signal = options.signal;
      await emitBackground.promise;
      yield { event: 'message', data: { type: 'message', data: 'Background completion' } };
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
    await act(async () => { emitBackground.resolve(undefined); });
    expect(stream.messages).toEqual(frozen);
    await act(async () => {
      pauseAcknowledged.resolve({ state: 'pausing', displayPause: { ...savedDisplay(), snapshot: mocks.pauseRun.mock.calls[0][2].displaySnapshot } });
      await pause;
    });
    expect(mocks.pauseRun).toHaveBeenCalledWith('thread-1', 'run', { displaySnapshot: JSON.stringify({ version: 1, messages: frozen }) });
    expect(signal?.aborted).toBe(false);
    expect(mocks.cancelRun).not.toHaveBeenCalled();
    await act(async () => {
      done.resolve(undefined);
    });
    expect(stream.messages).toEqual(frozen);
    expect(stream.isDisplayPaused).toBe(true);
    mocks.listRuns.mockResolvedValue([]);
    await act(async () => { await stream.loadThread('thread-2'); });
    expect(stream.isDisplayPaused).toBe(false);
  });

  it('settles a tool that finishes after the pause click without revealing new output', async () => {
    const runningStep = {
      id: 'shell-1',
      type: 'component',
      data: { category: 'Tool', type: 'command', tool: 'shell', status: 'running' },
    };
    mocks.searchMessages.mockResolvedValue({
      items: [{ id: 'thread-1-ai', role: 'ai', executionId: 'run', content: [runningStep] }],
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
          data: { ...runningStep, data: { ...runningStep.data, status: 'success' } },
        },
      };
      yield { event: 'message', data: { type: 'message', data: 'Text after pause' } };
      await done.promise;
    });
    render(provider('thread-1'));
    await waitFor(() => expect(stream.isLoading).toBe(true));

    await act(async () => { await stream.pauseRun('run'); });
    expect(stream.isDisplayPaused).toBe(true);
    expect(readStepStatus(stream.messages[0])).toBe('running');

    await act(async () => { emitCompletion.resolve(undefined); });
    // The settled tool must stop looking active, but its message text stays frozen.
    expect(readStepStatus(stream.messages[0])).toBe('success');
    expect(JSON.stringify(stream.messages)).not.toContain('Text after pause');

    await act(async () => { done.resolve(undefined); });
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
    mocks.pauseRun.mockReturnValue(new Promise((_resolve, reject) => { rejectPause = reject; }));
    render(provider('thread-1'));
    await waitFor(() => expect(stream.isLoading).toBe(true));
    let pause!: Promise<void>;
    act(() => { pause = stream.pauseRun('run'); });
    await act(async () => { emitBackground.resolve(undefined); });
    expect(stream.messages[1].content).toBe('Saved reply');
    await act(async () => {
      rejectPause(new Error('Pause unavailable'));
      await expect(pause).rejects.toThrow('Pause unavailable');
    });
    expect(stream.isDisplayPaused).toBe(false);
    expect(stream.messages[1].content).toContain('Background completion');
    expect(stream.isLoading).toBe(true);
    expect(mocks.cancelRun).not.toHaveBeenCalled();
    await act(async () => { done.resolve(undefined); });
  });

  it('keeps the snapshot on resume failure and releases it after a successful resume', async () => {
    mocks.getThread.mockResolvedValue({
      metadata: { id: 'conversation-thread-1' }, status: 'paused',
    });
    mocks.pauseRun.mockResolvedValue({ state: 'paused', displayPause: savedDisplay() });
    mocks.resumeRun.mockRejectedValueOnce(new Error('Resume unavailable'));
    mocks.joinStream.mockImplementation(async function* () {});
    render(provider('thread-1'));
    await waitFor(() => expect(stream.messages).toHaveLength(2));
    await act(async () => { await stream.pauseRun('run'); });
    expect(stream.isDisplayPaused).toBe(true);
    await act(async () => {
      await expect(stream.resumeRun('run', 'pause-token')).rejects.toThrow('Resume unavailable');
    });
    expect(stream.isDisplayPaused).toBe(true);
    expect(mocks.joinStream).not.toHaveBeenCalled();
    mocks.resumeRun.mockResolvedValue({ run_id: 'resumed-run' });
    await act(async () => { await stream.resumeRun('run', 'pause-token'); });
    expect(stream.isDisplayPaused).toBe(false);
    expect(mocks.joinStream.mock.calls[0].slice(0, 2)).toEqual(['thread-1', 'resumed-run']);
  });

  it('does not send a new message until the backend has saved the pause', async () => {
    const done = deferred<undefined>();
    mocks.getThread.mockResolvedValue({
      metadata: { id: 'conversation-thread-1' }, status: 'pausing',
    });
    mocks.listRuns.mockResolvedValue([{ run_id: 'run', status: 'running' }]);
    mocks.joinStream.mockImplementation(async function* () { await done.promise; });
    render(provider('thread-1'));
    await waitFor(() => expect(stream.isLoading).toBe(true));
    await act(async () => {
      await expect(stream.submit({ input: { input: 'New instruction' } })).rejects.toThrow('still pausing');
    });
    expect(mocks.cancelRun).not.toHaveBeenCalled();
    expect(mocks.runStream).not.toHaveBeenCalled();
    await act(async () => { done.resolve(undefined); });
  });

  it('ends the paused run before sending a new message, without resuming it', async () => {
    mocks.getThread.mockResolvedValue({
      metadata: { id: 'conversation-thread-1' }, status: 'paused',
      runControl: { executionId: 'paused-run', state: 'paused', pauseId: 'token' },
    });
    render(provider('thread-1'));
    await waitFor(() => expect(stream.messages).toHaveLength(2));
    await act(async () => { await stream.submit({ input: { input: 'New instruction' } }); });
    expect(mocks.cancelRun).toHaveBeenCalledWith('thread-1', 'paused-run', true);
    expect(mocks.runStream).toHaveBeenCalledTimes(1);
    expect(mocks.cancelRun.mock.invocationCallOrder[0]).toBeLessThan(mocks.runStream.mock.invocationCallOrder[0]);
    expect(mocks.resumeRun).not.toHaveBeenCalled();
  });

  it('does not start a new request if ending the paused run fails', async () => {
    mocks.getThread.mockResolvedValue({
      metadata: { id: 'conversation-thread-1' }, status: 'paused',
      runControl: { executionId: 'paused-run', state: 'paused', pauseId: 'token' },
    });
    mocks.cancelRun.mockRejectedValueOnce(new Error('Cancel failed'));
    render(provider('thread-1'));
    await waitFor(() => expect(stream.messages).toHaveLength(2));
    await act(async () => {
      await expect(stream.submit({ input: { input: 'New instruction' } })).rejects.toThrow('Cancel failed');
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
