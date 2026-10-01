import { describe, expect, it } from 'vitest';
import {
  createConversationMessagesPageQuery,
  mergeHistoryUiMessages,
  normalizeConversationMessagesPage,
} from '../../Stream';

describe('conversation message history pagination', () => {
  it('orders equal timestamps by the message ancestry returned by the server', () => {
    const createdAt = '2026-09-22T00:00:00Z';
    const page = normalizeConversationMessagesPage({
      items: [
        { id: 'a2', parentId: 'h2', role: 'ai', createdAt },
        { id: 'h2', parentId: 'a1', role: 'human', createdAt },
        { id: 'a1', parentId: 'h1', role: 'ai', createdAt },
        { id: 'h1', parentId: null, role: 'human', createdAt },
      ],
    });
    expect(page.messages.map((message) => message.id)).toEqual([
      'h1',
      'a1',
      'h2',
      'a2',
    ]);
  });

  it('builds reverse-created-at page queries for conversation messages', () => {
    expect(createConversationMessagesPageQuery(0)).toEqual({
      order: { createdAt: 'DESC' },
      limit: 50,
      offset: 0,
    });
    expect(createConversationMessagesPageQuery(-10).offset).toBe(0);
  });

  it('normalizes reverse pages into chronological UI messages', () => {
    const page = normalizeConversationMessagesPage({
      total: 3,
      items: [
        {
          id: 'newer',
          role: 'ai',
          content: 'Newer',
          createdAt: '2026-01-03T00:00:00.000Z',
        },
        {
          id: 'pending-follow-up',
          role: 'human',
          content: 'Queued follow-up',
          followUpStatus: 'pending',
          followUpMode: 'queue',
          createdAt: '2026-01-02T00:00:00.000Z',
        },
        {
          id: 'older',
          role: 'human',
          content: 'Older',
          createdAt: '2026-01-01T00:00:00.000Z',
        },
      ] as any,
    });

    expect(page.messages.map((message) => message.id)).toEqual([
      'older',
      'newer',
    ]);
    expect(page.pendingFollowUps).toHaveLength(1);
    expect(page.loadedCount).toBe(3);
    expect(page.total).toBe(3);
    expect(page.hasMore).toBe(false);
  });

  it('preserves persisted assistant message status', () => {
    const page = normalizeConversationMessagesPage({
      items: [
        {
          id: 'assistant-1',
          role: 'ai',
          content: 'Done',
          status: 'success',
          createdAt: '2026-01-01T00:00:00.000Z',
        },
      ] as any,
    });

    expect(page.messages[0]).toEqual(
      expect.objectContaining({
        id: 'assistant-1',
        type: 'ai',
        status: 'success',
      }),
    );
  });

  it('prepends older pages in order while preserving existing duplicates', () => {
    const merged = mergeHistoryUiMessages(
      [
        {
          id: 'middle',
          type: 'human',
          content: 'Existing middle',
          createdAt: '2026-01-02T00:00:00.000Z',
        },
        {
          id: 'newer',
          type: 'ai',
          content: 'Newer',
          createdAt: '2026-01-03T00:00:00.000Z',
        },
      ] as any,
      [
        {
          id: 'older',
          type: 'human',
          content: 'Older',
          createdAt: '2026-01-01T00:00:00.000Z',
        },
        {
          id: 'middle',
          type: 'human',
          content: 'Duplicate middle',
          createdAt: '2026-01-02T00:00:00.000Z',
        },
      ] as any,
    );

    expect(merged.map((message) => message.id)).toEqual([
      'older',
      'middle',
      'newer',
    ]);
    expect(merged.find((message) => message.id === 'middle')?.content).toBe(
      'Existing middle',
    );
  });
});
