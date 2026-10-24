import { screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { mocks, renderChat, setupChatTest } from '../testing/chat-fixture';

describe('connection availability presentation', () => {
  setupChatTest();
  it.each(['reconnecting', 'unavailable'] as const)(
    'shows only a short %s hint and preserves the visible progress',
    async (state) => {
      mocks.stream.threadId = 'thread-1';
      mocks.stream.connectionState = state;
      // The disconnected output consumer has ended, but execution status is unknown.
      mocks.stream.isLoading = false;
      mocks.assistantMessage.mockClear();
      mocks.stream.error = Object.assign(
        new Error('HTTP 503: private replica diagnostic'),
        { status: 503 },
      );
      mocks.stream.messages = [
        {
          id: 'ai',
          type: 'ai',
          content: 'Progress already received',
        },
      ];
      const { container } = renderChat();
      await waitFor(() =>
        expect(screen.getByText(`connection.${state}`)).toBeVisible(),
      );
      expect(container.textContent).toContain('Progress already received');
      expect(mocks.assistantMessage).toHaveBeenLastCalledWith(
        expect.objectContaining({ isThreadRunning: undefined }),
      );
      expect(container.textContent).not.toContain('private replica diagnostic');
      expect(container.textContent).not.toContain('HTTP 503');
      expect(container.textContent).not.toContain('message.thinking');
      expect(screen.getByRole('button', { name: 'send' })).toBeDisabled();
      expect(mocks.stream.submit).not.toHaveBeenCalled();
    },
  );
});
