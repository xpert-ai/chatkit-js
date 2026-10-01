import * as React from 'react';
import { mergeReferences } from '../../../lib/references';
import type { useStreamContext } from '../../../providers/Stream';
import type { useChatDraft } from '../composer/useChatDraft';
import type { useChatFiles } from '../files/useChatFiles';
import type { useChatEnvironment } from '../session/useChatEnvironment';
import {
  getClosestQuoteContainer,
  type QuoteSelectionState,
} from './quote-selection';

type ChatQuotesOptions = Pick<
  ReturnType<typeof useChatEnvironment>,
  'stream' | 'workbench'
> &
  Pick<ReturnType<typeof useChatFiles>, 'setReferences'> &
  Pick<ReturnType<typeof useChatDraft>, 'composerInputRef'> & {
    surface: 'main' | 'side';
    viewportRef: React.RefObject<HTMLDivElement | null>;
    messages: ReturnType<typeof useStreamContext>['messages'];
  };

export function useChatQuotes({
  surface,
  viewportRef,
  messages,
  stream,
  setReferences,
  composerInputRef,
  workbench,
}: ChatQuotesOptions) {
  const [quoteSelection, setQuoteSelection] =
    React.useState<QuoteSelectionState | null>(null);

  const [isOpeningSideChat, setIsOpeningSideChat] = React.useState(false);
  const [sideChatError, setSideChatError] = React.useState<string | null>(null);
  const clearQuoteSelection = React.useCallback(() => {
    setQuoteSelection(null);
  }, []);

  const syncQuoteSelection = React.useCallback(() => {
    if (surface !== 'main') {
      clearQuoteSelection();
      return;
    }
    if (typeof window === 'undefined') {
      clearQuoteSelection();
      return;
    }

    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || selection.rangeCount === 0) {
      clearQuoteSelection();
      return;
    }

    const text = selection.toString().trim();
    if (!text) {
      clearQuoteSelection();
      return;
    }

    const anchorContainer = getClosestQuoteContainer(selection.anchorNode);
    const focusContainer = getClosestQuoteContainer(selection.focusNode);
    if (
      !anchorContainer ||
      !focusContainer ||
      anchorContainer !== focusContainer ||
      !viewportRef.current?.contains(anchorContainer)
    ) {
      clearQuoteSelection();
      return;
    }

    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) {
      clearQuoteSelection();
      return;
    }

    const top =
      rect.bottom + 8 > window.innerHeight - 48
        ? Math.max(12, rect.top - 44)
        : rect.bottom + 8;
    const left = Math.min(
      Math.max(24, rect.left + rect.width / 2),
      window.innerWidth - 24,
    );
    const source = anchorContainer.dataset.quoteSource?.trim() || undefined;
    const messageId =
      anchorContainer.dataset.quoteMessageId?.trim() || undefined;

    setQuoteSelection({
      reference: {
        type: 'quote',
        text,
        ...(messageId ? { messageId } : {}),
        ...(source ? { source, label: source } : {}),
      },
      top,
      left,
    });
  }, [clearQuoteSelection, surface]);

  React.useEffect(() => {
    document.addEventListener('selectionchange', syncQuoteSelection);

    return () => {
      document.removeEventListener('selectionchange', syncQuoteSelection);
    };
  }, [syncQuoteSelection]);

  React.useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) {
      return;
    }

    const handleViewportScroll = () => {
      clearQuoteSelection();
    };

    viewport.addEventListener('scroll', handleViewportScroll, {
      passive: true,
    });
    window.addEventListener('resize', handleViewportScroll, { passive: true });

    return () => {
      viewport.removeEventListener('scroll', handleViewportScroll);
      window.removeEventListener('resize', handleViewportScroll);
    };
  }, [clearQuoteSelection]);

  React.useEffect(() => {
    clearQuoteSelection();
  }, [messages.length, stream.threadId, clearQuoteSelection]);

  const handleQuoteSelection = React.useCallback(() => {
    if (!quoteSelection) {
      return;
    }

    setReferences((previous) =>
      mergeReferences(previous, [quoteSelection.reference]),
    );
    clearQuoteSelection();
    if (typeof window !== 'undefined') {
      window.getSelection()?.removeAllRanges();
    }
    composerInputRef.current?.focus();
  }, [clearQuoteSelection, quoteSelection]);

  const handleAskInSideChat = React.useCallback(async () => {
    if (
      !quoteSelection ||
      !workbench.sideChatEnabled ||
      !stream.threadId ||
      stream.isLoading
    )
      return;
    setIsOpeningSideChat(true);
    setSideChatError(null);
    try {
      await workbench.askInSideChat(quoteSelection.reference);
      clearQuoteSelection();
      window.getSelection()?.removeAllRanges();
    } catch (error) {
      setSideChatError(error instanceof Error ? error.message : String(error));
    } finally {
      setIsOpeningSideChat(false);
    }
  }, [
    clearQuoteSelection,
    quoteSelection,
    stream.isLoading,
    stream.threadId,
    workbench,
  ]);
  return {
    clearQuoteSelection,
    quoteSelection,
    handleQuoteSelection,
    isOpeningSideChat,
    handleAskInSideChat,
    sideChatError,
  };
}
