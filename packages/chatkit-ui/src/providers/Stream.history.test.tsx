import React from 'react';
import { act, cleanup, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  queryThread: null as string | null,
  isParentAvailable: false,
  getThread: vi.fn(),
  getConversation: vi.fn(),
  searchMessages: vi.fn(),
  searchConversations: vi.fn(),
  listRuns: vi.fn(),
  joinStream: vi.fn(),
  cancelRun: vi.fn(),
  clearActivities: vi.fn(),
  refreshServices: vi.fn(),
  sendEvent: vi.fn(),
  sendCommand: vi.fn(),
}));

vi.mock('@xpert-ai/xpert-sdk', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@xpert-ai/xpert-sdk')>();
  class Client {
    threads = { get: mocks.getThread };
    conversations = {
      get: mocks.getConversation,
      search: mocks.searchConversations,
      searchMessages: mocks.searchMessages,
    };
    runs = {
      list: mocks.listRuns,
      joinStream: mocks.joinStream,
      cancel: mocks.cancelRun,
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
    mocks.refreshServices.mockResolvedValue(undefined);
    mocks.cancelRun.mockResolvedValue(undefined);
  });
  afterEach(cleanup);

  it('loads a preselected initial thread instead of treating its ID as loaded history', async () => {
    render(provider('thread-1'));
    await waitFor(() => expect(stream.messages).toHaveLength(2));
    expect(stream.messages[1].content).toBe('Saved reply');
    expect(mocks.searchMessages).toHaveBeenCalledTimes(1);
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
});
