import { act, render, waitFor } from '@testing-library/react';
import React from 'react';
import { describe, expect, it } from 'vitest';
import type { StreamContextType } from '../../Stream';
import {
  deferred,
  history,
  mocks,
  provider,
  setupHistoryTests,
  stream,
} from '../testing/history-fixture';

describe('thread history restoration', () => {
  setupHistoryTests();

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
});
