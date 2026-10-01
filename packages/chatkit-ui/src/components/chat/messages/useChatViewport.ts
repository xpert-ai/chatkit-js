import * as React from 'react';
import {
  buildMessageNavigationItems,
  MESSAGE_NAVIGATION_MIN_ITEMS,
  type MessageNavigationItem,
  type MessageNavigationLabels,
  type MessageNavigationSourceMessage,
} from '../../../lib/message-navigation';
import { isNearBottom } from '../../../lib/scroll';
import type { useStreamContext } from '../../../providers/Stream';
import type { useChatAssistant } from '../session/useChatAssistant';
import type { useChatEnvironment } from '../session/useChatEnvironment';
import type { useChatQuotes } from './useChatQuotes';

type ChatViewportOptions = Pick<
  ReturnType<typeof useChatEnvironment>,
  't' | 'messageNavigationEnabled' | 'i18n' | 'stream' | 'setHistoryError'
> &
  Pick<ReturnType<typeof useChatAssistant>, 'assistantTitle'> &
  Pick<ReturnType<typeof useChatQuotes>, 'clearQuoteSelection'> & {
    messages: ReturnType<typeof useStreamContext>['messages'];
    viewportRef: React.RefObject<HTMLDivElement | null>;
  };

export function useChatViewport({
  t,
  assistantTitle,
  messageNavigationEnabled,
  messages,
  i18n,
  stream,
  viewportRef,
  clearQuoteSelection,
  setHistoryError,
}: ChatViewportOptions) {
  const [isAtBottom, setIsAtBottom] = React.useState(true);
  const [hasUpdatesBelow, setHasUpdatesBelow] = React.useState(false);
  const messageNavigationAnchorsRef = React.useRef(
    new Map<string, HTMLDivElement>(),
  );

  const shouldAutoScrollRef = React.useRef(true);
  const forceFollowRef = React.useRef(false);
  const previousMessageCountRef = React.useRef(0);
  const previousScrollTopRef = React.useRef(0);
  const isPrependingHistoryMessagesRef = React.useRef(false);
  const autoScrollFrameRef = React.useRef<number | null>(null);
  const isPointerDownRef = React.useRef(false);
  const lastTouchYRef = React.useRef<number | null>(null);
  const messageNavigationLabels = React.useMemo<MessageNavigationLabels>(
    () => ({
      user: t('chat.youLabel'),
      assistant: assistantTitle,
      system: t('message.navigation.system'),
      tool: t('message.navigation.tool'),
      event: t('message.navigation.event'),
      message: t('message.navigation.message'),
      image: t('message.navigation.image'),
      memory: t('message.navigation.memory'),
      widget: t('message.navigation.widget'),
      mcpApp: t('message.navigation.mcpApp'),
      attachment: t('message.navigation.attachment'),
      reference: t('message.navigation.reference'),
      capability: t('message.navigation.capability'),
      reasoning: t('message.reasoning'),
    }),
    [assistantTitle, t],
  );

  const messageNavigationItems = React.useMemo(
    () =>
      messageNavigationEnabled
        ? buildMessageNavigationItems(
            messages as MessageNavigationSourceMessage[],
            {
              labels: messageNavigationLabels,
              language: i18n.language,
              assistantTitle,
            },
          )
        : [],
    [
      assistantTitle,
      i18n.language,
      messageNavigationEnabled,
      messageNavigationLabels,
      messages,
    ],
  );

  const showMessageNavigation =
    messageNavigationItems.length >= MESSAGE_NAVIGATION_MIN_ITEMS;

  const historyMessagePagination = stream.historyMessagePagination;
  const isLoadingMoreMessages = Boolean(
    historyMessagePagination?.isLoadingMore,
  );

  const canLoadMoreMessages = Boolean(historyMessagePagination?.hasMore);
  const cancelPendingAutoScroll = React.useCallback(() => {
    if (autoScrollFrameRef.current !== null) {
      cancelAnimationFrame(autoScrollFrameRef.current);
      autoScrollFrameRef.current = null;
    }
  }, []);

  const disableAutoFollow = React.useCallback(() => {
    forceFollowRef.current = false;
    shouldAutoScrollRef.current = false;
    cancelPendingAutoScroll();
  }, [cancelPendingAutoScroll]);

  const enableAutoFollow = React.useCallback(() => {
    forceFollowRef.current = true;
    shouldAutoScrollRef.current = true;
    setHasUpdatesBelow(false);
  }, []);

  const scrollToBottom = React.useCallback(
    (smooth = false, force = false) => {
      if (force) {
        enableAutoFollow();
      }

      cancelPendingAutoScroll();

      // Use requestAnimationFrame to ensure DOM has updated
      autoScrollFrameRef.current = requestAnimationFrame(() => {
        autoScrollFrameRef.current = null;

        const viewport = viewportRef.current;
        if (viewport) {
          if (!force && !shouldAutoScrollRef.current) {
            return;
          }

          const top = viewport.scrollHeight;

          if (typeof viewport.scrollTo === 'function') {
            viewport.scrollTo({
              top,
              behavior: smooth ? 'smooth' : 'instant',
            });
          } else {
            viewport.scrollTop = top;
          }
        }
      });
    },
    [cancelPendingAutoScroll, enableAutoFollow],
  );

  const setMessageNavigationAnchor = React.useCallback(
    (id: string, node: HTMLDivElement | null) => {
      if (node) {
        messageNavigationAnchorsRef.current.set(id, node);
        return;
      }
      messageNavigationAnchorsRef.current.delete(id);
    },
    [],
  );

  const getMessageNavigationAnchor = React.useCallback(
    (item: MessageNavigationItem) =>
      messageNavigationAnchorsRef.current.get(item.id) ?? null,
    [],
  );

  const handleMessageNavigationNavigate = React.useCallback(() => {
    disableAutoFollow();
    clearQuoteSelection();
  }, [clearQuoteSelection, disableAutoFollow]);

  React.useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    previousScrollTopRef.current = viewport.scrollTop;
    const stopPointerTracking = () => {
      isPointerDownRef.current = false;
    };

    const updateAutoScrollState = () => {
      const nextScrollTop = viewport.scrollTop;
      const isScrollingUp = nextScrollTop < previousScrollTopRef.current - 1;
      previousScrollTopRef.current = nextScrollTop;
      const nearBottom = isNearBottom(viewport);
      setIsAtBottom(nearBottom);

      if (nearBottom) {
        shouldAutoScrollRef.current = true;
        setHasUpdatesBelow(false);
        return;
      }

      if (forceFollowRef.current) {
        shouldAutoScrollRef.current = true;
        return;
      }

      if (isPointerDownRef.current && isScrollingUp) {
        disableAutoFollow();
        return;
      }

      shouldAutoScrollRef.current = false;
    };

    const handleWheel = (event: WheelEvent) => {
      if (event.deltaY < 0) {
        disableAutoFollow();
      }
    };

    const handlePointerDown = () => {
      isPointerDownRef.current = true;
    };

    const handleTouchStart = (event: TouchEvent) => {
      lastTouchYRef.current = event.touches[0]?.clientY ?? null;
    };

    const handleTouchMove = (event: TouchEvent) => {
      const nextTouchY = event.touches[0]?.clientY;
      if (typeof nextTouchY !== 'number') return;

      if (
        lastTouchYRef.current !== null &&
        nextTouchY > lastTouchYRef.current + 1
      ) {
        disableAutoFollow();
      }

      lastTouchYRef.current = nextTouchY;
    };

    const handleTouchEnd = () => {
      lastTouchYRef.current = null;
    };

    updateAutoScrollState();
    viewport.addEventListener('wheel', handleWheel, { passive: true });
    viewport.addEventListener('pointerdown', handlePointerDown, {
      passive: true,
    });
    viewport.addEventListener('scroll', updateAutoScrollState, {
      passive: true,
    });
    viewport.addEventListener('touchstart', handleTouchStart, {
      passive: true,
    });
    viewport.addEventListener('touchmove', handleTouchMove, { passive: true });
    viewport.addEventListener('touchend', handleTouchEnd, { passive: true });
    window.addEventListener('pointerup', stopPointerTracking, {
      passive: true,
    });
    window.addEventListener('pointercancel', stopPointerTracking, {
      passive: true,
    });

    return () => {
      cancelPendingAutoScroll();
      viewport.removeEventListener('wheel', handleWheel);
      viewport.removeEventListener('pointerdown', handlePointerDown);
      viewport.removeEventListener('scroll', updateAutoScrollState);
      viewport.removeEventListener('touchstart', handleTouchStart);
      viewport.removeEventListener('touchmove', handleTouchMove);
      viewport.removeEventListener('touchend', handleTouchEnd);
      window.removeEventListener('pointerup', stopPointerTracking);
      window.removeEventListener('pointercancel', stopPointerTracking);
    };
  }, [cancelPendingAutoScroll, disableAutoFollow]);

  React.useEffect(() => {
    shouldAutoScrollRef.current = true;
    forceFollowRef.current = false;
    previousScrollTopRef.current = 0;
    setIsAtBottom(true);
    setHasUpdatesBelow(false);
  }, [stream.threadId]);

  React.useEffect(() => {
    const messageCountChanged =
      messages.length !== previousMessageCountRef.current;
    previousMessageCountRef.current = messages.length;

    if (isPrependingHistoryMessagesRef.current) {
      setHasUpdatesBelow(false);
      return;
    }

    if (!shouldAutoScrollRef.current) {
      if (messageCountChanged || stream.isLoading) {
        setHasUpdatesBelow(true);
      }
      return;
    }

    if (messageCountChanged || stream.isLoading) {
      scrollToBottom();
    }
  }, [stream.isLoading, messages, scrollToBottom]);

  const handleLoadMoreMessages = React.useCallback(async () => {
    if (!canLoadMoreMessages || isLoadingMoreMessages) {
      return;
    }

    const viewport = viewportRef.current;
    const previousScrollHeight = viewport?.scrollHeight ?? 0;
    const previousScrollTop = viewport?.scrollTop ?? 0;

    isPrependingHistoryMessagesRef.current = true;
    shouldAutoScrollRef.current = false;
    forceFollowRef.current = false;
    setHasUpdatesBelow(false);
    setHistoryError(null);

    const restoreScrollPosition = () => {
      requestAnimationFrame(() => {
        const nextViewport = viewportRef.current;
        if (nextViewport) {
          const nextScrollTop =
            nextViewport.scrollHeight -
            previousScrollHeight +
            previousScrollTop;
          nextViewport.scrollTop = Math.max(0, nextScrollTop);
          previousScrollTopRef.current = nextViewport.scrollTop;
        }
        isPrependingHistoryMessagesRef.current = false;
      });
    };

    try {
      await stream.loadMoreConversationMessages();
      restoreScrollPosition();
    } catch (err) {
      isPrependingHistoryMessagesRef.current = false;
      console.warn('Failed to load more thread messages', err);
      setHistoryError(
        err instanceof Error ? err.message : t('chat.errors.loadMessages'),
      );
    }
  }, [canLoadMoreMessages, isLoadingMoreMessages, stream, t]);
  return {
    canLoadMoreMessages,
    messageNavigationAnchorsRef,
    disableAutoFollow,
    scrollToBottom,
    showMessageNavigation,
    messageNavigationItems,
    getMessageNavigationAnchor,
    handleMessageNavigationNavigate,
    isLoadingMoreMessages,
    handleLoadMoreMessages,
    setMessageNavigationAnchor,
    isAtBottom,
    hasUpdatesBelow,
  };
}
