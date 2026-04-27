import * as React from 'react';
import {
  ArrowDown,
  FileText,
  ImageIcon,
  Loader2,
  Pencil,
  Quote,
  RefreshCw,
  X,
} from 'lucide-react';

import type { Message } from '@xpert-ai/xpert-sdk';
import type {
  ChatkitMessage,
  ChatKitImageReference,
  ChatKitOptions,
  ChatKitReference,
  ChatKitReferenceCompositionMode,
  FollowUpBehavior,
  ToolOption,
} from '@xpert-ai/chatkit-types';

import { cn, createMessageId, getRoundedClass } from '../lib/utils';
import {
  getAssistantStreamingStatus,
  hasRenderableAssistantMessage,
} from '../lib/message';
import { isNearBottom } from '../lib/scroll';
import { type StorageFile, type UploadingFile } from '../lib/types';
import { useStreamContext } from '../providers/Stream';
import { ComposerMenu } from './composer/ComposerMenu';
import { SendButton } from './composer/SendButton';
import { HistorySidebar } from './history/HistorySidebar';
import { PendingFollowUps } from './composer/pending-follow-ups';
import { PendingTodos } from './composer/pending-todos';
import {
  AssistantMessage,
  AssistantStreamingIndicator,
} from './thread/messages/ai';
import { MessageActions } from './thread/MessageActions';
import { StartScreen } from './thread/StartScreen';
import {
  ChatkitAvatar,
  type ChatkitAvatarData,
  extractAssistantAvatar,
} from './ui/chatkit-avatar';
import { useStreamManager } from '../hooks/useStream';
import { useThreads } from '../hooks/useThreads';
import { useChatkitTranslation } from '../i18n/useChatkitTranslation';
import { ContextUsageIndicator } from './thread/context-usage-indicator';
import { Button } from './ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip';
import { buildInjectedRequestOptions } from '../lib/request-options';
import {
  buildHumanMessageInputPayload,
  getReferenceKey,
  getReferenceLabel,
  getReferenceMetaLine,
  getReferenceTitle,
  mergeReferences,
  normalizeReferences,
  type ComposerValuePayload,
} from '../lib/references';
import { getMissingApiConfigurationKind } from '../lib/api-config';
import {
  getBusyComposerShortcutFollowUpMode,
  getComposerFollowUpShortcutLabels,
} from '../lib/follow-ups';
import { useTheme } from '../providers/Theme';
import { useParentMessenger } from '../hooks/useParentMessenger';

export type ChatProps = {
  className?: string;
  title?: string;
  placeholder?: string;
  clientSecret?: string;
  options?: ChatKitOptions | null;
  isClientSecretInitializing?: boolean;
};

const defaultApiUrl = import.meta.env.VITE_XPERTAI_API_URL as
  | string
  | undefined;
const COMPOSER_INPUT_MAX_HEIGHT = 128;
const LONG_TEXT_REFERENCE_THRESHOLD = 5000;

type UploadedMessageFile = {
  originalName: string;
  mimetype: string;
};

type HumanMessageWithMeta = Message & {
  attachments?: UploadedMessageFile[];
  references?: ChatKitReference[];
  submittedInput?: string;
  referenceComposition?: ChatKitReferenceCompositionMode;
};

type QuoteSelectionState = {
  reference: ChatKitReference;
  top: number;
  left: number;
};

async function readImageDimensions(file: File): Promise<{
  width?: number;
  height?: number;
}> {
  if (typeof window === 'undefined' || typeof URL === 'undefined') {
    return {};
  }

  return new Promise((resolve) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new window.Image();

    const cleanup = () => {
      URL.revokeObjectURL(objectUrl);
    };

    image.onload = () => {
      resolve({
        width: image.naturalWidth || undefined,
        height: image.naturalHeight || undefined,
      });
      cleanup();
    };
    image.onerror = () => {
      resolve({});
      cleanup();
    };
    image.src = objectUrl;
  });
}

function getStorageFileUrl(file: StorageFile): string | undefined {
  return file.url ?? file.fileUrl ?? file.thumbUrl;
}

function buildPastedImageReference(
  file: File,
  storageFile: StorageFile,
  dimensions?: { width?: number; height?: number },
): ChatKitImageReference {
  const name =
    storageFile.originalName?.trim() || file.name.trim() || 'Pasted image';
  const mimeType =
    storageFile.mimetype?.trim() || file.type.trim() || 'image/*';
  const size = storageFile.size ?? file.size;
  const width = dimensions?.width;
  const height = dimensions?.height;
  const metaParts = [
    mimeType,
    width && height ? `${width}x${height}` : null,
    typeof size === 'number' ? `${size} bytes` : null,
  ].filter((part): part is string => Boolean(part));

  return {
    type: 'image',
    id: storageFile.id,
    fileId: storageFile.id,
    url: getStorageFileUrl(storageFile),
    mimeType,
    name,
    ...(typeof size === 'number' ? { size } : {}),
    ...(width ? { width } : {}),
    ...(height ? { height } : {}),
    text: `Pasted image${metaParts.length ? ` (${metaParts.join(', ')})` : ''}: ${name}`,
  };
}

function formatMessageContent(content: Message['content'][number]): string {
  if (typeof content === 'string') {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === 'string') return part;
        if (part && typeof part === 'object' && 'text' in part) {
          const textValue = (part as { text?: unknown }).text;
          return typeof textValue === 'string' ? textValue : '';
        }
        return '';
      })
      .join('');
  }

  if (content == null) return '';

  // Handle object with text property (e.g., {"type":"text","text":"..."})
  if (typeof content === 'object' && 'text' in content) {
    const textValue = (content as { text?: unknown }).text;
    return typeof textValue === 'string' ? textValue : '';
  }

  return '';
}

function getClosestQuoteContainer(node: Node | null): HTMLElement | null {
  if (!node) {
    return null;
  }

  const element =
    node instanceof HTMLElement
      ? node
      : node instanceof Text
        ? node.parentElement
        : null;

  return element?.closest('[data-quote-message-id]') ?? null;
}

