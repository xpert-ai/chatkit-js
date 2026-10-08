import * as React from 'react';
import { act, render, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  deferred,
  mocks,
  Probe,
  setupHistoryTests,
  stream,
  StreamProvider,
} from '../testing/history-fixture';
import type { ProjectConversationRequest } from './useProjectConversation';

function tree(
  projectId: string | undefined,
  request: ProjectConversationRequest | null,
  apiKey = 'cs-x-test',
) {
  return (
    <StreamProvider
      apiKey={apiKey}
      apiUrl="https://api.example.test/api/ai"
      xpertId="assistant-1"
      projectId={projectId}
      projectConversationRequest={request}
      threadStateMode="memory"
    >
      <Probe />
      <iframe title="preserved-view" />
    </StreamProvider>
  );
}

describe('Project conversation navigation', () => {
  setupHistoryTests();

  it('opens the latest conversation after a deliberate project switch and preserves views', async () => {
    mocks.searchConversations.mockResolvedValue({
      items: [{ id: 'latest', threadId: 'latest-thread' }],
    });
    mocks.getConversation.mockResolvedValue({
      id: 'conversation-latest-thread',
      projectId: 'project-2',
      status: 'idle',
    });
    const { rerender, getByTitle } = render(tree('project-1', null));
    const view = getByTitle('preserved-view');
    expect(mocks.searchConversations).not.toHaveBeenCalled();
    rerender(tree('project-2', { projectId: 'project-2' }));
    expect(stream.runtimeScopeReady).toBe(false);
    await waitFor(() => expect(stream.historyLoad.status).toBe('loaded'));
    expect(mocks.searchConversations).toHaveBeenCalledWith(
      {
        where: { xpertId: 'assistant-1', projectId: 'project-2' },
        limit: 1,
        order: { updatedAt: 'DESC', id: 'DESC' },
      },
      { signal: expect.any(AbortSignal) },
    );
    expect(stream.threadId).toBe('latest-thread');
    expect(stream.messages[0]?.id).toBe('latest-thread-human');
    expect(getByTitle('preserved-view')).toBe(view);
    expect(mocks.cancelRun).not.toHaveBeenCalled();
    expect(mocks.pauseRun).not.toHaveBeenCalled();
  });

  it('leaves an empty project on a new conversation without persisting one', async () => {
    mocks.searchConversations.mockResolvedValue({ items: [] });
    render(tree('empty', { projectId: 'empty' }));
    await waitFor(() => expect(stream.runtimeScopeReady).toBe(true));
    expect(stream.threadId).toBeNull();
    expect(stream.messages).toEqual([]);
    expect(mocks.getThread).not.toHaveBeenCalled();
  });

  it('ignores an older project response after a second switch', async () => {
    const old = deferred<{ items: { threadId: string }[] }>();
    mocks.searchConversations
      .mockReturnValueOnce(old.promise)
      .mockResolvedValue({ items: [{ threadId: 'new-thread' }] });
    const { rerender } = render(tree('old', { projectId: 'old' }));
    await waitFor(() =>
      expect(mocks.searchConversations).toHaveBeenCalledTimes(1),
    );
    const signal = mocks.searchConversations.mock.calls[0][1]
      .signal as AbortSignal;
    rerender(tree('new', { projectId: 'new' }));
    await waitFor(() => expect(stream.historyLoad.status).toBe('loaded'));
    await act(async () => old.resolve({ items: [{ threadId: 'old-thread' }] }));
    expect(signal.aborted).toBe(true);
    expect(stream.threadId).toBe('new-thread');
    expect(mocks.getThread).not.toHaveBeenCalledWith('old-thread');
  });

  it.each(['new-chat', 'history'] as const)(
    'does not override explicit %s navigation during the lookup',
    async (target) => {
      const pending = deferred<{ items: { threadId: string }[] }>();
      mocks.searchConversations.mockReturnValue(pending.promise);
      render(tree('project-1', { projectId: 'project-1' }));
      await waitFor(() =>
        expect(mocks.searchConversations).toHaveBeenCalledTimes(1),
      );
      await act(async () => {
        if (target === 'new-chat') stream.reset(null, []);
        else await stream.loadThread('explicit-thread');
      });
      expect(stream.runtimeScopeReady).toBe(true);
      await act(async () =>
        pending.resolve({ items: [{ threadId: 'late-thread' }] }),
      );
      expect(stream.threadId).toBe(
        target === 'new-chat' ? null : 'explicit-thread',
      );
      expect(mocks.getThread).not.toHaveBeenCalledWith('late-thread');
    },
  );

  it('waits for credentials and filters personal conversations explicitly', async () => {
    const request = { projectId: null };
    mocks.searchConversations.mockResolvedValue({ items: [] });
    const { rerender } = render(tree(undefined, request, ''));
    expect(mocks.searchConversations).not.toHaveBeenCalled();
    rerender(tree(undefined, request));
    await waitFor(() => expect(stream.runtimeScopeReady).toBe(true));
    expect(mocks.searchConversations).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { xpertId: 'assistant-1', projectId: null },
      }),
      expect.anything(),
    );
  });

  it('reports lookup failures and releases the composer', async () => {
    mocks.searchConversations.mockRejectedValue(new Error('Unavailable'));
    render(tree('project-1', { projectId: 'project-1' }));
    await waitFor(() => expect(stream.error).toEqual(new Error('Unavailable')));
    expect(stream.runtimeScopeReady).toBe(true);
    expect(stream.threadId).toBeNull();
  });

  it('cancels the pending lookup when the session is closed', async () => {
    const pending = deferred<{ items: { threadId: string }[] }>();
    mocks.searchConversations.mockReturnValue(pending.promise);
    const { unmount } = render(tree('project-1', { projectId: 'project-1' }));
    await waitFor(() =>
      expect(mocks.searchConversations).toHaveBeenCalledTimes(1),
    );
    const signal = mocks.searchConversations.mock.calls[0][1]
      .signal as AbortSignal;
    unmount();
    expect(signal.aborted).toBe(true);
    await act(async () =>
      pending.resolve({ items: [{ threadId: 'late-thread' }] }),
    );
    expect(mocks.getThread).not.toHaveBeenCalled();
  });
});
