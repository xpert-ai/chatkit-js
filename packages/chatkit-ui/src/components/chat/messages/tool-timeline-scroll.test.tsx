import { act, fireEvent, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  baseChatOptions,
  Chat,
  mocks,
  renderChat,
  setupChatTest,
} from '../testing/chat-fixture';

const nextFrame = () =>
  act(
    () =>
      new Promise<void>((resolve) => requestAnimationFrame(() => resolve())),
  );

describe('reading tool details during streaming', () => {
  setupChatTest();

  it.each([true, false])(
    'pauses follow only for timeline interaction (timeline=%s)',
    async (timeline) => {
      mocks.stream.messages = [
        { id: 'reply', type: 'assistant', content: 'Checking sales' },
      ];
      const view = renderChat();
      await nextFrame();
      const viewport = view.container.querySelector<HTMLElement>(
        '[data-chatkit-root]',
      );
      if (!viewport) throw new Error('Missing transcript');
      Object.defineProperties(viewport, {
        scrollHeight: { configurable: true, value: 2000 },
        clientHeight: { configurable: true, value: 500 },
      });
      const scrollTo = vi.fn();
      viewport.scrollTo = scrollTo;
      viewport.scrollTop = 100;
      fireEvent.scroll(viewport);
      // Explicitly enable following first, just as sending a prompt does.
      fireEvent.click(
        screen.getByRole('button', { name: 'chat.scrollToBottom' }),
      );
      await nextFrame();
      expect(scrollTo).toHaveBeenCalled();
      scrollTo.mockClear();

      const button = document.createElement('button');
      button.textContent = 'Inspect call';
      if (timeline) button.setAttribute('data-tool-timeline', '');
      viewport.append(button);
      fireEvent.click(button, { detail: 0 }); // Keyboard activation uses the same click path.
      mocks.stream.isLoading = true;
      mocks.stream.messages = [
        ...mocks.stream.messages,
        { id: 'next', type: 'assistant', content: 'More tool output' },
      ];
      view.rerender(<Chat clientSecret="secret" options={baseChatOptions} />);
      await nextFrame();
      if (timeline) expect(scrollTo).not.toHaveBeenCalled();
      else expect(scrollTo).toHaveBeenCalled();
    },
  );
});
