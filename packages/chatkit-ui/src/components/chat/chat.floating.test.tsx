import {
  fireEvent,
  render,
  screen,
  waitFor,
  act,
} from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import {
  Chat,
  setupChatTest,
  baseChatOptions,
  mocks,
  setComposerText,
} from './testing/chat-fixture';
import {
  WorkbenchChatProvider,
  useWorkbenchChat,
} from '../../workbench/floating-chat/context';

function Controls() {
  const chat = useWorkbenchChat();
  if (!chat) throw new Error('Missing workbench context');
  return (
    <>
      <button onClick={() => chat.setMode('expanded')}>Expand fixture</button>
      <button onClick={() => chat.setMode('compact')}>Compact fixture</button>
      <button onClick={() => chat.setMode('minimized')}>
        Minimize fixture
      </button>
    </>
  );
}
function Tree({
  floating = true,
  side = false,
}: {
  floating?: boolean;
  side?: boolean;
}) {
  return (
    <WorkbenchChatProvider scope="conversation" floating={floating}>
      <Controls />
      <Chat
        surface={side ? 'side' : 'main'}
        clientSecret="secret"
        options={{
          ...baseChatOptions,
          header: { character: { enabled: false } },
        }}
      />
    </WorkbenchChatProvider>
  );
}
describe('Chat floating presentation', () => {
  setupChatTest();
  it('retains the actual composer and transcript through mode changes and normal presentation', async () => {
    mocks.stream.messages = [
      { id: 'user-1', type: 'human', content: 'Existing conversation message' },
    ];
    const result = render(<Tree />);
    const input = screen.getByRole('textbox');
    setComposerText(input, 'Unsent draft');
    const transcript = result.container.querySelector(
      '[data-slot="chatkit-chat-content"]',
    );
    if (!transcript) throw new Error('Missing transcript');
    expect(transcript).toHaveAttribute('hidden');
    fireEvent.compositionStart(input);
    fireEvent.click(screen.getByText('Expand fixture'));
    expect(
      result.container.querySelector('[data-slot="chatkit-chat-content"]'),
    ).toBe(transcript);
    expect(transcript).not.toHaveAttribute('hidden');
    expect(screen.getByRole('textbox')).toBe(input);
    expect(input).toHaveTextContent('Unsent draft');
    fireEvent.compositionEnd(input);
    fireEvent.click(screen.getByText('Minimize fixture'));
    fireEvent.click(screen.getByText('Compact fixture'));
    result.rerender(<Tree floating={false} />);
    expect(screen.getByRole('textbox')).toBe(input);
    expect(input).toHaveTextContent('Unsent draft');
    expect(transcript).not.toHaveAttribute('hidden');
    await waitFor(() => expect(mocks.stream.submit).not.toHaveBeenCalled());
  });

  it('does not apply the main conversation presentation to side chats', async () => {
    const result = render(<Tree side />);
    expect(
      result.container.querySelector('[data-chat-presentation]'),
    ).toBeNull();
    expect(
      result.container.querySelector('[data-slot="chatkit-chat-content"]'),
    ).not.toHaveAttribute('hidden');
    await act(async () => undefined);
  });

  it('preserves the reading position when hidden transcript receives more messages', async () => {
    mocks.stream.messages = [
      { id: 'user-1', type: 'human', content: 'Message' },
    ];
    const result = render(<Tree />);
    fireEvent.click(screen.getByText('Expand fixture'));
    const viewport = result.container.querySelector<HTMLElement>(
      '[data-chatkit-root]',
    );
    if (!viewport) throw new Error('Missing viewport');
    Object.defineProperties(viewport, {
      scrollHeight: { configurable: true, value: 2000 },
      clientHeight: { configurable: true, value: 500 },
    });
    viewport.scrollTop = 250;
    fireEvent.wheel(viewport, { deltaY: -20 });
    fireEvent.scroll(viewport);
    fireEvent.click(screen.getByText('Compact fixture'));
    viewport.scrollTop = 0;
    fireEvent.scroll(viewport);
    mocks.stream.messages = [
      ...mocks.stream.messages,
      { id: 'user-2', type: 'human', content: 'More output' },
    ];
    result.rerender(<Tree />);
    await act(async () => undefined);
    fireEvent.click(screen.getByText('Expand fixture'));
    expect(viewport.scrollTop).toBe(250);
  });
});
