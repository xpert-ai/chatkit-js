import React from 'react';
import { render, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import {
  Chat,
  baseChatOptions,
  mocks,
  setupChatTest,
} from '../testing/chat-fixture';

setupChatTest();
afterEach(() => {
  mocks.stream.client.assistants.get.mockReset().mockResolvedValue(null);
  mocks.stream.assistantId = 'assistant-1';
});

describe('Assistant appearance in ChatKit', () => {
  it.each(['main', 'side'] as const)(
    'uses published settings in the %s surface and honors explicit options',
    async (surface) => {
      mocks.stream.threadId = 'thread-appearance';
      mocks.stream.messages = [
        { id: 'reply', type: 'assistant', content: 'Reply' },
      ];
      mocks.stream.client.assistants.get.mockResolvedValue({
        name: 'Bubble Assistant',
        config: { options: { messagePresentation: { mode: 'bubbles' } } },
      });
      const { container, rerender } = render(
        <Chat
          surface={surface}
          clientSecret="secret"
          options={baseChatOptions}
        />,
      );
      const mode = () =>
        container
          .querySelector('[data-slot="chatkit-message-list"]')
          ?.getAttribute('data-message-presentation');
      await waitFor(() => expect(mode()).toBe('bubbles'));
      rerender(
        <Chat
          surface={surface}
          clientSecret="secret"
          options={{
            ...baseChatOptions,
            messagePresentation: { mode: 'transcript' },
          }}
        />,
      );
      expect(mode()).toBe('transcript');
      // Removing the explicit host setting restores the current Assistant's default.
      rerender(
        <Chat
          surface={surface}
          clientSecret="secret"
          options={baseChatOptions}
        />,
      );
      expect(mode()).toBe('bubbles');
      mocks.stream.client.assistants.get.mockResolvedValue({
        name: 'Default Assistant',
        config: {},
      });
      mocks.stream.assistantId = 'assistant-2';
      rerender(
        <Chat
          surface={surface}
          clientSecret="secret"
          options={baseChatOptions}
        />,
      );
      expect(mode()).toBe('transcript');
      await waitFor(() =>
        expect(mocks.stream.client.assistants.get).toHaveBeenLastCalledWith(
          'assistant-2',
        ),
      );
    },
  );
});
