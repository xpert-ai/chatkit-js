import {
  act,
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
} from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  Chat,
  baseChatOptions,
  mocks,
  setupChatTest,
} from '../testing/chat-fixture';
import { useAssistantConversation } from '../useAssistantConversation';

const inherited = [
  { id: 'main-user', type: 'human', content: 'Main conversation question' },
  { id: 'main-reply', type: 'ai', content: 'Main conversation reply' },
];
const own = [
  { id: 'side-user', type: 'human', content: 'Side conversation question' },
  {
    id: 'side-reply',
    type: 'ai',
    content: 'Side conversation reply',
    executionId: 'side-run',
  },
];
const props = {
  clientSecret: 'secret',
  options: baseChatOptions,
  surface: 'side' as const,
  inheritedMessagesEndId: 'main-reply',
};

describe('Side-chat transcript boundary', () => {
  setupChatTest();

  it.each([
    { label: 'no messages', messages: [] },
    { label: 'only inherited messages', messages: inherited },
  ])(
    'omits the loaded empty-state label in a side chat with $label',
    async ({ messages }) => {
      mocks.stream.threadId = 'side';
      mocks.stream.historyLoad = { threadId: 'side', status: 'loaded' };
      mocks.stream.messages = messages;
      const view = render(<Chat {...props} />);
      await act(async () => {});
      expect(screen.queryByText('chat.emptyHistory')).toBeNull();

      mocks.stream.messages = [];
      view.rerender(<Chat {...props} surface="main" />);
      expect(screen.getByText('chat.emptyHistory')).toBeVisible();
    },
  );

  it('keeps the history failure and retry action visible in an empty side chat', async () => {
    mocks.stream.threadId = 'side';
    mocks.stream.historyLoad = {
      threadId: 'side',
      status: 'error',
      error: new Error('History unavailable'),
    };
    render(<Chat {...props} />);
    await act(async () => {});
    expect(screen.getByText('chat.errors.loadMessages')).toBeVisible();
    expect(
      screen.getByRole('button', { name: 'chat.retryHistory' }),
    ).toBeVisible();
    expect(screen.queryByText('chat.emptyHistory')).toBeNull();
  });

  it('hides inherited messages, shows new replies, and leaves the complete stream and main view intact', async () => {
    mocks.stream.threadId = 'side';
    mocks.stream.messages = [...inherited];
    mocks.stream.historyMessagePagination.hasMore = true;
    const view = render(<Chat {...props} />);
    await act(async () => {});
    expect(screen.queryByText(inherited[0].content)).toBeNull();
    expect(screen.queryByText(inherited[1].content)).toBeNull();
    expect(screen.queryByRole('button', { name: 'Load more' })).toBeNull();
    expect(mocks.stream.messages).toEqual(inherited);

    mocks.stream.messages = [...inherited, ...own];
    view.rerender(<Chat {...props} />);
    expect(screen.getByText(own[0].content)).toBeVisible();
    expect(screen.getByText(own[1].content)).toBeVisible();
    expect(screen.queryByText(inherited[1].content)).toBeNull();
    expect(mocks.stream.messages).toEqual([...inherited, ...own]);
    expect(mocks.stream.reset).not.toHaveBeenCalled();

    view.rerender(<Chat {...props} surface="main" />);
    expect(screen.getByText(inherited[0].content)).toBeVisible();
    expect(screen.getByText(inherited[1].content)).toBeVisible();
    expect(screen.getByRole('button', { name: 'Load more' })).toBeVisible();
  });

  it('loads older side-chat pages until the fork boundary, then hides the inherited prefix', async () => {
    mocks.stream.threadId = 'side';
    mocks.stream.messages = [...own];
    mocks.stream.historyMessagePagination.hasMore = true;
    const view = render(<Chat {...props} />);
    fireEvent.click(screen.getByRole('button', { name: 'Load more' }));
    await waitFor(() =>
      expect(mocks.stream.loadMoreConversationMessages).toHaveBeenCalledOnce(),
    );
    mocks.stream.messages = [...inherited, ...own];
    view.rerender(<Chat {...props} />);
    expect(screen.queryByRole('button', { name: 'Load more' })).toBeNull();
    expect(screen.queryByText(inherited[0].content)).toBeNull();
    expect(screen.queryByText(inherited[1].content)).toBeNull();
    expect(screen.getByText(own[0].content)).toBeVisible();
  });

  it('keeps the root side-chat boundary after selecting and reopening an editing branch', async () => {
    mocks.stream.threadId = 'side-edit';
    mocks.stream.messages = [...inherited, ...own];
    const view = render(<Chat {...props} />);
    await act(async () => {});
    expect(screen.queryByText(inherited[1].content)).toBeNull();
    expect(screen.getByText(own[1].content)).toBeVisible();
    view.unmount();
    render(<Chat {...props} />);
    await act(async () => {});
    expect(screen.queryByText(inherited[1].content)).toBeNull();
    expect(screen.getByText(own[1].content)).toBeVisible();
  });

  it('maps visible retry indices to the complete stream without dropping inherited context', async () => {
    mocks.stream.threadId = 'side';
    mocks.stream.conversationId = 'conversation';
    mocks.stream.messages = [...inherited, ...own];
    const { result } = renderHook(() => useAssistantConversation(props));
    await act(async () => {});
    expect(result.current.transcript.messageList.messages).toEqual(own);
    act(() => result.current.transcript.messageList.onRetry?.(1));
    expect(mocks.stream.submit).toHaveBeenCalledWith(
      expect.objectContaining({
        input: expect.objectContaining({ input: own[0].content }),
        id: 'side-reply',
        executionId: 'side-run',
        retry: true,
      }),
      expect.any(Object),
    );
    const options = mocks.stream.submit.mock.calls[0][1];
    expect(
      options.optimisticValues({ messages: [...inherited, ...own] }).messages,
    ).toEqual([...inherited, own[0]]);
    expect(mocks.stream.messages).toEqual([...inherited, ...own]);
  });
});
