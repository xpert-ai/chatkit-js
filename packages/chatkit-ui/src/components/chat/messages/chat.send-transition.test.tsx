import { StrictMode } from 'react';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  Chat,
  baseChatOptions,
  getSubmittedOptimisticMessages,
  mocks,
  setComposerText,
  setupChatTest,
} from '../testing/chat-fixture';
import { WorkbenchChatProvider } from '../../../workbench/floating-chat/context';

const animate = vi.fn();
const cancel = vi.fn();
function Tree({ compact = false }: { compact?: boolean }) {
  return (
    <StrictMode>
      <WorkbenchChatProvider scope="test" floating={compact}>
        <Chat clientSecret="secret" options={baseChatOptions} />
      </WorkbenchChatProvider>
    </StrictMode>
  );
}

describe('Chat send transition integration', () => {
  setupChatTest();
  beforeEach(() => {
    animate
      .mockReset()
      .mockReturnValue({ cancel, finished: new Promise(() => {}) });
    cancel.mockReset();
    vi.stubGlobal(
      'matchMedia',
      vi.fn().mockReturnValue({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }),
    );
    Object.defineProperty(HTMLElement.prototype, 'animate', {
      configurable: true,
      value: animate,
    });
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(
      function (this: HTMLElement) {
        return this.matches('[role="textbox"], [data-slot="composer-body"]')
          ? new DOMRect(40, 500, 600, 40)
          : new DOMRect(400, 100, 240, 40);
      },
    );
  });
  afterEach(() => {
    vi.mocked(HTMLElement.prototype.getBoundingClientRect).mockRestore();
    vi.unstubAllGlobals();
    Reflect.deleteProperty(HTMLElement.prototype, 'animate');
  });

  it.each(['button', 'enter'])(
    'animates a %s send once, preserves draft clearing, and survives StrictMode',
    async (method) => {
      const result = render(<Tree />);
      const input = setComposerText(
        screen.getByRole('textbox'),
        'Send this message',
      );
      if (method === 'button')
        fireEvent.click(screen.getByRole('button', { name: 'send' }));
      else fireEvent.keyDown(input, { key: 'Enter' });
      await waitFor(() => expect(mocks.stream.submit).toHaveBeenCalledOnce());
      expect(screen.getByRole('textbox').textContent).toBe('');
      mocks.stream.messages = getSubmittedOptimisticMessages();
      result.rerender(<Tree />);
      expect(screen.getByText('Send this message')).toBeVisible();
      expect(animate).toHaveBeenCalledTimes(3);
      expect(animate.mock.contexts[0]).toBe(
        screen.getByText('Send this message').closest('.group\\/message'),
      );
      expect(animate.mock.contexts[1]).toBe(
        screen.getByText('Send this message').closest('[data-human-bubble]'),
      );
      expect(animate.mock.contexts[2]).toBe(
        screen
          .getByText('Send this message')
          .closest('[data-human-bubble-content]'),
      );
      await act(async () => undefined);
      expect(cancel).not.toHaveBeenCalled();
      // Streaming rerenders and new history must not replay this message.
      mocks.stream.messages = [
        { id: 'older', type: 'human', content: 'Older message' },
        ...mocks.stream.messages,
        { id: 'answer', type: 'ai', content: 'Reply' },
      ];
      result.rerender(<Tree />);
      expect(animate).toHaveBeenCalledTimes(3);
      result.unmount();
      expect(cancel).toHaveBeenCalledTimes(3);
    },
  );

  it('leaves history and queued follow-ups unanimated', async () => {
    mocks.stream.messages = [
      { id: 'history', type: 'human', content: 'History' },
    ];
    mocks.stream.isLoading = true;
    const result = render(<Tree />);
    expect(animate).not.toHaveBeenCalled();
    setComposerText(screen.getByRole('textbox'), 'Queued follow-up');
    fireEvent.click(screen.getByRole('button', { name: 'send' }));
    await waitFor(() => expect(mocks.stream.submit).toHaveBeenCalledOnce());
    expect(mocks.stream.submit.mock.calls[0][1].followUpMode).toBe('queue');
    mocks.stream.messages = [
      ...mocks.stream.messages,
      {
        id: mocks.stream.submit.mock.calls[0][0].id,
        type: 'human',
        content: 'Queued follow-up',
      },
    ];
    result.rerender(<Tree />);
    expect(animate).not.toHaveBeenCalled();
  });

  it('restores a failed draft without leaving an animation to replay later', async () => {
    mocks.stream.submit.mockRejectedValueOnce(new Error('Send failed'));
    const result = render(<Tree />);
    setComposerText(screen.getByRole('textbox'), 'Keep this draft');
    fireEvent.click(screen.getByRole('button', { name: 'send' }));
    await waitFor(() =>
      expect(screen.getByRole('textbox')).toHaveTextContent('Keep this draft'),
    );
    mocks.stream.messages = getSubmittedOptimisticMessages();
    result.rerender(<Tree />);
    expect(animate).not.toHaveBeenCalled();
  });

  it('does not animate compact sends when their hidden transcript is reopened', async () => {
    const result = render(<Tree compact />);
    setComposerText(screen.getByRole('textbox'), 'Floating send');
    fireEvent.click(screen.getByRole('button', { name: 'send' }));
    await waitFor(() => expect(mocks.stream.submit).toHaveBeenCalledOnce());
    mocks.stream.messages = getSubmittedOptimisticMessages();
    result.rerender(<Tree compact />);
    result.rerender(<Tree />);
    expect(screen.getByText('Floating send')).toBeVisible();
    expect(animate).not.toHaveBeenCalled();
  });
});
