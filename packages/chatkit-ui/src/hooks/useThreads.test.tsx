import { act, renderHook, waitFor } from '@testing-library/react';
import type { ChatConversation } from '@xpert-ai/xpert-sdk';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useThreads, type ThreadHistoryScope } from './useThreads';

const mocks = vi.hoisted(() => ({
  search: vi.fn(),
  projectId: 'project-a' as string | undefined,
  threadId: null as string | null,
}));
vi.mock('../providers/Stream', () => {
  const client = { conversations: { search: mocks.search } };
  return {
    useStreamContext: () => ({
      client,
      assistantId: 'assistant-1',
      projectId: mocks.projectId,
      threadId: mocks.threadId,
      isReady: true,
      isLoading: false,
    }),
  };
});

function conversation(id: string, projectId?: string): ChatConversation {
  return { id, threadId: `thread-${id}`, title: id, projectId };
}

describe('Assistant history scopes', () => {
  beforeEach(() => {
    mocks.search.mockReset();
    mocks.projectId = 'project-a';
    mocks.threadId = null;
  });

  it('lists bound and personal conversations regardless of the current Project', async () => {
    mocks.search.mockResolvedValue({
      items: [
        conversation('a', 'project-a'),
        conversation('b', 'project-b'),
        conversation('personal'),
      ],
    });
    const { result } = renderHook(() => useThreads());
    await waitFor(() => expect(result.current.threads).toHaveLength(3));
    expect(mocks.search).toHaveBeenCalledWith(
      {
        where: { xpertId: 'assistant-1' },
        limit: 50,
        order: { updatedAt: 'DESC' },
      },
      { signal: expect.any(AbortSignal) },
    );
    expect(result.current.threads.map((item) => item.projectId)).toEqual([
      'project-a',
      'project-b',
      null,
    ]);
  });

  it.each([
    ['current-project', 'project-a'],
    ['no-project', null],
  ] as const)('applies the explicit %s filter', async (scope, projectId) => {
    mocks.search.mockResolvedValue({ items: [] });
    renderHook(() => useThreads(undefined, true, scope));
    await waitFor(() =>
      expect(mocks.search).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { xpertId: 'assistant-1', projectId },
        }),
        { signal: expect.any(AbortSignal) },
      ),
    );
  });

  it('does not insert the active Project conversation into a personal-only list', async () => {
    mocks.threadId = 'thread-active';
    mocks.search.mockImplementation(
      async (query: { where: { threadId?: string } }) => ({
        items: query.where.threadId
          ? [conversation('active', 'project-a')]
          : [conversation('personal')],
      }),
    );
    const { result } = renderHook(() =>
      useThreads(undefined, true, 'no-project'),
    );
    await waitFor(() =>
      expect(result.current.threads.map((item) => item.recordId)).toEqual([
        'personal',
      ]),
    );
    expect(mocks.search).toHaveBeenCalledTimes(2);
  });

  it('ignores a stale refresh after switching the history filter', async () => {
    let resolveFirst!: (value: { items: ChatConversation[] }) => void;
    mocks.search.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveFirst = resolve;
      }),
    );
    mocks.search.mockResolvedValue({ items: [conversation('personal')] });
    const { result, rerender } = renderHook(
      ({ scope }: { scope: ThreadHistoryScope }) =>
        useThreads(undefined, true, scope),
      { initialProps: { scope: 'all' } },
    );
    const firstSignal: AbortSignal = mocks.search.mock.calls[0][1].signal;
    rerender({ scope: 'no-project' });
    await waitFor(() =>
      expect(result.current.threads.map((item) => item.recordId)).toEqual([
        'personal',
      ]),
    );
    expect(firstSignal.aborted).toBe(true);
    await act(async () =>
      resolveFirst({ items: [conversation('stale', 'project-a')] }),
    );
    expect(result.current.threads.map((item) => item.recordId)).toEqual([
      'personal',
    ]);
    expect(result.current.isLoading).toBe(false);
  });
});
