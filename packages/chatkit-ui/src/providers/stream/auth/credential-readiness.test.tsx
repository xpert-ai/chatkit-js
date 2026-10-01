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

describe('thread history restoration', () => {
  setupHistoryTests();

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
    expect(mocks.sendEvent).not.toHaveBeenCalledWith(
      'public_event',
      ['thread.load.end', { threadId: 'old' }],
      undefined,
    );
    expect(mocks.sendEvent).toHaveBeenCalledWith(
      'public_event',
      ['thread.load.end', { threadId: 'new' }],
      undefined,
    );
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
});