function ReferenceChip({
  reference,
  variant,
  onRemove,
  removeLabel,
}: {
  reference: ChatKitReference;
  variant: 'composer' | 'message';
  onRemove?: () => void;
  removeLabel?: string;
}) {
  const metaLine = getReferenceMetaLine(reference);
  const isComposer = variant === 'composer';
  const Icon =
    reference.type === 'quote'
      ? Quote
      : reference.type === 'image'
        ? ImageIcon
        : FileText;

  return (
    <div
      className={cn(
        'flex items-start gap-2 rounded-md px-2 py-1',
        isComposer ? 'bg-muted text-foreground' : 'bg-primary-foreground/20',
      )}
      title={getReferenceTitle(reference)}
    >
      <Icon
        size={isComposer ? 14 : 12}
        className={cn(
          'mt-0.5 shrink-0',
          isComposer ? 'text-muted-foreground' : 'text-primary-foreground/80',
        )}
      />
      <div className="min-w-0 flex-1">
        <div
          className={cn(
            'truncate whitespace-pre-wrap',
            isComposer ? 'text-sm' : 'text-xs font-medium',
          )}
        >
          {getReferenceLabel(reference)}
        </div>
        {metaLine && (
          <div
            className={cn(
              'truncate whitespace-pre-wrap',
              isComposer
                ? 'text-xs text-muted-foreground'
                : 'text-[10px] text-primary-foreground/75',
            )}
          >
            {metaLine}
          </div>
        )}
      </div>
      {onRemove && removeLabel && (
        <button
          type="button"
          onClick={onRemove}
          className={cn(
            'ml-1 rounded-full p-0.5',
            isComposer
              ? 'hover:bg-muted-foreground/20'
              : 'hover:bg-primary-foreground/20',
          )}
          title={removeLabel}
          aria-label={removeLabel}
        >
          <X size={12} />
        </button>
      )}
    </div>
  );
}

