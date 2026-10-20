import * as React from 'react';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ChatQuoteActions } from './ChatQuoteActions';
import { useChatQuotes } from './useChatQuotes';
import { disabledWorkbenchContext } from '../../../workbench/context';
import type { StreamContextType } from '../../../providers/stream/types';
import { useChatkitTranslation } from '../../../i18n/useChatkitTranslation';
import { ThemeProvider } from '../../../providers/Theme';

describe('quote side chat while streaming', () => {
  afterEach(() => {
    window.getSelection()?.removeAllRanges();
    vi.restoreAllMocks();
  });
  it('allows a running source, preserves the selection after failure and retries it', async () => {
    const ask = vi
      .fn()
      .mockRejectedValueOnce(new Error('No completed reply yet'))
      .mockResolvedValue(undefined);
    function Harness() {
      const viewportRef = React.useRef<HTMLDivElement>(null);
      const composerInputRef = React.useRef<HTMLDivElement>(null);
      const stream = {
        threadId: 'source',
        isLoading: true,
      } as StreamContextType;
      const workbench = {
        ...disabledWorkbenchContext,
        sideChatEnabled: true,
        askInSideChat: ask,
      };
      const { t } = useChatkitTranslation();
      const quotes = useChatQuotes({
        surface: 'main',
        stream,
        workbench,
        viewportRef,
        composerInputRef,
        messages: [],
        setReferences: vi.fn(),
      });
      return (
        <>
          <div ref={viewportRef}>
            <p data-quote-message-id="reply">Earlier answer</p>
          </div>
          <ChatQuoteActions
            {...quotes}
            stream={stream}
            workbench={workbench}
            t={t}
          />
        </>
      );
    }
    render(
      <ThemeProvider>
        <Harness />
      </ThemeProvider>,
    );
    const text = screen.getByText('Earlier answer');
    const range = document.createRange();
    range.selectNodeContents(text);
    range.getBoundingClientRect = () => new DOMRect(20, 20, 100, 20);
    act(() => {
      window.getSelection()?.addRange(range);
      document.dispatchEvent(new Event('selectionchange'));
    });
    const button = screen.getByRole('button', { name: 'Ask in side chat' });
    expect(button).toBeEnabled();
    fireEvent.click(button);
    await screen.findByText('No completed reply yet');
    fireEvent.click(button);
    await waitFor(() => expect(ask).toHaveBeenCalledTimes(2));
    expect(ask.mock.calls[0]).toEqual([
      { type: 'quote', messageId: 'reply', text: 'Earlier answer' },
    ]);
    expect(ask.mock.calls[1]).toEqual(ask.mock.calls[0]);
  });
});
