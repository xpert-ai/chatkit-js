import { act, renderHook, waitFor } from '@testing-library/react';
import { Client } from '@xpert-ai/xpert-sdk';
import { describe, expect, it, vi } from 'vitest';
import { i18n, initI18n } from '../../../i18n';
import type { StateType } from '../../../providers/stream/types';
import { useChatHistory } from './useChatHistory';

vi.mock('../../../hooks/useThreads', () => ({
  useThreads: () => ({
    threads: [],
    refreshThreads: vi.fn(),
    updateThread: vi.fn(),
    deleteThread: vi.fn(),
  }),
}));

function setup() {
  initI18n();
  const client = new Client<StateType>({ apiUrl: 'https://api.example.com' });
  const search = vi.spyOn(client.conversations, 'search');
  vi.spyOn(client.projects, 'get').mockResolvedValue({
    id: 'other-project',
    name: 'Other project',
    status: 'active',
  });
  const options = {
    activeProjectId: 'active-project',
    surface: 'main' as const,
    history: { enabled: true },
    missingConfig: false,
    t: i18n.t,
    stream: {
      client,
      assistantId: 'assistant-1',
      isReady: true,
      threadId: 'active-thread',
      conversationId: 'active-record',
    },
  };
  return { options, search };
}

describe('useChatHistory project filtering', () => {
  it('scopes search, totals and pagination to a tagged project, then clears it without switching the active project', async () => {
    const { options, search } = setup();
    search.mockImplementation(async (query) => {
      if (query?.where?.projectId === 'other-project') {
        return {
          items: [
            {
              id: query.offset ? 'older' : 'recent',
              threadId: query.offset ? 'thread-older' : 'thread-recent',
              title: 'Report',
              projectId: 'other-project',
            },
          ],
          total: 2,
        };
      }
      return { items: [], total: 10 };
    });
    const { result } = renderHook(() => useChatHistory(options));
    act(() => {
      result.current.setHistoryOpen(true);
      result.current.setHistoryQuery('Report');
    });
    await waitFor(() => expect(result.current.messageHistory.total).toBe(10));
    act(() =>
      result.current.setHistoryProjectFilter({
        id: 'other-project',
        name: 'Other project',
      }),
    );
    await waitFor(() => expect(result.current.messageHistory.total).toBe(2));
    expect(
      result.current.messageHistory.threads.map((item) => item.recordId),
    ).toEqual(['recent']);
    expect(search).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: { xpertId: 'assistant-1', projectId: 'other-project' },
        search: 'Report',
        offset: 0,
      }),
      { signal: expect.any(AbortSignal) },
    );
    act(() => result.current.messageHistory.loadMore());
    await waitFor(() =>
      expect(result.current.messageHistory.threads).toHaveLength(2),
    );
    expect(search).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: { xpertId: 'assistant-1', projectId: 'other-project' },
        search: 'Report',
        offset: 1,
      }),
      { signal: expect.any(AbortSignal) },
    );
    expect(result.current.messageHistory.hasMore).toBe(false);
    act(() => result.current.setHistoryScope('all'));
    await waitFor(() => expect(result.current.messageHistory.total).toBe(10));
    expect(result.current.historyProjectFilter).toBeNull();
    expect(search).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: { xpertId: 'assistant-1' },
        search: 'Report',
        offset: 0,
      }),
      { signal: expect.any(AbortSignal) },
    );
    act(() => result.current.setHistoryScope('current-project'));
    await waitFor(() =>
      expect(search).toHaveBeenLastCalledWith(
        expect.objectContaining({
          where: { xpertId: 'assistant-1', projectId: 'active-project' },
        }),
        { signal: expect.any(AbortSignal) },
      ),
    );
    expect(options.stream.threadId).toBe('active-thread');
  });

  it('clears the tagged project when the assistant changes', async () => {
    const { options, search } = setup();
    search.mockResolvedValue({ items: [], total: 0 });
    const { result, rerender } = renderHook(
      ({ assistantId }) =>
        useChatHistory({
          ...options,
          stream: { ...options.stream, assistantId },
        }),
      { initialProps: { assistantId: 'assistant-1' } },
    );
    act(() => {
      result.current.setHistoryOpen(true);
      result.current.setHistoryProjectFilter({
        id: 'other-project',
        name: 'Other project',
      });
    });
    await waitFor(() => expect(search).toHaveBeenCalled());
    rerender({ assistantId: 'assistant-2' });
    expect(result.current.historyProjectFilter).toBeNull();
    await waitFor(() =>
      expect(search).toHaveBeenLastCalledWith(
        expect.objectContaining({
          where: { xpertId: 'assistant-2' },
          offset: 0,
        }),
        { signal: expect.any(AbortSignal) },
      ),
    );
  });
});