export function Chat({
  className,
  options,
  title,
  placeholder,
  clientSecret = '',
  isClientSecretInitializing = false,
}: ChatProps) {
  const { t } = useChatkitTranslation();
  const composer = options?.composer;
  const startScreen = options?.startScreen;
  const history = options?.history;
  const disclaimer = options?.disclaimer;
  const apiUrl = options?.api?.apiUrl || defaultApiUrl;
  const { setStream } = useStreamManager();
  const stream = useStreamContext();
  const { theme } = useTheme();

  const [isHistoryLoading, setIsHistoryLoading] = React.useState(false);
  const [historyError, setHistoryError] = React.useState<string | null>(null);
  const [assistantName, setAssistantName] = React.useState<string | null>(null);
  const [assistantAvatar, setAssistantAvatar] =
    React.useState<ChatkitAvatarData | null>(null);

  // Minimum loading dots display time (ms)
  const LOADING_DOTS_MIN_DURATION = 800;
  const STREAMING_STATUS_REFRESH_MS = 250;
  const [showLoadingDots, setShowLoadingDots] = React.useState(false);
  const [streamingNow, setStreamingNow] = React.useState(() => Date.now());
  const loadingStartTimeRef = React.useRef<number | null>(null);
  const lastStreamOutputAtRef = React.useRef<number | null>(null);

  React.useEffect(() => {
    setStream(stream);
  }, [setStream, stream]);

  // Handle loading dots with minimum display time
  React.useEffect(() => {
    if (stream.isLoading) {
      // Start showing loading dots
      if (!loadingStartTimeRef.current) {
        loadingStartTimeRef.current = Date.now();
        setShowLoadingDots(true);
      }
    } else {
      // Loading finished - check if we need to keep dots visible
      if (loadingStartTimeRef.current) {
        const elapsed = Date.now() - loadingStartTimeRef.current;
        const remaining = LOADING_DOTS_MIN_DURATION - elapsed;

        if (remaining > 0) {
          // Keep dots visible for remaining time
          const timer = setTimeout(() => {
            setShowLoadingDots(false);
            loadingStartTimeRef.current = null;
          }, remaining);
          return () => clearTimeout(timer);
        } else {
          // Minimum time already passed
          setShowLoadingDots(false);
          loadingStartTimeRef.current = null;
        }
      }
    }
  }, [stream.isLoading]);

  React.useEffect(() => {
    if (!stream.isLoading) {
      lastStreamOutputAtRef.current = null;
      setStreamingNow(Date.now());
      return;
    }

    const now = Date.now();
    lastStreamOutputAtRef.current = now;
    setStreamingNow(now);
  }, [stream.messages, stream.isLoading]);

  React.useEffect(() => {
    if (!stream.isLoading) {
      return;
    }

    const timer = window.setInterval(() => {
      setStreamingNow(Date.now());
    }, STREAMING_STATUS_REFRESH_MS);

    return () => window.clearInterval(timer);
  }, [stream.isLoading]);

  const [draft, setDraft] = React.useState('');
  const [selectedTool, setSelectedTool] = React.useState<ToolOption | null>(
    null,
  );
  const [attachments, setAttachments] = React.useState<UploadingFile[]>([]);
  const [references, setReferences] = React.useState<ChatKitReference[]>([]);
  const [isUploadingReferenceImages, setIsUploadingReferenceImages] =
    React.useState(false);
  const [quoteSelection, setQuoteSelection] =
    React.useState<QuoteSelectionState | null>(null);
  const [isAtBottom, setIsAtBottom] = React.useState(true);
  const [hasUpdatesBelow, setHasUpdatesBelow] = React.useState(false);
  const {
    threads,
    deleteThread,
    refreshThreads,
    isLoading: isThreadsLoading,
  } = useThreads();
  const viewportRef = React.useRef<HTMLDivElement>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const composerInputRef = React.useRef<HTMLTextAreaElement>(null);
  const shouldAutoScrollRef = React.useRef(true);
  const forceFollowRef = React.useRef(false);
  const previousMessageCountRef = React.useRef(0);
  const previousScrollTopRef = React.useRef(0);
  const autoScrollFrameRef = React.useRef<number | null>(null);
  const isPointerDownRef = React.useRef(false);
  const lastTouchYRef = React.useRef<number | null>(null);

  const resolvedTitle = title ?? t('chat.title');
  const resolvedPlaceholder = placeholder ?? t('chat.placeholder');

  // Use placeholder from composer options or fallback to prop/i18n
  const inputPlaceholder =
    selectedTool?.placeholderOverride ??
    composer?.placeholder ??
    resolvedPlaceholder;

  const messages = React.useMemo(
    () => stream.messages ?? [],
    [stream.messages],
  );
  const trimmedDraft = draft.trim();
  const hasReferences = references.length > 0;
  const pendingFollowUps = React.useMemo(
    () =>
      [...(stream.pendingFollowUps ?? [])].sort(
        (a, b) => a.createdAt - b.createdAt,
      ),
    [stream.pendingFollowUps],
  );
  const hasPendingFollowUps = pendingFollowUps.length > 0;

  const clearQuoteSelection = React.useCallback(() => {
    setQuoteSelection(null);
  }, []);

  useParentMessenger({
    onSetComposerValue: React.useCallback(
      (payload: ComposerValuePayload | null) => {
        if (!payload) {
          return;
        }

        if (typeof payload.text === 'string') {
          setDraft(payload.text);
        }

        if (Array.isArray(payload.references)) {
          const nextReferences = normalizeReferences(payload.references);
          setReferences((previous) =>
            payload.appendReferences
              ? mergeReferences(previous, nextReferences)
              : nextReferences,
          );
        }

        if (payload.selectedToolId !== undefined) {
          const nextTool =
            payload.selectedToolId === null
              ? null
              : ((composer?.tools ?? []).find(
                  (tool) => tool.id === payload.selectedToolId,
                ) ?? null);
          setSelectedTool(nextTool);
        }
      },
      [composer?.tools],
    ),
    onFocusComposer: React.useCallback(() => {
      composerInputRef.current?.focus();
    }, []),
  });

  const syncQuoteSelection = React.useCallback(() => {
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
  }, [clearQuoteSelection]);

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

          viewport.scrollTo({
            top: viewport.scrollHeight,
            behavior: smooth ? 'smooth' : 'instant',
          });
        }
      });
    },
    [cancelPendingAutoScroll, enableAutoFollow],
  );

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

  const effectiveClientSecret = stream.apiKey?.trim()
    ? stream.apiKey
    : clientSecret;
  const missingConfigKind = getMissingApiConfigurationKind({
    apiUrl,
    clientSecret: effectiveClientSecret,
  });
  const missingConfig = Boolean(missingConfigKind);
  const missingConfigShortMessage = React.useMemo(() => {
    switch (missingConfigKind) {
      case 'apiUrl':
        return t('chat.missingApiUrlShort');
      case 'clientSecret':
        return t('chat.missingClientSecretShort');
      case 'apiUrlAndClientSecret':
        return t('chat.missingApiUrlAndClientSecretShort');
      default:
        return t('chat.missingConfigShort');
    }
  }, [missingConfigKind, t]);
  const missingConfigDetailMessage = React.useMemo(() => {
    switch (missingConfigKind) {
      case 'apiUrl':
        return t('chat.missingApiUrlDetail');
      case 'clientSecret':
        return t('chat.missingClientSecretDetail');
      case 'apiUrlAndClientSecret':
        return t('chat.missingApiUrlAndClientSecretDetail');
      default:
        return t('chat.missingConfigDetail');
    }
  }, [missingConfigKind, t]);
  const showMissingConfig = !isClientSecretInitializing && missingConfig;
  // Check if any files are still uploading (moved up for use in isSendDisabled)
  const hasUploadingFiles = attachments.some((a) => a.status === 'uploading');
  const isSendDisabled =
    (!trimmedDraft && !hasReferences) ||
    missingConfig ||
    isHistoryLoading ||
    hasUploadingFiles ||
    isUploadingReferenceImages;

  const resizeComposerInput = React.useCallback(() => {
    const textarea = composerInputRef.current;
    if (!textarea) {
      return;
    }
    textarea.style.height = 'auto';
    const nextHeight = Math.min(
      textarea.scrollHeight,
      COMPOSER_INPUT_MAX_HEIGHT,
    );
    textarea.style.height = `${nextHeight}px`;
    textarea.style.overflowY =
      textarea.scrollHeight > COMPOSER_INPUT_MAX_HEIGHT ? 'auto' : 'hidden';
  }, []);

  React.useEffect(() => {
    resizeComposerInput();
  }, [draft, resizeComposerInput]);

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

  React.useEffect(() => {
    if (missingConfig) return;
    void refreshThreads();
  }, [missingConfig, refreshThreads]);

  // Fetch assistant name from API
  React.useEffect(() => {
    if (missingConfig || !stream.client || !stream.assistantId) {
      setAssistantName(null);
      setAssistantAvatar(null);
      return;
    }

    setAssistantName(null);
    setAssistantAvatar(null);

    let cancelled = false;
    stream.client.assistants
      .get(stream.assistantId)
      .then((assistant) => {
        if (cancelled || !assistant) return;
        const assistantTitle =
          typeof assistant.metadata?.title === 'string' &&
          assistant.metadata.title.trim()
            ? assistant.metadata.title
            : assistant.name;
        setAssistantName(assistantTitle);
        setAssistantAvatar(extractAssistantAvatar(assistant));
      })
      .catch((err) => {
        if (cancelled) return;
        setAssistantAvatar(null);
        console.warn('[Chat] Failed to load assistant info:', err);
      });

    return () => {
      cancelled = true;
    };
  }, [missingConfig, stream.client, stream.assistantId]);

  // Get successfully uploaded files (matching IStorageFile interface)
  const uploadedFiles = attachments
    .filter((a) => a.status === 'success' && a.storageFile)
    .map((a) => ({
      id: a.storageFile?.id,
      file: a.storageFile?.file,
      url: a.storageFile?.url,
      originalName: a.storageFile?.originalName ?? a.file.name,
      mimetype: a.storageFile?.mimetype ?? a.file.type,
      size: a.storageFile?.size ?? a.file.size,
    }));

  const submitDraft = React.useCallback(
    (followUpOverride?: FollowUpBehavior) => {
      if (isSendDisabled) return;

      const filesToSend =
        uploadedFiles.length > 0 ? [...uploadedFiles] : undefined;
      const referencesToSend =
        references.length > 0 ? [...references] : undefined;
      const nextFollowUpMode = stream.isLoading
        ? (followUpOverride ?? stream.followUpBehavior)
        : undefined;
      const humanInput = buildHumanMessageInputPayload({
        content: trimmedDraft,
        references: referencesToSend,
      });

      if (!humanInput) {
        return;
      }

      const displayContent =
        trimmedDraft ||
        (referencesToSend ? t('chat.referencedContentOnly') : '');
      const newMessage: HumanMessageWithMeta = {
        id: createMessageId(),
        type: 'human',
        content: displayContent,
        submittedInput: humanInput.input,
        ...(humanInput.referenceComposition
          ? { referenceComposition: humanInput.referenceComposition }
          : {}),
        ...(filesToSend ? { attachments: filesToSend } : {}),
        ...(referencesToSend ? { references: referencesToSend } : {}),
      };

      setDraft('');

      const inputPayload: {
        input: string;
        files?: typeof uploadedFiles;
        references?: ChatKitReference[];
        referenceComposition?: ChatKitReferenceCompositionMode;
      } = {
        ...humanInput,
      };
      if (filesToSend) {
        inputPayload.files = filesToSend;
      }

      const requestOptions = buildInjectedRequestOptions({
        defaults: options?.request,
        humanInput: inputPayload,
      });

      stream.submit(
        {
          input: inputPayload,
          ...(requestOptions.state ? { state: requestOptions.state } : {}),
        },
        {
          ...(nextFollowUpMode ? { followUpMode: nextFollowUpMode } : {}),
          ...(requestOptions.context
            ? { context: requestOptions.context }
            : {}),
          ...(requestOptions.config ? { config: requestOptions.config } : {}),
          ...(!nextFollowUpMode
            ? {
                optimisticValues: (prev) => {
                  const prevMessages = prev?.messages ?? [];
                  return { ...prev, messages: [...prevMessages, newMessage] };
                },
              }
            : {}),
        },
      );

      scrollToBottom(true, true);

      if (selectedTool && !selectedTool.pinned) {
        setSelectedTool(null);
      }
      setAttachments([]);
      setReferences([]);
    },
    [
      isSendDisabled,
      options?.request,
      references,
      scrollToBottom,
      selectedTool,
      stream,
      trimmedDraft,
      uploadedFiles,
      t,
    ],
  );

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    submitDraft();
  };

  const handleEditPendingFollowUp = React.useCallback(
    (id: string) => {
      const item = pendingFollowUps.find(
        (entry) => entry.id === id && entry.mode === 'queue',
      );
      if (!item) {
        return;
      }

      const text = item.request?.input?.input?.trim() ?? '';
      const nextReferences = normalizeReferences(
        item.request?.input?.references,
      );
      stream.removePendingFollowUp(id);
      setDraft(text);
      setReferences(nextReferences);

      requestAnimationFrame(() => {
        const input = composerInputRef.current;
        if (!input) {
          return;
        }

        input.focus();
        const position = text.length;
        input.setSelectionRange(position, position);
      });
    },
    [pendingFollowUps, stream],
  );

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

  const handleAttachmentClick = () => {
    fileInputRef.current?.click();
  };

  const uploadContextFile = React.useCallback(
    (file: File) => stream.client.contexts.uploadFile<StorageFile>(file),
    [stream.client],
  );

  const handleComposerKeyDown = (
    event: React.KeyboardEvent<HTMLTextAreaElement>,
  ) => {
    if (event.key !== 'Enter') {
      return;
    }
    if (event.shiftKey) {
      return;
    }
    if (event.nativeEvent.isComposing) {
      return;
    }
    event.preventDefault();
    if (isSendDisabled) {
      return;
    }

    if (stream.isLoading) {
      submitDraft(
        getBusyComposerShortcutFollowUpMode(event.metaKey || event.ctrlKey),
      );
      return;
    }

    submitDraft();
  };

  const handleComposerPaste = React.useCallback(
    (event: React.ClipboardEvent<HTMLTextAreaElement>) => {
      const clipboardData = event.clipboardData;
      if (!clipboardData) {
        return;
      }

      const imageFiles = Array.from(clipboardData.items)
        .filter(
          (item) => item.kind === 'file' && item.type.startsWith('image/'),
        )
        .map((item) => item.getAsFile())
        .filter((item): item is File => Boolean(item));

      if (imageFiles.length > 0) {
        event.preventDefault();

        const maxCount = composer?.attachments?.maxCount ?? 10;
        const maxSize = composer?.attachments?.maxSize ?? 100 * 1024 * 1024;
        const currentImageReferenceCount = references.filter(
          (reference) => reference.type === 'image',
        ).length;
        const availableSlots = Math.max(
          0,
          maxCount - currentImageReferenceCount,
        );
        const nextFiles = imageFiles
          .filter((file) => file.size <= maxSize)
          .slice(0, availableSlots);

        if (nextFiles.length === 0) {
          return;
        }

        setIsUploadingReferenceImages(true);
        void Promise.allSettled(
          nextFiles.map(async (file) => {
            const [dimensions, storageFile] = await Promise.all([
              readImageDimensions(file),
              uploadContextFile(file),
            ]);

            return buildPastedImageReference(file, storageFile, dimensions);
          }),
        )
          .then((results) => {
            const nextReferences = results
              .filter(
                (
                  result,
                ): result is PromiseFulfilledResult<ChatKitImageReference> =>
                  result.status === 'fulfilled',
              )
              .map((result) => result.value);

            if (nextReferences.length > 0) {
              setReferences((previous) =>
                mergeReferences(previous, nextReferences),
              );
              composerInputRef.current?.focus();
            }

            results
              .filter(
                (result): result is PromiseRejectedResult =>
                  result.status === 'rejected',
              )
              .forEach((result) => {
                console.warn(
                  '[Chat] Failed to upload pasted image reference:',
                  result.reason,
                );
              });
          })
          .finally(() => {
            setIsUploadingReferenceImages(false);
          });

        return;
      }

      const pastedText = clipboardData.getData('text/plain');
      if (pastedText.trim().length <= LONG_TEXT_REFERENCE_THRESHOLD) {
        return;
      }

      event.preventDefault();
      setReferences((previous) =>
        mergeReferences(previous, [
          {
            type: 'quote',
            source: 'Pasted text',
            text: pastedText,
          },
        ]),
      );
      composerInputRef.current?.focus();
    },
    [
      composer?.attachments?.maxCount,
      composer?.attachments?.maxSize,
      references,
      uploadContextFile,
    ],
  );

  const alternateFollowUpShortcutLabel = React.useMemo(() => {
    if (typeof navigator === 'undefined') {
      return '\u2318Enter';
    }

    const platform = navigator.platform || navigator.userAgent;
    return /Mac|iPhone|iPad|iPod/i.test(platform)
      ? '\u2318Enter'
      : 'Ctrl+Enter';
  }, []);

  const followUpShortcutLabels = React.useMemo(
    () => getComposerFollowUpShortcutLabels(alternateFollowUpShortcutLabel),
    [alternateFollowUpShortcutLabel],
  );

  // Upload a single file to the server
  const uploadFile = React.useCallback(
    async (localId: string, file: File) => {
      try {
        const result = await uploadContextFile(file);
        setAttachments((prev) =>
          prev.map((item) =>
            item.localId === localId
              ? { ...item, status: 'success' as const, storageFile: result }
              : item,
          ),
        );
      } catch (error) {
        setAttachments((prev) =>
          prev.map((item) =>
            item.localId === localId
              ? {
                  ...item,
                  status: 'error' as const,
                  error:
                    error instanceof Error ? error.message : 'Upload failed',
                }
              : item,
          ),
        );
      }
    },
    [uploadContextFile],
  );

  // Retry uploading a failed file
  const handleRetryUpload = React.useCallback(
    (localId: string) => {
      const attachment = attachments.find((a) => a.localId === localId);
      if (!attachment || attachment.status !== 'error') return;

      setAttachments((prev) =>
        prev.map((item) =>
          item.localId === localId
            ? { ...item, status: 'uploading' as const, error: undefined }
            : item,
        ),
      );
      void uploadFile(localId, attachment.file);
    },
    [attachments, uploadFile],
  );

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const maxCount = composer?.attachments?.maxCount ?? 10;
    const maxSize = composer?.attachments?.maxSize ?? 100 * 1024 * 1024; // 100MB default

    const newAttachments: UploadingFile[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file.size > maxSize) {
        console.warn(`File ${file.name} exceeds max size of ${maxSize} bytes`);
        continue;
      }
      const localId = createMessageId();
      newAttachments.push({
        localId,
        file,
        status: 'uploading',
      });
    }

    // Add new attachments and limit to maxCount
    setAttachments((prev) => {
      const combined = [...prev, ...newAttachments];
      return combined.slice(0, maxCount);
    });

    // Start uploading each file
    newAttachments.forEach((attachment) => {
      void uploadFile(attachment.localId, attachment.file);
    });

    // Reset the input so the same file can be selected again
    event.target.value = '';
  };

  const handleRemoveAttachment = async (localId: string) => {
    const attachment = attachments.find((a) => a.localId === localId);
    if (!attachment) return;

    // If file was uploaded successfully, delete from server
    if (attachment.status === 'success' && attachment.storageFile?.id) {
      try {
        await fetch(
          `${stream.apiUrl}/contexts/file/${attachment.storageFile.id}`,
          {
            method: 'DELETE',
            headers: {
              Authorization: `Bearer ${effectiveClientSecret}`,
            },
          },
        );
      } catch {
        // Still remove from local state even if server delete fails
      }
    }

    setAttachments((prev) => prev.filter((item) => item.localId !== localId));
  };

  const handleToolSelect = (tool: ToolOption) => {
    setSelectedTool((prev) => (prev?.id === tool.id ? null : tool));
  };

  const handlePromptClick = (prompt: string) => {
    if (missingConfig || isHistoryLoading) return;

    const newMessage: Message = {
      id: createMessageId(),
      type: 'human',
      content: prompt,
    };

    const nextFollowUpMode = stream.isLoading
      ? stream.followUpBehavior
      : undefined;

    stream.submit(
      { input: { input: prompt } },
      {
        ...(nextFollowUpMode ? { followUpMode: nextFollowUpMode } : {}),
        ...(!nextFollowUpMode
          ? {
              optimisticValues: (prev) => {
                const prevMessages = prev?.messages ?? [];
                return { ...prev, messages: [...prevMessages, newMessage] };
              },
            }
          : {}),
      },
    );

    // Scroll to bottom to show the new message
    scrollToBottom(true, true);
  };

  const loadConversationMessages = React.useCallback(
    async (recordId: string) => {
      if (missingConfig) {
        setHistoryError(missingConfigShortMessage);
        return;
      }
      setHistoryError(null);
      setIsHistoryLoading(true);
      try {
        await stream.loadConversationMessages(recordId);
        // setActiveThreadId(threadId ?? null);
      } catch (err) {
        console.warn('Failed to load thread messages', err);
        setHistoryError(
          err instanceof Error ? err.message : t('chat.errors.loadMessages'),
        );
      } finally {
        setIsHistoryLoading(false);
      }
    },
    [missingConfig, missingConfigShortMessage, stream, t],
  );

  const handleNewThread = async () => {
    if (missingConfig || isHistoryLoading) return;
    setHistoryError(null);
    try {
      // const created = await createThread({ title: t('history.newThreadTitle') });
      // setActiveThreadId(created.id);
      stream.reset(null, []);
      // await refreshThreads();
    } catch (err) {
      console.warn('Failed to create thread', err);
      setHistoryError(
        err instanceof Error ? err.message : t('chat.errors.createThread'),
      );
    }
  };

  const handleSelectThread = (id: string) => {
    if (isHistoryLoading) return;
    setHistoryError(null);
    const thread = threads.find((item) => item.id === id);
    if (!thread) return;
    if (id === stream.threadId) return;
    stream.reset(id, []);
    if (thread.recordId) {
      void loadConversationMessages(thread.recordId);
    }
  };

  const handleDeleteThread = (id: string) => {
    setHistoryError(null);
    const thread = threads.find((item) => item.id === id);
    if (!thread?.recordId) return;
    void deleteThread(thread.recordId)
      .then(() => {
        if (stream.threadId === id) {
          stream.reset(null, []);
        }
        return refreshThreads();
      })
      .catch((err) => {
        console.warn('Failed to delete thread', err);
        setHistoryError(
          err instanceof Error ? err.message : t('chat.errors.deleteThread'),
        );
      });
  };

  const handleRetry = (messageIndex: number) => {
    // Find the last human message before this AI message to resend
    const messagesUpToIndex = messages.slice(0, messageIndex);
    const lastHumanMessage = [...messagesUpToIndex]
      .reverse()
      .find((m) => String(m.type) === 'human') as
      | HumanMessageWithMeta
      | undefined;

    const humanInput = buildHumanMessageInputPayload({
      content:
        lastHumanMessage && typeof lastHumanMessage.content === 'string'
          ? lastHumanMessage.content
          : '',
      submittedInput: lastHumanMessage?.submittedInput,
      references: lastHumanMessage?.references,
      referenceComposition: lastHumanMessage?.referenceComposition,
    });

    if (humanInput) {
      stream.submit(
        { input: humanInput },
        {
          optimisticValues: (prev) => {
            // Remove the AI message that we're retrying
            const prevMessages = prev?.messages ?? [];
            return {
              ...prev,
              messages: prevMessages.slice(0, messageIndex),
            };
          },
        },
      );
      scrollToBottom(true, true);
    }
  };

  // Build accept string for file input
  const acceptMimes = composer?.attachments?.accept
    ? Object.entries(composer.attachments.accept)
        .map(([mime, exts]) => [mime, ...exts.map((e) => `.${e}`)].join(','))
        .join(',')
    : undefined;

  const currentThread = React.useMemo(
    () => threads.find((item) => item.id === stream.threadId),
    [threads, stream.threadId],
  );

  const errorMessage =
    stream.error instanceof Error ? stream.error.message : undefined;

  const threadErrorMessage = React.useMemo(() => {
    if (currentThread?.status !== 'error') return undefined;
    const message = currentThread.error?.trim();
    return message || t('thread.errorToast');
  }, [currentThread, t]);

  const assistantTitle = assistantName || resolvedTitle;

  return (
    <div
      ref={viewportRef}
      className={cn(
        'relative flex h-full w-full flex-col flex-1 overflow-y-auto bg-background shadow-sm',
        className,
      )}
    >
      <div className="flex items-center justify-between border-b p-2 sticky top-0 z-10 bg-background">
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="relative shrink-0">
            <ChatkitAvatar
              avatar={assistantAvatar}
              className="h-9 w-9 border border-border/60"
              label={assistantTitle}
            />
            <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-background bg-green-500" />
          </div>
          <div className="truncate">
            <h2
              className="text-lg font-semibold truncate"
              title={assistantTitle}
            >
              {assistantTitle}
            </h2>
            <p className="text-xs text-muted-foreground">
              {t('chat.statusOnline')}
            </p>
          </div>
        </div>
        {/* History controls - only shown when history.enabled is true (default) */}
        {history?.enabled !== false && (
          <div className="flex items-center gap-1">
            {/* New thread button */}
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="inline-flex h-8 w-8">
                  <button
                    type="button"
                    onClick={handleNewThread}
                    disabled={missingConfig || isHistoryLoading}
                    className={cn(
                      'flex h-8 w-8 cursor-pointer items-center justify-center rounded-md',
                      'text-muted-foreground hover:text-foreground hover:bg-muted',
                      'transition-colors duration-150',
                      'disabled:pointer-events-none disabled:opacity-50 disabled:cursor-not-allowed',
                    )}
                    aria-label={t('history.newThread')}
                  >
                    <Pencil size={16} />
                  </button>
                </span>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                {t('history.newThread')}
              </TooltipContent>
            </Tooltip>
            <HistorySidebar
              threads={threads}
              currentThreadId={stream.threadId ?? undefined}
              onNewThread={handleNewThread}
              onSelectThread={handleSelectThread}
              onDeleteThread={handleDeleteThread}
              showDelete={history?.showDelete !== false}
              disabled={missingConfig || isThreadsLoading || isHistoryLoading}
            />
          </div>
        )}
      </div>

      <div className="flex-1 p-4">
        {errorMessage && (
          <div className="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {errorMessage}
          </div>
        )}
        {historyError && (
          <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            {historyError}
          </div>
        )}
        {showMissingConfig && (
          <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            {missingConfigDetailMessage}
          </div>
        )}
        {isHistoryLoading && (
          <div className="mb-4 rounded-lg border border-muted px-3 py-2 text-sm text-muted-foreground">
            {t('chat.loadingThread')}
          </div>
        )}
        {messages.length === 0 ? (
          <StartScreen
            startScreen={startScreen}
            onPromptClick={handlePromptClick}
          />
        ) : (
          <div className="space-y-4">
            {messages.map((message, index) => {
              const messageType = String(message.type);
              const isAssistantMessage =
                messageType === 'assistant' || messageType === 'ai';
              const isStreamingMessage =
                stream.isLoading && index === messages.length - 1;
              const streamingStatus = isAssistantMessage
                ? getAssistantStreamingStatus(
                    {
                      ...(message as ChatkitMessage),
                      lastStreamOutputAt: lastStreamOutputAtRef.current,
                    },
                    isStreamingMessage,
                    { now: streamingNow },
                  )
                : null;

              if (
                isAssistantMessage &&
                !hasRenderableAssistantMessage(message as ChatkitMessage) &&
                !streamingStatus
              ) {
                return null;
              }

              const messageContent =
                typeof message.content === 'string'
                  ? message.content
                  : Array.isArray(message.content)
                    ? message.content
                        .map((part) => formatMessageContent(part as any))
                        .join('')
                    : formatMessageContent(message.content);
              const hasPlainRenderableContent =
                messageContent.trim().length > 0;
              const humanMessage = message as HumanMessageWithMeta;
              const humanReferences = humanMessage.references ?? [];
              const humanAttachments = humanMessage.attachments ?? [];
              const hasHumanAttachments =
                message.type === 'human' && humanAttachments.length > 0;
              const canQuoteMessage =
                message.type === 'human' || isAssistantMessage;
              const quoteSource =
                message.type === 'human' ? t('chat.youLabel') : assistantTitle;

              if (
                !isAssistantMessage &&
                !hasPlainRenderableContent &&
                !hasHumanAttachments &&
                humanReferences.length === 0
              ) {
                return null;
              }

              return (
                <div
                  key={message.id ?? `${message.type}-${index}`}
                  className={cn(
                    'group flex gap-3',
                    message.type === 'human'
                      ? 'justify-end'
                      : 'justify-start -ml-1', // AI messages: slightly closer to left
                  )}
                >
                  <div className="flex flex-col px-3 overflow-hidden">
                    <div
                      {...(canQuoteMessage
                        ? {
                            'data-quote-message-id': message.id,
                            'data-quote-source': quoteSource,
                          }
                        : {})}
                      className={cn(
                        'max-w-full rounded-2xl',
                        message.type === 'human'
                          ? 'bg-primary text-primary-foreground px-4 py-2.5'
                          : message.type === 'system'
                            ? 'bg-muted text-muted-foreground text-xs px-4 py-2.5'
                            : 'py-1 text-chat-foreground', // AI messages: use chat-specific foreground color
                      )}
                    >
                      {isAssistantMessage ? (
                        <AssistantMessage
                          message={{
                            ...(message as ChatkitMessage),
                            type: 'assistant',
                          }}
                          isStreaming={isStreamingMessage}
                          streamingStatus={streamingStatus}
                        />
                      ) : (
                        <>
                          {message.type === 'human' &&
                            humanReferences.length > 0 && (
                              <div className="mb-2 flex flex-wrap gap-1.5">
                                {humanReferences.map((reference) => (
                                  <ReferenceChip
                                    key={getReferenceKey(reference)}
                                    reference={reference}
                                    variant="message"
                                  />
                                ))}
                              </div>
                            )}
                          {/* Show attachments for human messages */}
                          {message.type === 'human' &&
                            humanAttachments.length > 0 && (
                              <div className="flex flex-wrap gap-1.5 mb-2">
                                {humanAttachments.map((file, fileIndex) => (
                                  <div
                                    key={fileIndex}
                                    className="flex items-center gap-1.5 rounded-md bg-primary-foreground/20 px-2 py-1 text-xs"
                                  >
                                    <FileText size={12} />
                                    <span className="max-w-[100px] truncate">
                                      {file.originalName}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )}
                          {Array.isArray(message.content) ? (
                            message.content.map((part, partIndex) => (
                              <p
                                key={`${part.type}-${partIndex}`}
                                className="wrap-break-word text-sm leading-relaxed"
                              >
                                {formatMessageContent(part as any)}
                              </p>
                            ))
                          ) : (
                            <span className="wrap-break-word text-sm leading-relaxed">
                              {formatMessageContent(message.content)}
                            </span>
                          )}
                        </>
                      )}
                    </div>
                    {/* Message actions - hidden during streaming, retry only for last AI message */}
                    <MessageActions
                      content={messageContent}
                      isAssistant={isAssistantMessage}
                      isStreaming={isStreamingMessage}
                      onRetry={
                        isAssistantMessage &&
                        !stream.isLoading &&
                        index === messages.length - 1
                          ? () => handleRetry(index)
                          : undefined
                      }
                    />
                  </div>
                </div>
              );
            })}
            {/* Show loading indicator with minimum display time */}
            {showLoadingDots &&
              (() => {
                const lastMessage = messages[messages.length - 1];
                const lastMessageType = lastMessage
                  ? String(lastMessage.type)
                  : '';
                const isLastMessageFromAI =
                  lastMessageType === 'ai' || lastMessageType === 'assistant';
                const lastAssistantStatus = isLastMessageFromAI
                  ? getAssistantStreamingStatus(
                      {
                        ...(lastMessage as ChatkitMessage),
                        lastStreamOutputAt: lastStreamOutputAtRef.current,
                      },
                      stream.isLoading,
                      { now: streamingNow },
                    )
                  : null;
                if (lastAssistantStatus) return null;
                const fallbackStreamingStatus = getAssistantStreamingStatus(
                  {
                    status: undefined,
                    reasoning: undefined,
                    lastStreamOutputAt: lastStreamOutputAtRef.current,
                  },
                  stream.isLoading,
                  { now: streamingNow },
                );
                return (
                  <div className="flex justify-start gap-3 -ml-2">
                    <div className="max-w-full rounded-2xl py-2.5">
                      <AssistantStreamingIndicator
                        status={fallbackStreamingStatus ?? 'loading'}
                      />
                    </div>
                  </div>
                );
              })()}
          </div>
        )}
      </div>

      {!isAtBottom && messages.length > 0 && (
        <div className="sticky bottom-20 z-20 flex justify-center px-4 pointer-events-none">
          <Button
            type="button"
            size="icon-sm"
            variant={hasUpdatesBelow ? 'default' : 'outline'}
            className={cn(
              'pointer-events-auto rounded-full shadow-md dark:border-white/20 dark:ring-1 dark:ring-white/15 dark:shadow-[0_0_0_1px_rgba(255,255,255,0.06),0_10px_30px_rgba(0,0,0,0.45)]',
              hasUpdatesBelow && 'animate-bounce',
            )}
            onClick={() => scrollToBottom(true, true)}
            aria-label={t('chat.scrollToBottom')}
            title={t('chat.scrollToBottom')}
          >
            <ArrowDown size={16} />
          </Button>
        </div>
      )}

      {quoteSelection && (
        <div
          className="pointer-events-none fixed z-50"
          style={{
            top: `${quoteSelection.top}px`,
            left: `${quoteSelection.left}px`,
            transform: 'translateX(-50%)',
          }}
        >
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="pointer-events-auto shadow-lg"
            onMouseDown={(event) => event.preventDefault()}
            onClick={handleQuoteSelection}
            aria-label={t('composer.quoteSelection')}
            title={t('composer.quoteSelection')}
          >
            <Quote size={14} />
            {t('composer.quoteSelection')}
          </Button>
        </div>
      )}

      <div className="p-2 sticky bottom-0 z-10 bg-background">
        {threadErrorMessage && (
          <div className="mb-3 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive overflow-auto">
            {threadErrorMessage}
          </div>
        )}
        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={acceptMimes}
          onChange={handleFileChange}
          className="hidden"
        />

        {/* Attachments preview */}
        {attachments.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-2">
            {attachments.map((item) => (
              <div
                key={item.localId}
                className={cn(
                  'flex items-center gap-2 rounded-md px-2 py-1 text-sm',
                  item.status === 'error'
                    ? 'bg-destructive/10 border border-destructive/30'
                    : 'bg-muted',
                )}
              >
                {/* Status icon */}
                {item.status === 'uploading' && (
                  <Loader2
                    size={14}
                    className="animate-spin text-muted-foreground"
                  />
                )}
                {item.status === 'success' && (
                  <FileText size={14} className="text-muted-foreground" />
                )}
                {item.status === 'error' && (
                  <FileText size={14} className="text-destructive" />
                )}

                {/* File name */}
                <span
                  className={cn(
                    'max-w-30 truncate',
                    item.status === 'error' && 'text-destructive',
                  )}
                >
                  {item.file.name}
                </span>

                {/* Retry button for failed uploads */}
                {item.status === 'error' && (
                  <button
                    type="button"
                    onClick={() => handleRetryUpload(item.localId)}
                    className="ml-1 rounded-full p-0.5 text-destructive hover:bg-destructive/20"
                    title={t('chat.retryUpload')}
                  >
                    <RefreshCw size={12} />
                  </button>
                )}

                {/* Remove button */}
                <button
                  type="button"
                  onClick={() => handleRemoveAttachment(item.localId)}
                  className={cn(
                    'ml-1 rounded-full p-0.5',
                    item.status === 'error'
                      ? 'text-destructive hover:bg-destructive/20'
                      : 'hover:bg-muted-foreground/20',
                  )}
                >
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
        )}

        {references.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-2">
            {references.map((reference) => (
              <ReferenceChip
                key={getReferenceKey(reference)}
                reference={reference}
                variant="composer"
                onRemove={() =>
                  setReferences((previous) =>
                    previous.filter(
                      (item) =>
                        getReferenceKey(item) !== getReferenceKey(reference),
                    ),
                  )
                }
                removeLabel={t('composer.removeReference')}
              />
            ))}
          </div>
        )}

        {/* Selected tool indicator */}
        {selectedTool && (
          <div className="mb-2 flex items-center gap-2">
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
              {selectedTool.shortLabel ?? selectedTool.label}
            </span>
            <button
              type="button"
              onClick={() => setSelectedTool(null)}
              className="rounded-full p-0.5 text-muted-foreground hover:bg-muted"
            >
              <X size={12} />
            </button>
          </div>
        )}

        <PendingTodos
          snapshot={stream.todos}
          attachToComposer={!hasPendingFollowUps}
          className={hasPendingFollowUps ? 'mb-2' : undefined}
        />

        <PendingFollowUps
          items={pendingFollowUps}
          isLoading={stream.isLoading}
          followUpBehavior={stream.followUpBehavior}
          onBehaviorChange={stream.setFollowUpBehavior}
          onPromoteToSteer={(id) => stream.promotePendingFollowUpToSteer(id)}
          canSendNow={stream.canSendPendingFollowUpNow}
          onSendNow={(id) => stream.sendPendingFollowUpNow(id)}
          onEdit={handleEditPendingFollowUp}
          onRemove={stream.removePendingFollowUp}
          attachToComposer
        />

        <form className="flex items-end" onSubmit={handleSubmit}>
          {/* Capsule-shaped input container */}
          <div
            className={cn(
              'flex flex-1 items-end gap-1 rounded-xl',
              'bg-background border border-border shadow-sm',
              'pl-1.5 pr-1.5 py-1',
              'focus-within:border-muted-foreground/30 focus-within:shadow-md',
              'transition-shadow duration-200',
              getRoundedClass(theme.radius),
            )}
          >
            {/* Plus button inside input - left side */}
            <ComposerMenu
              composer={composer}
              onAttachmentClick={handleAttachmentClick}
              onToolSelect={handleToolSelect}
              selectedTool={selectedTool}
              disabled={missingConfig || isHistoryLoading}
            />
            <textarea
              ref={composerInputRef}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onPaste={handleComposerPaste}
              onKeyDown={handleComposerKeyDown}
              rows={1}
              placeholder={inputPlaceholder}
              disabled={missingConfig || isHistoryLoading}
              className={cn(
                'min-h-8 max-h-32 flex-1 resize-none bg-transparent py-1 pr-2 text-sm leading-5 text-foreground outline-none',
                'placeholder:text-muted-foreground',
                'disabled:cursor-not-allowed disabled:opacity-50',
              )}
            />
            <SendButton
              disabled={isSendDisabled}
              isLoading={stream.isLoading}
              showStop={stream.isLoading && !trimmedDraft}
              onStop={() => stream.stop()}
              stopLabel={t('chat.stop')}
              sendLabel={t('chat.send')}
              shortcuts={
                stream.isLoading && trimmedDraft
                  ? [
                      {
                        label: t('chat.followUps.steer'),
                        keys: followUpShortcutLabels.steer,
                      },
                      {
                        label: t('chat.followUps.queue'),
                        keys: followUpShortcutLabels.queue,
                      },
                    ]
                  : undefined
              }
            />
          </div>
        </form>

        {/* Disclaimer */}
        {disclaimer?.text && (
          <p
            className={cn(
              'mt-2 text-center text-xs',
              disclaimer.highContrast
                ? 'text-foreground'
                : 'text-muted-foreground',
            )}
          >
            {disclaimer.text}
          </p>
        )}

        <div className="mt-2 flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <span>{t('chat.poweredBy')}</span>
          <ContextUsageIndicator className="absolute right-4" />
        </div>
      </div>
    </div>
  );
}
