import { act, renderHook, waitFor } from '@testing-library/react';
import { Client, type ChatConversation } from '@xpert-ai/xpert-sdk';
import { describe, expect, it, vi } from 'vitest';
import { useMessageHistory } from './useMessageHistory';

const conversation = (id: string, projectId?: string): ChatConversation => ({
  id,
  threadId: `thread-${id}`,
  title: id,
  projectId,
  updatedAt: '2026-09-30T08:00:00Z',
});
function setup() {
  const client = new Client({ apiUrl: 'https://api.example.com' });
  const search = vi.spyOn(client.conversations, 'search');
  const getProject = vi.spyOn(client.projects, 'get');
  getProject.mockRejectedValue(new Error('Unavailable'));
  const options = {
    client,
    assistantId: 'assistant-1',
    projectId: 'project-1',
    enabled: true,
    query: '',
    scope: 'all' as const,
  };
  return { search, getProject, options };
}

describe('useMessageHistory', () => {
  it('shows the last page immediately on reopen while refreshing it in the background', async () => {
    const { options, search } = setup();
    search.mockResolvedValueOnce({ items: [conversation('cached')], total: 1 });
    const { result, rerender } = renderHook(
      ({ enabled }) => useMessageHistory({ ...options, enabled }),
      { initialProps: { enabled: true } },
    );
    await waitFor(() => expect(result.current.threads).toHaveLength(1));
    rerender({ enabled: false });
    let finish!: (page: { items: ChatConversation[]; total: number }) => void;
    search.mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    rerender({ enabled: true });
    expect(result.current.threads[0]?.title).toBe('cached');
    await waitFor(() => expect(search).toHaveBeenCalledTimes(2));
    expect(result.current.isLoading).toBe(true);
    await act(async () => finish({ items: [conversation('fresh')], total: 1 }));
    expect(result.current.threads[0]?.title).toBe('fresh');
    expect(result.current.isLoading).toBe(false);
  });

  it('does not reuse a cached page for a different assistant or project filter', async () => {
    const { options, search } = setup();
    search.mockResolvedValueOnce({
      items: [conversation('private')],
      total: 1,
    });
    search.mockImplementation(() => new Promise(() => {}));
    const { result, rerender } = renderHook(
      ({ assistantId, scope }) =>
        useMessageHistory({ ...options, assistantId, scope }),
      {
        initialProps: {
          assistantId: 'assistant-1',
          scope: 'all' as 'all' | 'current-project',
        },
      },
    );
    await waitFor(() => expect(result.current.threads).toHaveLength(1));
    rerender({ assistantId: 'assistant-1', scope: 'current-project' });
    expect(result.current.threads).toEqual([]);
    rerender({ assistantId: 'assistant-2', scope: 'all' });
    expect(result.current.threads).toEqual([]);
  });

  it('only loads while open and keeps title searches scoped to the assistant', async () => {
    const { options, search } = setup();
    search.mockResolvedValue({
      items: [conversation('Older report')],
      total: 1,
    });
    const { result, rerender } = renderHook(
      ({ enabled, query }) => useMessageHistory({ ...options, enabled, query }),
      { initialProps: { enabled: false, query: '' } },
    );
    expect(search).not.toHaveBeenCalled();
    rerender({ enabled: true, query: 'Older report' });
    await waitFor(() => expect(result.current.threads).toHaveLength(1));
    expect(search).toHaveBeenCalledWith(
      {
        where: { xpertId: 'assistant-1' },
        search: 'Older report',
        offset: 0,
        limit: 50,
        order: { updatedAt: 'DESC', id: 'DESC' },
      },
      { signal: expect.any(AbortSignal) },
    );
    expect(result.current.threads[0]).toMatchObject({
      recordId: 'Older report',
      id: 'thread-Older report',
    });
  });

  it.each([
    ['current-project', 'project-1'],
    ['no-project', null],
  ] as const)('uses the %s project scope', async (scope, projectId) => {
    const { options, search } = setup();
    search.mockResolvedValue({ items: [], total: 0 });
    renderHook(() => useMessageHistory({ ...options, scope }));
    await waitFor(() =>
      expect(search).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { xpertId: 'assistant-1', projectId },
        }),
        { signal: expect.any(AbortSignal) },
      ),
    );
  });

  it('ignores late search responses and aborts when the dialog closes', async () => {
    const { options, search } = setup();
    let resolveFirst: (value: {
      items: ChatConversation[];
      total: number;
    }) => void = () => undefined;
    search.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveFirst = resolve;
      }),
    );
    search.mockResolvedValue({ items: [conversation('new result')], total: 1 });
    const { result, rerender } = renderHook(
      ({ query, enabled }) => useMessageHistory({ ...options, query, enabled }),
      { initialProps: { query: '', enabled: true } },
    );
    await waitFor(() => expect(search).toHaveBeenCalledTimes(1));
    const firstSignal = search.mock.calls[0]?.[1]?.signal;
    rerender({ query: 'new', enabled: true });
    expect(result.current.threads).toEqual([]);
    await waitFor(() =>
      expect(result.current.threads[0]?.title).toBe('new result'),
    );
    expect(firstSignal?.aborted).toBe(true);
    await act(async () =>
      resolveFirst({ items: [conversation('stale')], total: 1 }),
    );
    expect(result.current.threads[0]?.title).toBe('new result');
    const latestSignal = search.mock.calls[1]?.[1]?.signal;
    rerender({ query: 'new', enabled: false });
    expect(latestSignal?.aborted).toBe(true);
    expect(result.current.threads).toEqual([]);
  });

  it('appends older pages without duplicates and retries the same offset after an error', async () => {
    const { options, search } = setup();
    const firstPage = Array.from({ length: 50 }, (_, index) =>
      conversation(String(index)),
    );
    search.mockResolvedValueOnce({ items: firstPage, total: 52 });
    search.mockRejectedValueOnce(new Error('Network'));
    search.mockResolvedValueOnce({
      items: [conversation('49'), conversation('older')],
      total: 52,
    });
    const { result } = renderHook(() => useMessageHistory(options));
    await waitFor(() => expect(result.current.threads).toHaveLength(50));
    act(() => {
      result.current.loadMore();
      result.current.loadMore();
    });
    await waitFor(() => expect(result.current.loadMoreError).toBe(true));
    expect(result.current.threads).toHaveLength(50);
    act(() => result.current.loadMore());
    await waitFor(() => expect(result.current.threads).toHaveLength(51));
    expect(search.mock.calls.slice(1).map(([query]) => query?.offset)).toEqual([
      50, 50,
    ]);
    expect(result.current.hasMore).toBe(false);
    expect(result.current.loadMoreError).toBe(false);
  });

  it('resolves and caches project names without blocking history when a project is unavailable', async () => {
    const { options, search, getProject } = setup();
    getProject.mockResolvedValueOnce({
      id: 'project-1',
      name: 'Design project',
      status: 'active',
    });
    search.mockResolvedValue({
      items: [
        conversation('a', 'project-1'),
        conversation('b', 'project-1'),
        conversation('c', 'unavailable'),
      ],
      total: 3,
    });
    const { result } = renderHook(() => useMessageHistory(options));
    await waitFor(() =>
      expect(result.current.threads[0]?.projectName).toBe('Design project'),
    );
    expect(result.current.threads[2]?.projectName).toBe('');
    expect(getProject).toHaveBeenCalledTimes(2);
    act(() => result.current.refresh());
    await waitFor(() => expect(search).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(getProject).toHaveBeenCalledTimes(2);
  });
});
