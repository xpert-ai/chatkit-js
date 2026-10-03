import { fireEvent, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { mocks, renderChat, setupChatTest } from '../testing/chat-fixture';

describe('Chat history pagination', () => {
  setupChatTest();
  it('loads older messages from the top history divider', async () => {
    mocks.stream.threadId = 'thread-1';
    mocks.stream.messages = [
      {
        id: 'message-1',
        type: 'human',
        content: 'Hello from the latest page',
        createdAt: '2026-01-01T00:00:00.000Z',
      },
    ];
    mocks.stream.historyMessagePagination = {
      conversationId: 'conversation-1',
      loadedCount: 50,
      total: 75,
      hasMore: true,
      isLoadingMore: false,
    };

    renderChat();

    const loadMore = screen.getByRole('button', { name: 'Load more' });
    expect(loadMore).not.toBeDisabled();
    fireEvent.click(loadMore);

    await waitFor(() =>
      expect(mocks.stream.loadMoreConversationMessages).toHaveBeenCalledTimes(
        1,
      ),
    );
  });

  it('disables the top history divider while older messages are loading', async () => {
    mocks.stream.threadId = 'thread-1';
    mocks.stream.messages = [
      {
        id: 'message-1',
        type: 'human',
        content: 'Hello from the latest page',
        createdAt: '2026-01-01T00:00:00.000Z',
      },
    ];
    mocks.stream.historyMessagePagination = {
      conversationId: 'conversation-1',
      loadedCount: 50,
      total: 75,
      hasMore: true,
      isLoadingMore: true,
    };

    renderChat();

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Loading...' })).toBeDisabled(),
    );
  });
});
