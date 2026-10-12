import * as React from 'react';
import type { ChatkitMessage, ChatKitTheme } from '@xpert-ai/chatkit-types';
import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ThemeProvider } from '../../providers/Theme';
import type { StreamContextType } from '../../providers/stream/types';
import { useChatStreamingFeedback } from '../chat/messages/useChatStreamingFeedback';
import { MessageList } from './MessageList';

vi.mock('../../i18n/useChatkitTranslation', () => ({
  useChatkitTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'en-US' },
  }),
}));

const answer: ChatkitMessage = {
  id: 'answer',
  type: 'assistant',
  status: 'answering',
  content: 'The final answer',
  reasoning: [{ id: 'thought', type: 'reasoning', text: 'Earlier thought' }],
};
const user: ChatkitMessage = {
  id: 'question',
  type: 'user',
  content: 'A question',
};
const setStream = vi.fn();

function StreamingHarness({
  isLoading,
  onCommit,
}: {
  isLoading: boolean;
  onCommit: (thinking: boolean) => void;
}) {
  const stream = React.useMemo(
    () => ({ isLoading, messages: [answer] }) as StreamContextType,
    [isLoading],
  );
  const feedback = useChatStreamingFeedback({
    surface: 'main',
    stream,
    setStream,
  });
  React.useLayoutEffect(() => {
    onCommit(Boolean(screen.queryByText('message.thinking')));
  });
  return (
    <MessageList
      messages={[answer]}
      isLoading={isLoading}
      showLoadingDots={feedback.showLoadingDots}
      streamingNow={feedback.streamingNow}
      lastStreamOutputAt={feedback.lastStreamOutputAtRef.current}
    />
  );
}

afterEach(() => vi.useRealTimers());

const themes: ChatKitTheme[] = [
  { radius: 'sharp', density: 'compact', colorScheme: 'light' },
  { radius: 'round', density: 'spacious', colorScheme: 'dark' },
];

for (const mode of ['transcript', 'bubbles'] as const) {
  describe(`${mode} streaming indicators`, () => {
    it.each(themes)(
      'stops at message completion while transport is still loading ($colorScheme)',
      (theme) => {
        const messages = [user, answer];
        const wrapper = ({ children }: { children: React.ReactNode }) => (
          <ThemeProvider theme={theme}>{children}</ThemeProvider>
        );
        const { rerender } = render(
          <MessageList
            messages={messages}
            isLoading
            showLoadingDots
            messagePresentation={{ mode }}
          />,
          { wrapper },
        );
        expect(screen.getByText('message.answering')).toBeVisible();
        expect(screen.queryByText('message.thinking')).toBeNull();
        rerender(
          <MessageList
            messages={[user, { ...answer, status: 'success' }]}
            isLoading
            showLoadingDots
            messagePresentation={{ mode }}
          />,
        );
        expect(screen.getByText('The final answer')).toBeVisible();
        expect(screen.queryByText('message.answering')).toBeNull();
        expect(screen.queryByText('message.thinking')).toBeNull();
        const reasoningLabel = screen.queryByText('message.reasoning');
        if (reasoningLabel)
          expect(reasoningLabel).not.toHaveClass('ck-tool-call-running-text');
      },
    );

    it.each(['success', 'completed', 'error', 'interrupted', 'paused'])(
      'does not replace %s with fallback thinking',
      (status) => {
        render(
          <MessageList
            messages={[{ ...answer, status, reasoning: undefined }]}
            isLoading
            showLoadingDots
            messagePresentation={{ mode }}
          />,
          { wrapper: ThemeProvider },
        );
        expect(screen.getByText('The final answer')).toBeVisible();
        expect(screen.queryByText('message.thinking')).toBeNull();
      },
    );

    it('ignores a stale loading-dots flag after the stream stops', () => {
      render(
        <MessageList
          messages={[answer]}
          isLoading={false}
          showLoadingDots
          messagePresentation={{ mode }}
        />,
        { wrapper: ThemeProvider },
      );
      expect(screen.queryByText('message.thinking')).toBeNull();
      expect(screen.queryByText('message.answering')).toBeNull();
    });

    it('shows one indicator before a reply and switches to the active assistant', () => {
      const { rerender } = render(
        <MessageList
          messages={[user]}
          isLoading
          showLoadingDots
          messagePresentation={{ mode }}
        />,
        { wrapper: ThemeProvider },
      );
      expect(screen.getAllByText('message.thinking')).toHaveLength(1);
      rerender(
        <MessageList
          messages={[user, { ...answer, status: 'reasoning', content: '' }]}
          isLoading
          showLoadingDots
          messagePresentation={{ mode }}
        />,
      );
      expect(screen.getAllByText('message.thinking')).toHaveLength(1);
      rerender(
        <MessageList
          messages={[user, answer]}
          isLoading
          showLoadingDots
          messagePresentation={{ mode }}
        />,
      );
      expect(screen.getAllByText('message.answering')).toHaveLength(1);
      expect(screen.queryByText('message.thinking')).toBeNull();
    });

    it('shows thinking for a new turn after a completed reply', () => {
      render(
        <MessageList
          messages={[{ ...answer, status: 'success' }, user]}
          isLoading
          showLoadingDots
          messagePresentation={{ mode }}
        />,
        { wrapper: ThemeProvider },
      );
      expect(screen.getByText('The final answer')).toBeVisible();
      expect(screen.getAllByText('message.thinking')).toHaveLength(1);
    });
  });
}

describe('stream completion render timing', () => {
  it.each([200, 3000])(
    'never commits thinking after a %ims reply stops and can start another reply',
    (duration) => {
      vi.useFakeTimers({
        toFake: [
          'Date',
          'setTimeout',
          'clearTimeout',
          'setInterval',
          'clearInterval',
        ],
      });
      const onCommit = vi.fn();
      const { rerender } = render(
        <StreamingHarness isLoading onCommit={onCommit} />,
        { wrapper: ThemeProvider },
      );
      act(() => {
        vi.advanceTimersByTime(duration);
      });
      onCommit.mockClear();
      rerender(<StreamingHarness isLoading={false} onCommit={onCommit} />);
      expect(onCommit).toHaveBeenCalled();
      expect(onCommit.mock.calls.every(([thinking]) => !thinking)).toBe(true);
      expect(screen.queryByText('message.thinking')).toBeNull();
      act(() => {
        vi.advanceTimersByTime(1000);
      });
      expect(screen.queryByText('message.thinking')).toBeNull();
      rerender(<StreamingHarness isLoading onCommit={onCommit} />);
      expect(screen.getByText('message.answering')).toBeVisible();
    },
  );
});
