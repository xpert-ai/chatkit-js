import * as React from 'react';
import {
  ArrowDown,
  FileText,
  ImageIcon,
  Loader2,
  Pencil,
  Quote,
  RefreshCw,
  Settings,
  X,
} from 'lucide-react';

import type {
  Message,
  RuntimeCapabilitiesSelection,
} from '@xpert-ai/xpert-sdk';
import type {
  ChatkitMessage,
  ChatKitImageReference,
  ChatKitOptions,
  ChatKitReference,
  ChatKitReferenceCompositionMode,
  ChatKitCommandSource,
  FollowUpBehavior,
  ToolOption,
} from '@xpert-ai/chatkit-types';

import {
  cn,
  createMessageId,
  getComposerInputRoundedClass,
  getMenuItemRoundedClass,
  getPanelRoundedClass,
  getRoundedClass,
} from '../lib/utils';
import {
  getAssistantStreamingStatus,
  hasRenderableAssistantMessage,
} from '../lib/message';
import { isNearBottom } from '../lib/scroll';
import { type StorageFile, type UploadingFile } from '../lib/types';
import { useStreamContext } from '../providers/Stream';
import { ComposerMenu } from './composer/ComposerMenu';
import { SendButton } from './composer/SendButton';
import { SlashPalette } from './composer/SlashPalette';
import { HistorySidebar } from './history/HistorySidebar';
import { PendingFollowUps } from './composer/pending-follow-ups';
import { PendingRuntimeServices } from './composer/pending-runtime-services';
import { PendingTodos } from './composer/pending-todos';
import { HITLApprovalPanel } from './composer/hitl-approval-panel';
import { RequestUserInputPanel } from './composer/request-user-input-panel';
import { useConversationSummaryEvent } from './chat/useConversationSummaryEvent';
import { usePetAutoState } from './chat/usePetAutoState';
import { useSlashCommands } from './chat/useSlashCommands';
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
import { RuntimeCapabilityIcon } from './runtime-capability-icon';
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
import { PetBridge } from './pet/PetBridge';
import { SettingsSheet } from './settings/SettingsSheet';
import {
  buildPetOptionsFromLocalSettings,
  derivePetLocalSettings,
  isPetEnabled,
  readPetLocalSettings,
  writePetLocalSettings,
  type PetCommandMode,
  type PetLocalSettings,
} from './pet/pet-local-settings';
import {
  createEmptyRuntimeCapabilitiesSelection,
  createDefaultRuntimeCapabilitiesSelection,
  getRuntimeCapabilityOptions,
  isRuntimeCapabilitySelected,
  mergeRuntimeCapabilitiesSelections,
  toggleRuntimeCapabilitySelection,
  type RuntimeCapabilityOption,
} from '../lib/runtime-capabilities';
import {
  hasMissingRuntimeCapabilityReferences,
  loadConversationRuntimeCapabilities,
  persistConversationRuntimeCapabilities as persistRuntimeCapabilitiesToConversation,
  type MissingRuntimeCapabilityReferences,
} from '../lib/conversation-runtime-capabilities';
import {
  createComposerCapabilityPart,
  createComposerTextParts,
  findAdjacentComposerCapability,
  getComposerCapabilityKeys,
  getComposerCapabilityPartMap,
  getComposerCapabilitySelectionKeys,
  getComposerEditingLength,
  getComposerEditingText,
  getComposerPlainText,
  getComposerSelectionOffset,
  getComposerSelectionOffsets,
  getRuntimeCapabilityOptionKey,
  normalizeComposerParts,
  readComposerPartsFromElement,
  removeComposerCapabilityTokens,
  replaceComposerRange,
  setComposerSelectionOffset,
  type ComposerCapabilityPart,
  type ComposerPart,
} from '../lib/composer-parts';
import {
  resolveRuntimeCapabilityPalette,
  type RuntimeCapabilitiesWithCommands,
  type RuntimeCapabilityPaletteState,
} from '../lib/slash-commands';

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
  runtimeCapabilities?: RuntimeCapabilitiesSelection;
  runtimeCapabilityOptions?: RuntimeCapabilityOption[];
};

function getSlashPaletteEmptyLabelKey(
  palette: RuntimeCapabilityPaletteState,
  runtimeCapabilitiesReady: boolean,
): string {
  if (!palette.capabilityTypes || palette.capabilityTypes.length !== 1) {
    return 'composer.capabilities.emptySearch';
  }

  if (!runtimeCapabilitiesReady) {
    return 'composer.slashCommands.empty.loadingCapabilities';
  }

  const hasQuery = palette.query.trim().length > 0;
  const capabilityType = palette.capabilityTypes[0];
  if (capabilityType === 'skill') {
    return hasQuery
      ? 'composer.slashCommands.empty.matchingSkills'
      : 'composer.slashCommands.empty.skills';
  }

  if (capabilityType === 'plugin') {
    return hasQuery
      ? 'composer.slashCommands.empty.matchingPlugins'
      : 'composer.slashCommands.empty.plugins';
  }

  return hasQuery
    ? 'composer.slashCommands.empty.matchingSubAgents'
    : 'composer.slashCommands.empty.subAgents';
}

type QuoteSelectionState = {
  reference: ChatKitReference;
  top: number;
  left: number;
};

type SubmitDraftOptions = {
  followUpOverride?: FollowUpBehavior;
  inputText?: string;
  displayText?: string;
  commandSource?: ChatKitCommandSource;
  runtimeCapabilities?: RuntimeCapabilitiesSelection;
  planMode?: boolean;
};

function getHttpStatus(error: unknown): number | null {
  if (!error || typeof error !== 'object' || !('status' in error)) {
    return null;
  }

  const status = (error as { status?: unknown }).status;
  return typeof status === 'number' ? status : null;
}

function warnMissingRuntimeCapabilityReferences(
  action: string,
  missing: MissingRuntimeCapabilityReferences,
) {
  if (!hasMissingRuntimeCapabilityReferences(missing)) {
    return;
  }

  console.warn(
    `[Chat] Runtime capabilities ${action} include unavailable references:`,
    missing,
  );
}

function getSelectedRuntimeCapabilityOptions(
  selection: RuntimeCapabilitiesSelection | null | undefined,
  options: RuntimeCapabilityOption[],
): RuntimeCapabilityOption[] {
  if (!selection) {
    return [];
  }

  return options.filter((option) =>
    isRuntimeCapabilitySelected(selection, option.type, option.id),
  );
}

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

  const [composerParts, setComposerParts] = React.useState<ComposerPart[]>([]);
  const [renderedComposerParts, setRenderedComposerParts] = React.useState<
    ComposerPart[]
  >([]);
  const [composerDomVersion, setComposerDomVersion] = React.useState(0);
  const [selectedTool, setSelectedTool] = React.useState<ToolOption | null>(
    null,
  );
  const [planModeEnabled, setPlanModeEnabled] = React.useState(false);
  const [petSettingsOpen, setPetSettingsOpen] = React.useState(false);
  const [petLocalSettings, setPetLocalSettings] =
    React.useState<PetLocalSettings | null>(() => readPetLocalSettings());
  const [runtimeCapabilities, setRuntimeCapabilities] =
    React.useState<RuntimeCapabilitiesWithCommands | null>(null);
  const [runtimeCapabilitiesReady, setRuntimeCapabilitiesReady] =
    React.useState(false);
  const [sessionRuntimeCapabilities, setSessionRuntimeCapabilities] =
    React.useState<RuntimeCapabilitiesSelection>(() =>
      createEmptyRuntimeCapabilitiesSelection(),
    );
  const [runRuntimeCapabilities, setRunRuntimeCapabilities] =
    React.useState<RuntimeCapabilitiesSelection>(() =>
      createEmptyRuntimeCapabilitiesSelection(),
    );
  const [runtimeCapabilityPalette, setRuntimeCapabilityPalette] =
    React.useState<RuntimeCapabilityPaletteState | null>(null);
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
  const composerInputRef = React.useRef<HTMLDivElement>(null);
  const slashPaletteRef = React.useRef<HTMLDivElement>(null);
  const slashPaletteOptionRefs = React.useRef<Array<HTMLButtonElement | null>>(
    [],
  );
  const composerPartsRef = React.useRef<ComposerPart[]>([]);
  const pendingComposerCaretOffsetRef = React.useRef<number | null>(null);
  const shouldAutoScrollRef = React.useRef(true);
  const forceFollowRef = React.useRef(false);
  const previousMessageCountRef = React.useRef(0);
  const previousScrollTopRef = React.useRef(0);
  const autoScrollFrameRef = React.useRef<number | null>(null);
  const isPointerDownRef = React.useRef(false);
  const lastTouchYRef = React.useRef<number | null>(null);
  const runtimeCapabilityPreferenceLoadRef = React.useRef(0);

  const resolvedTitle = title ?? t('chat.title');
  const resolvedPlaceholder = placeholder ?? t('chat.placeholder');
  const petRequired = options?.displayMode === 'pet';
  const basePetSettings = React.useMemo(
    () => derivePetLocalSettings(options?.pet),
    [options?.pet],
  );
  const displayedPetSettings = React.useMemo(
    () => ({
      ...(petLocalSettings ?? basePetSettings),
      ...(petRequired ? { enabled: true } : {}),
    }),
    [basePetSettings, petLocalSettings, petRequired],
  );
  const effectivePet = React.useMemo(() => {
    if (petRequired || petLocalSettings) {
      return buildPetOptionsFromLocalSettings(displayedPetSettings);
    }

    return options?.pet ?? null;
  }, [displayedPetSettings, options?.pet, petLocalSettings, petRequired]);
  const savePetLocalSettings = React.useCallback(
    (settings: PetLocalSettings) => {
      const nextSettings = petRequired
        ? { ...settings, enabled: true }
        : settings;
      setPetLocalSettings(nextSettings);
      writePetLocalSettings(nextSettings);
    },
    [petRequired],
  );
  const handlePetCommand = React.useCallback(
    (mode: PetCommandMode) => {
      if (mode === 'settings') {
        setPetSettingsOpen(true);
        return;
      }

      if (petRequired) {
        savePetLocalSettings({
          ...displayedPetSettings,
          enabled: true,
        });
        return;
      }

      const enabled =
        mode === 'toggle' ? !isPetEnabled(effectivePet) : mode === 'on';
      savePetLocalSettings({
        ...displayedPetSettings,
        enabled,
      });
    },
    [displayedPetSettings, effectivePet, petRequired, savePetLocalSettings],
  );

  // Use placeholder from composer options or fallback to prop/i18n
  const inputPlaceholder =
    selectedTool?.placeholderOverride ??
    composer?.placeholder ??
    resolvedPlaceholder;

  const messages = React.useMemo(
    () => stream.messages ?? [],
    [stream.messages],
  );
  const draft = React.useMemo(
    () => getComposerPlainText(composerParts),
    [composerParts],
  );
  const trimmedDraft = draft.trim();
  const hasReferences = references.length > 0;
  const isComposerStacked = planModeEnabled || Boolean(selectedTool);
  const isComposerInputEmpty = getComposerEditingLength(composerParts) === 0;
  const composerInputRoundedClass = getComposerInputRoundedClass(theme.radius, {
    isEmpty: isComposerInputEmpty,
    isStacked: isComposerStacked,
  });
  const pendingFollowUps = React.useMemo(
    () =>
      [...(stream.pendingFollowUps ?? [])].sort(
        (a, b) => a.createdAt - b.createdAt,
      ),
    [stream.pendingFollowUps],
  );
  const hasPendingFollowUps = pendingFollowUps.length > 0;
  const hasPendingRequestUserInput = Boolean(stream.pendingRequestUserInput);
  const hasPendingHITLRequest = Boolean(stream.pendingHITLRequest);
  const hasPendingInteractiveRequest =
    hasPendingRequestUserInput || hasPendingHITLRequest;
  const hasPendingTodos = Boolean(stream.todos?.items.length);
  const runtimeCapabilityOptions = React.useMemo(
    () => getRuntimeCapabilityOptions(runtimeCapabilities),
    [runtimeCapabilities],
  );
  const effectiveSessionRuntimeCapabilities = React.useMemo(
    () =>
      runtimeCapabilitiesReady && runtimeCapabilities
        ? mergeRuntimeCapabilitiesSelections(
            runtimeCapabilities,
            sessionRuntimeCapabilities,
          )
        : null,
    [runtimeCapabilities, runtimeCapabilitiesReady, sessionRuntimeCapabilities],
  );
  const effectiveRuntimeCapabilitiesForSubmit = React.useMemo(
    () =>
      runtimeCapabilitiesReady && runtimeCapabilities
        ? mergeRuntimeCapabilitiesSelections(
            runtimeCapabilities,
            sessionRuntimeCapabilities,
            runRuntimeCapabilities,
          )
        : null,
    [
      runtimeCapabilities,
      runtimeCapabilitiesReady,
      runRuntimeCapabilities,
      sessionRuntimeCapabilities,
    ],
  );
  const runRuntimeCapabilityOptions = React.useMemo(
    () =>
      runtimeCapabilityOptions.filter((option) =>
        isRuntimeCapabilitySelected(
          runRuntimeCapabilities,
          option.type,
          option.id,
        ),
      ),
    [runRuntimeCapabilities, runtimeCapabilityOptions],
  );
  const composerRuntimeCapabilitySelectionKeys = React.useMemo(
    () => getComposerCapabilitySelectionKeys(composerParts),
    [composerParts],
  );
  const detachedRunRuntimeCapabilityOptions = React.useMemo(
    () =>
      runRuntimeCapabilityOptions.filter(
        (option) =>
          !composerRuntimeCapabilitySelectionKeys.has(
            getRuntimeCapabilityOptionKey(option),
          ),
      ),
    [composerRuntimeCapabilitySelectionKeys, runRuntimeCapabilityOptions],
  );

  const persistSessionRuntimeCapabilities = React.useCallback(
    async (
      threadId: string,
      selection: RuntimeCapabilitiesSelection | null | undefined,
    ) => {
      if (!runtimeCapabilities || !selection) {
        return;
      }

      try {
        const result = await persistRuntimeCapabilitiesToConversation({
          client: stream.client,
          threadId,
          capabilities: runtimeCapabilities,
          selection,
        });
        warnMissingRuntimeCapabilityReferences(
          'persisted selection',
          result.missing,
        );
      } catch (error) {
        console.warn(
          '[Chat] Failed to persist runtime capabilities selection:',
          error,
        );
      }
    },
    [runtimeCapabilities, stream.client],
  );

  const clearQuoteSelection = React.useCallback(() => {
    setQuoteSelection(null);
  }, []);

  const commitComposerParts = React.useCallback(
    (
      nextParts: ComposerPart[],
      options?: {
        caretOffset?: number | null;
        resetDom?: boolean;
        syncRemovedCapabilityTokens?: boolean;
      },
    ) => {
      const normalized = normalizeComposerParts(nextParts);
      const previous = composerPartsRef.current;
      composerPartsRef.current = normalized;

      if (typeof options?.caretOffset === 'number') {
        pendingComposerCaretOffsetRef.current = options.caretOffset;
      }

      if (options?.syncRemovedCapabilityTokens ?? true) {
        const nextKeys = getComposerCapabilityKeys(normalized);
        const removedCapabilities = previous.filter(
          (part): part is ComposerCapabilityPart =>
            part.type === 'capability' && !nextKeys.has(part.key),
        );

        if (removedCapabilities.length > 0) {
          setRunRuntimeCapabilities((selection) => {
            let nextSelection = selection;
            for (const part of removedCapabilities) {
              nextSelection = toggleRuntimeCapabilitySelection(
                nextSelection,
                part.capability.type,
                part.capability.id,
                false,
              );
            }
            return nextSelection;
          });
        }
      }

      setComposerParts(normalized);
      if (options?.resetDom) {
        setRenderedComposerParts(normalized);
        setComposerDomVersion((version) => version + 1);
      }
    },
    [],
  );

  const setComposerText = React.useCallback(
    (text: string, caretOffset = text.length) => {
      commitComposerParts(createComposerTextParts(text), {
        caretOffset,
        resetDom: true,
        syncRemovedCapabilityTokens: true,
      });
    },
    [commitComposerParts],
  );

  const focusComposerAt = React.useCallback((position?: number) => {
    const nextPosition =
      position ?? getComposerEditingLength(composerPartsRef.current);
    pendingComposerCaretOffsetRef.current = nextPosition;
    requestAnimationFrame(() => {
      const input = composerInputRef.current;
      if (!input) {
        return;
      }
      setComposerSelectionOffset(input, nextPosition);
    });
  }, []);

  const parentMessenger = useParentMessenger({
    onSetComposerValue: React.useCallback(
      (payload: ComposerValuePayload | null) => {
        if (!payload) {
          return;
        }

        if (typeof payload.text === 'string') {
          setComposerText(payload.text);
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
      [composer?.tools, setComposerText],
    ),
    onFocusComposer: React.useCallback(() => {
      composerInputRef.current?.focus();
    }, []),
    onSetPetEnabled: React.useCallback(
      (enabled: boolean) => {
        if (petRequired) {
          return;
        }

        savePetLocalSettings({
          ...displayedPetSettings,
          enabled,
        });
      },
      [displayedPetSettings, petRequired, savePetLocalSettings],
    ),
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
    hasPendingInteractiveRequest ||
    missingConfig ||
    isHistoryLoading ||
    hasUploadingFiles ||
    isUploadingReferenceImages;

  const resizeComposerInput = React.useCallback(() => {
    const input = composerInputRef.current;
    if (!input) {
      return;
    }
    input.style.maxHeight = `${COMPOSER_INPUT_MAX_HEIGHT}px`;
    input.style.overflowY =
      input.scrollHeight > COMPOSER_INPUT_MAX_HEIGHT ? 'auto' : 'hidden';
  }, []);

  React.useLayoutEffect(() => {
    composerPartsRef.current = composerParts;
    resizeComposerInput();
    const caretOffset = pendingComposerCaretOffsetRef.current;
    if (typeof caretOffset === 'number') {
      pendingComposerCaretOffsetRef.current = null;
      const input = composerInputRef.current;
      if (input) {
        setComposerSelectionOffset(input, caretOffset);
      }
    }
  }, [composerDomVersion, composerParts, resizeComposerInput]);

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

  React.useEffect(() => {
    if (missingConfig || !stream.client || !stream.assistantId) {
      setRuntimeCapabilities(null);
      setRuntimeCapabilitiesReady(false);
      setSessionRuntimeCapabilities(createEmptyRuntimeCapabilitiesSelection());
      setRunRuntimeCapabilities(createEmptyRuntimeCapabilitiesSelection());
      setRuntimeCapabilityPalette(null);
      return;
    }

    const controller = new AbortController();

    setRuntimeCapabilitiesReady(false);
    setRuntimeCapabilities(null);
    setRuntimeCapabilityPalette(null);

    void stream.client.assistants
      .getRuntimeCapabilities(stream.assistantId, {
        signal: controller.signal,
      })
      .then((payload) => {
        setRuntimeCapabilities(payload);
        setRuntimeCapabilitiesReady(true);
        setSessionRuntimeCapabilities(
          createDefaultRuntimeCapabilitiesSelection(payload),
        );
        setRunRuntimeCapabilities(
          createEmptyRuntimeCapabilitiesSelection(payload),
        );
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) {
          return;
        }
        if (getHttpStatus(error) === 404) {
          setRuntimeCapabilities(null);
          setRuntimeCapabilitiesReady(false);
          setSessionRuntimeCapabilities(
            createEmptyRuntimeCapabilitiesSelection(),
          );
          setRunRuntimeCapabilities(createEmptyRuntimeCapabilitiesSelection());
          return;
        }
        console.warn('[Chat] Failed to load runtime capabilities:', error);
        setRuntimeCapabilities(null);
        setRuntimeCapabilitiesReady(false);
        setSessionRuntimeCapabilities(
          createEmptyRuntimeCapabilitiesSelection(),
        );
        setRunRuntimeCapabilities(createEmptyRuntimeCapabilitiesSelection());
      });

    return () => controller.abort();
  }, [missingConfig, stream.client, stream.assistantId]);

  React.useEffect(() => {
    setRunRuntimeCapabilities(
      createEmptyRuntimeCapabilitiesSelection(runtimeCapabilities),
    );

    if (!runtimeCapabilitiesReady || !runtimeCapabilities) {
      setSessionRuntimeCapabilities(
        createEmptyRuntimeCapabilitiesSelection(runtimeCapabilities),
      );
      return;
    }

    const defaultSelection =
      createDefaultRuntimeCapabilitiesSelection(runtimeCapabilities);
    const threadId = stream.threadId?.trim();
    if (!threadId) {
      setSessionRuntimeCapabilities(defaultSelection);
      return;
    }

    let cancelled = false;
    const requestId = runtimeCapabilityPreferenceLoadRef.current + 1;
    runtimeCapabilityPreferenceLoadRef.current = requestId;
    setSessionRuntimeCapabilities(defaultSelection);

    void loadConversationRuntimeCapabilities({
      client: stream.client,
      threadId,
      capabilities: runtimeCapabilities,
    })
      .then(({ selection, missing }) => {
        if (
          cancelled ||
          runtimeCapabilityPreferenceLoadRef.current !== requestId
        ) {
          return;
        }

        warnMissingRuntimeCapabilityReferences('loaded selection', missing);
        setSessionRuntimeCapabilities(selection ?? defaultSelection);
      })
      .catch((error: unknown) => {
        if (
          cancelled ||
          runtimeCapabilityPreferenceLoadRef.current !== requestId
        ) {
          return;
        }
        console.warn(
          '[Chat] Failed to load persisted runtime capabilities selection:',
          error,
        );
        setSessionRuntimeCapabilities(defaultSelection);
      });

    return () => {
      cancelled = true;
    };
  }, [
    runtimeCapabilities,
    runtimeCapabilitiesReady,
    stream.client,
    stream.threadId,
  ]);

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

  const handleSessionRuntimeCapabilityToggle = React.useCallback(
    (type: RuntimeCapabilityOption['type'], id: string, selected: boolean) => {
      setSessionRuntimeCapabilities((previous) => {
        const nextSelection = toggleRuntimeCapabilitySelection(
          previous,
          type,
          id,
          selected,
        );

        const threadId = stream.threadId?.trim();
        if (threadId) {
          void persistSessionRuntimeCapabilities(threadId, nextSelection);
        }

        return nextSelection;
      });
    },
    [persistSessionRuntimeCapabilities, stream.threadId],
  );

  const updateRuntimeCapabilityPalette = React.useCallback(
    (parts: ComposerPart[], selectionStart?: number | null) => {
      const input = composerInputRef.current;
      const editingText = getComposerEditingText(parts);
      const nextPalette = resolveRuntimeCapabilityPalette(
        editingText,
        typeof selectionStart === 'number'
          ? selectionStart
          : input
            ? getComposerSelectionOffset(input)
            : getComposerEditingLength(parts),
      );
      setRuntimeCapabilityPalette(nextPalette);
    },
    [],
  );

  const syncComposerInputFromElement = React.useCallback(
    (input: HTMLDivElement) => {
      const previousCapabilities = getComposerCapabilityPartMap(
        composerPartsRef.current,
      );
      const nextParts = readComposerPartsFromElement(
        input,
        previousCapabilities,
      );
      const selectionOffset =
        getComposerSelectionOffsets(input)?.end ??
        getComposerEditingLength(nextParts);
      commitComposerParts(nextParts, {
        caretOffset: selectionOffset,
        resetDom: false,
      });
      updateRuntimeCapabilityPalette(nextParts, selectionOffset);
    },
    [commitComposerParts, updateRuntimeCapabilityPalette],
  );

  const handleComposerInput = React.useCallback(
    (event: React.FormEvent<HTMLDivElement>) => {
      syncComposerInputFromElement(event.currentTarget);
    },
    [syncComposerInputFromElement],
  );

  const handleComposerCompositionEnd = React.useCallback(
    (event: React.CompositionEvent<HTMLDivElement>) => {
      syncComposerInputFromElement(event.currentTarget);
    },
    [syncComposerInputFromElement],
  );

  const handleComposerSelect = React.useCallback(() => {
    updateRuntimeCapabilityPalette(
      composerPartsRef.current,
      composerInputRef.current
        ? getComposerSelectionOffset(composerInputRef.current)
        : undefined,
    );
  }, [updateRuntimeCapabilityPalette]);

  const removeRunRuntimeCapability = React.useCallback(
    (option: RuntimeCapabilityOption) => {
      setRunRuntimeCapabilities((previous) =>
        toggleRuntimeCapabilitySelection(
          previous,
          option.type,
          option.id,
          false,
        ),
      );
      commitComposerParts(
        removeComposerCapabilityTokens(composerPartsRef.current, option),
        {
          resetDom: true,
          syncRemovedCapabilityTokens: false,
        },
      );
    },
    [commitComposerParts],
  );

  const submitDraft = React.useCallback(
    (optionsOrFollowUp?: FollowUpBehavior | SubmitDraftOptions) => {
      if (isSendDisabled) return;

      const submitOptions =
        typeof optionsOrFollowUp === 'string'
          ? { followUpOverride: optionsOrFollowUp }
          : (optionsOrFollowUp ?? {});
      const contentToSubmit = (submitOptions.inputText ?? trimmedDraft).trim();
      const filesToSend =
        uploadedFiles.length > 0 ? [...uploadedFiles] : undefined;
      const referencesToSend =
        references.length > 0 ? [...references] : undefined;
      const nextFollowUpMode = stream.isLoading
        ? (submitOptions.followUpOverride ?? stream.followUpBehavior)
        : undefined;
      const effectivePlanMode = submitOptions.planMode ?? planModeEnabled;
      const humanInput = buildHumanMessageInputPayload({
        content: contentToSubmit,
        references: referencesToSend,
      });

      if (!humanInput) {
        return;
      }

      const runtimeCapabilitiesForSubmit =
        submitOptions.runtimeCapabilities &&
        runtimeCapabilities &&
        runtimeCapabilitiesReady
          ? mergeRuntimeCapabilitiesSelections(
              runtimeCapabilities,
              effectiveRuntimeCapabilitiesForSubmit,
              submitOptions.runtimeCapabilities,
            )
          : effectiveRuntimeCapabilitiesForSubmit;
      const runtimeCapabilityOptionsForMessage =
        getSelectedRuntimeCapabilityOptions(
          runtimeCapabilitiesForSubmit,
          runtimeCapabilityOptions,
        );

      const displayContent =
        submitOptions.displayText ||
        contentToSubmit ||
        (referencesToSend ? t('chat.referencedContentOnly') : '');
      const newMessage: HumanMessageWithMeta = {
        id: createMessageId(),
        type: 'human',
        content: displayContent,
        submittedInput: humanInput.input,
        ...(humanInput.referenceComposition
          ? { referenceComposition: humanInput.referenceComposition }
          : {}),
        ...(runtimeCapabilitiesForSubmit
          ? { runtimeCapabilities: runtimeCapabilitiesForSubmit }
          : {}),
        ...(runtimeCapabilityOptionsForMessage.length > 0
          ? { runtimeCapabilityOptions: runtimeCapabilityOptionsForMessage }
          : {}),
        ...(filesToSend ? { attachments: filesToSend } : {}),
        ...(referencesToSend ? { references: referencesToSend } : {}),
      };

      commitComposerParts([], {
        caretOffset: 0,
        resetDom: true,
        syncRemovedCapabilityTokens: false,
      });

      const inputPayload: {
        input: string;
        files?: typeof uploadedFiles;
        references?: ChatKitReference[];
        referenceComposition?: ChatKitReferenceCompositionMode;
        planMode?: boolean;
        runtimeCapabilities?: RuntimeCapabilitiesSelection;
        commandSource?: ChatKitCommandSource;
      } = {
        ...humanInput,
      };
      if (filesToSend) {
        inputPayload.files = filesToSend;
      }
      if (effectivePlanMode) {
        inputPayload.planMode = true;
      }
      if (runtimeCapabilitiesForSubmit) {
        inputPayload.runtimeCapabilities = runtimeCapabilitiesForSubmit;
      }
      if (submitOptions.commandSource) {
        inputPayload.commandSource = submitOptions.commandSource;
      }

      const requestOptions = buildInjectedRequestOptions({
        defaults: options?.request,
        humanInput: inputPayload,
      });
      const sessionRuntimeCapabilitiesForPersistence =
        effectiveSessionRuntimeCapabilities;
      const shouldPersistSessionRuntimeCapabilities =
        !!sessionRuntimeCapabilitiesForPersistence &&
        !stream.threadId &&
        !nextFollowUpMode;

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
          ...(shouldPersistSessionRuntimeCapabilities
            ? {
                onThreadResolved: (threadId) =>
                  persistSessionRuntimeCapabilities(
                    threadId,
                    sessionRuntimeCapabilitiesForPersistence,
                  ),
              }
            : {}),
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
      setRunRuntimeCapabilities(
        createEmptyRuntimeCapabilitiesSelection(runtimeCapabilities),
      );
      setRuntimeCapabilityPalette(null);
    },
    [
      effectiveRuntimeCapabilitiesForSubmit,
      effectiveSessionRuntimeCapabilities,
      isSendDisabled,
      options?.request,
      persistSessionRuntimeCapabilities,
      references,
      runtimeCapabilities,
      runtimeCapabilitiesReady,
      runtimeCapabilityOptions,
      scrollToBottom,
      selectedTool,
      commitComposerParts,
      planModeEnabled,
      stream,
      trimmedDraft,
      uploadedFiles,
      t,
    ],
  );

  const addRunRuntimeCapabilities = React.useCallback(
    (selection: RuntimeCapabilitiesSelection) => {
      setRunRuntimeCapabilities((previous) =>
        runtimeCapabilities
          ? mergeRuntimeCapabilitiesSelections(
              runtimeCapabilities,
              previous,
              selection,
            )
          : previous,
      );
    },
    [runtimeCapabilities],
  );

  const insertComposerCapabilityToken = React.useCallback(
    (
      capability: RuntimeCapabilityOption,
      range?: { start: number; end: number },
    ) => {
      const token = createComposerCapabilityPart(capability, createMessageId());
      const currentParts = composerPartsRef.current;
      const replaceRange = range ?? {
        start: getComposerEditingLength(currentParts),
        end: getComposerEditingLength(currentParts),
      };
      const nextParts = replaceComposerRange(
        currentParts,
        replaceRange.start,
        replaceRange.end,
        [token],
      );
      commitComposerParts(nextParts, {
        caretOffset: replaceRange.start + 1,
        resetDom: true,
        syncRemovedCapabilityTokens: true,
      });
      setRunRuntimeCapabilities((previous) =>
        toggleRuntimeCapabilitySelection(
          previous,
          capability.type,
          capability.id,
          true,
        ),
      );
      setRuntimeCapabilityPalette(null);
      focusComposerAt(replaceRange.start + 1);
    },
    [commitComposerParts, focusComposerAt],
  );

  const {
    slashPaletteOptions,
    executeSlashCommandFromDraft,
    selectSlashPaletteOption,
  } = useSlashCommands({
    hostCommands: composer?.slashCommands,
    runtimeCapabilities,
    runtimeCapabilitiesReady,
    runtimeCapabilityOptions,
    effectiveRuntimeCapabilitiesForSubmit,
    draft,
    palette: runtimeCapabilityPalette,
    setPalette: setRuntimeCapabilityPalette,
    parentMessenger,
    getComposerEditingLength: () =>
      getComposerEditingLength(composerPartsRef.current),
    setComposerText,
    focusComposerAt,
    setPlanModeEnabled,
    onPetCommand: handlePetCommand,
    addRunRuntimeCapabilities,
    setRunRuntimeCapabilities,
    insertComposerCapabilityToken,
    submitPrompt: submitDraft,
  });
  const slashPaletteEmptyLabel = runtimeCapabilityPalette
    ? t(
        getSlashPaletteEmptyLabelKey(
          runtimeCapabilityPalette,
          runtimeCapabilitiesReady,
        ),
      )
    : t('composer.capabilities.emptySearch');
  const slashPaletteCapabilityEmptyLabels = runtimeCapabilitiesReady
    ? {
        skill: t('composer.slashCommands.empty.skills'),
        plugin: t('composer.slashCommands.empty.plugins'),
        subAgent: t('composer.slashCommands.empty.subAgents'),
      }
    : {
        skill: t('composer.slashCommands.empty.loadingCapabilities'),
        plugin: t('composer.slashCommands.empty.loadingCapabilities'),
        subAgent: t('composer.slashCommands.empty.loadingCapabilities'),
      };

  React.useEffect(() => {
    if (!runtimeCapabilityPalette) {
      return;
    }
    if (slashPaletteOptions.length === 0) {
      setRuntimeCapabilityPalette((previous) =>
        previous && previous.activeIndex !== 0
          ? { ...previous, activeIndex: 0 }
          : previous,
      );
      return;
    }
    if (runtimeCapabilityPalette.activeIndex >= slashPaletteOptions.length) {
      setRuntimeCapabilityPalette((previous) =>
        previous
          ? {
              ...previous,
              activeIndex: slashPaletteOptions.length - 1,
            }
          : previous,
      );
    }
  }, [slashPaletteOptions.length, runtimeCapabilityPalette]);

  React.useLayoutEffect(() => {
    if (!runtimeCapabilityPalette) {
      return;
    }

    const container = slashPaletteRef.current;
    const option =
      slashPaletteOptionRefs.current[runtimeCapabilityPalette.activeIndex];
    if (!container || !option) {
      return;
    }

    const containerRect = container.getBoundingClientRect();
    const optionRect = option.getBoundingClientRect();
    if (optionRect.top < containerRect.top) {
      container.scrollTop -= containerRect.top - optionRect.top;
    } else if (optionRect.bottom > containerRect.bottom) {
      container.scrollTop += optionRect.bottom - containerRect.bottom;
    }
  }, [runtimeCapabilityPalette, slashPaletteOptions.length]);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (executeSlashCommandFromDraft()) {
      return;
    }
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
      setComposerText(text);
      setReferences(nextReferences);

      requestAnimationFrame(() => {
        const input = composerInputRef.current;
        if (!input) {
          return;
        }

        input.focus();
        const position = text.length;
        setComposerSelectionOffset(input, position);
      });
    },
    [pendingFollowUps, setComposerText, stream],
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
    event: React.KeyboardEvent<HTMLDivElement>,
  ) => {
    if (runtimeCapabilityPalette) {
      if (event.key === 'Escape') {
        event.preventDefault();
        setRuntimeCapabilityPalette(null);
        return;
      }

      if (
        event.key === 'ArrowDown' ||
        event.key === 'ArrowUp' ||
        event.key === 'Tab'
      ) {
        event.preventDefault();
        if (slashPaletteOptions.length === 0) {
          return;
        }
        setRuntimeCapabilityPalette((previous) => {
          if (!previous) {
            return previous;
          }
          const direction = event.key === 'ArrowUp' ? -1 : 1;
          const nextIndex =
            (previous.activeIndex + direction + slashPaletteOptions.length) %
            slashPaletteOptions.length;
          return { ...previous, activeIndex: nextIndex };
        });
        return;
      }

      if (event.key === 'Enter') {
        const option =
          slashPaletteOptions[runtimeCapabilityPalette.activeIndex];
        if (option) {
          event.preventDefault();
          selectSlashPaletteOption(option);
          return;
        }
      }
    }

    if (event.key === 'Backspace' || event.key === 'Delete') {
      const input = composerInputRef.current;
      const selection = input ? getComposerSelectionOffsets(input) : null;
      if (selection && selection.start === selection.end) {
        const adjacentCapability = findAdjacentComposerCapability(
          composerPartsRef.current,
          selection.start,
          event.key === 'Backspace' ? 'before' : 'after',
        );
        if (adjacentCapability) {
          event.preventDefault();
          const nextCaret =
            event.key === 'Backspace'
              ? Math.max(0, selection.start - 1)
              : selection.start;
          commitComposerParts(
            composerPartsRef.current.filter(
              (part) =>
                part.type !== 'capability' ||
                part.key !== adjacentCapability.key,
            ),
            { caretOffset: nextCaret, resetDom: true },
          );
          setRuntimeCapabilityPalette(null);
          return;
        }
      }
    }

    if (event.key !== 'Enter') {
      return;
    }
    if (event.shiftKey) {
      event.preventDefault();
      const input = composerInputRef.current;
      const selection = input
        ? getComposerSelectionOffsets(input)
        : {
            start: getComposerEditingLength(composerPartsRef.current),
            end: getComposerEditingLength(composerPartsRef.current),
          };
      const start =
        selection?.start ?? getComposerEditingLength(composerPartsRef.current);
      const end =
        selection?.end ?? getComposerEditingLength(composerPartsRef.current);
      const nextParts = replaceComposerRange(
        composerPartsRef.current,
        start,
        end,
        createComposerTextParts('\n'),
      );
      commitComposerParts(nextParts, {
        caretOffset: start + 1,
        resetDom: true,
      });
      updateRuntimeCapabilityPalette(nextParts, start + 1);
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
      if (executeSlashCommandFromDraft()) {
        return;
      }
      submitDraft(
        getBusyComposerShortcutFollowUpMode(event.metaKey || event.ctrlKey),
      );
      return;
    }

    if (executeSlashCommandFromDraft()) {
      return;
    }
    submitDraft();
  };

  const handleComposerPaste = React.useCallback(
    (event: React.ClipboardEvent<HTMLDivElement>) => {
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
        if (!pastedText) {
          return;
        }
        event.preventDefault();
        const input = composerInputRef.current;
        const selection = input
          ? getComposerSelectionOffsets(input)
          : {
              start: getComposerEditingLength(composerPartsRef.current),
              end: getComposerEditingLength(composerPartsRef.current),
            };
        const nextParts = replaceComposerRange(
          composerPartsRef.current,
          selection?.start ??
            getComposerEditingLength(composerPartsRef.current),
          selection?.end ?? getComposerEditingLength(composerPartsRef.current),
          createComposerTextParts(pastedText),
        );
        const caretOffset =
          (selection?.start ??
            getComposerEditingLength(composerPartsRef.current)) +
          pastedText.length;
        commitComposerParts(nextParts, { caretOffset, resetDom: true });
        updateRuntimeCapabilityPalette(nextParts, caretOffset);
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
      commitComposerParts,
      references,
      updateRuntimeCapabilityPalette,
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
        await stream.client.contexts.deleteFile(attachment.storageFile.id);
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
    const inputPayload: {
      input: string;
      planMode?: boolean;
      runtimeCapabilities?: RuntimeCapabilitiesSelection;
    } = {
      input: prompt,
      ...(planModeEnabled ? { planMode: true } : {}),
      ...(effectiveSessionRuntimeCapabilities
        ? { runtimeCapabilities: effectiveSessionRuntimeCapabilities }
        : {}),
    };
    const requestOptions = buildInjectedRequestOptions({
      defaults: options?.request,
      humanInput: inputPayload,
    });
    const sessionRuntimeCapabilitiesForPersistence =
      effectiveSessionRuntimeCapabilities;
    const shouldPersistSessionRuntimeCapabilities =
      !!sessionRuntimeCapabilitiesForPersistence &&
      !stream.threadId &&
      !nextFollowUpMode;

    stream.submit(
      {
        input: inputPayload,
        ...(requestOptions.state ? { state: requestOptions.state } : {}),
      },
      {
        ...(nextFollowUpMode ? { followUpMode: nextFollowUpMode } : {}),
        ...(requestOptions.context ? { context: requestOptions.context } : {}),
        ...(requestOptions.config ? { config: requestOptions.config } : {}),
        ...(shouldPersistSessionRuntimeCapabilities
          ? {
              onThreadResolved: (threadId) =>
                persistSessionRuntimeCapabilities(
                  threadId,
                  sessionRuntimeCapabilitiesForPersistence,
                ),
            }
          : {}),
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
    if (id === stream.threadId) {
      if (
        thread.status === 'interrupted' &&
        thread.recordId &&
        !stream.pendingHITLRequest
      ) {
        void loadConversationMessages(thread.recordId);
      }
      return;
    }
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
      const retryInput = {
        ...humanInput,
        ...(lastHumanMessage?.runtimeCapabilities
          ? { runtimeCapabilities: lastHumanMessage.runtimeCapabilities }
          : {}),
      };
      stream.submit(
        { input: retryInput },
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

  const streamErrorMessage =
    stream.error instanceof Error ? stream.error.message : undefined;

  const threadErrorMessage = React.useMemo(() => {
    if (streamErrorMessage?.trim()) return streamErrorMessage.trim();
    if (currentThread?.status !== 'error') return undefined;
    const message = currentThread.error?.trim();
    return message || t('thread.errorToast');
  }, [currentThread, streamErrorMessage, t]);
  const errorMessage = threadErrorMessage ? undefined : streamErrorMessage;
  const currentThreadIsRunning =
    stream.isLoading ||
    currentThread?.status === 'busy' ||
    String(currentThread?.status ?? '').toLowerCase() === 'running';
  const petAutoState = usePetAutoState({
    currentThreadStatus: currentThread?.status,
    currentThreadIsRunning,
    isClientSecretInitializing,
    isHistoryLoading,
    isStreamLoading: stream.isLoading,
    isStreamReady: stream.isReady,
    lastStreamOutputAt: lastStreamOutputAtRef.current,
    messages,
    now: streamingNow,
    threadErrorMessage,
  });
  useConversationSummaryEvent({
    parentMessenger,
    threadId: stream.threadId,
    currentThread,
    currentThreadIsRunning: stream.isLoading,
    threadErrorMessage,
    messages,
    historyMessageLoadVersion: stream.historyMessageLoadVersion ?? 0,
    fallbackTitle: t('history.threadFallback'),
  });

  const assistantTitle = assistantName || resolvedTitle;

  return (
    <div
      ref={viewportRef}
      data-chatkit-root=""
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
        <div className="flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="inline-flex h-8 w-8">
                <button
                  type="button"
                  onClick={() => setPetSettingsOpen(true)}
                  className={cn(
                    'flex h-8 w-8 cursor-pointer items-center justify-center rounded-md',
                    'text-muted-foreground hover:text-foreground hover:bg-muted',
                    'transition-colors duration-150',
                  )}
                  aria-label={t('settings.open')}
                >
                  <Settings size={16} />
                </button>
              </span>
            </TooltipTrigger>
            <TooltipContent side="bottom">{t('settings.open')}</TooltipContent>
          </Tooltip>

          {/* History controls - only shown when history.enabled is true (default) */}
          {history?.enabled !== false && (
            <>
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
            </>
          )}
        </div>
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
              const humanRuntimeCapabilityOptions =
                message.type === 'human'
                  ? (humanMessage.runtimeCapabilityOptions ??
                    getSelectedRuntimeCapabilityOptions(
                      humanMessage.runtimeCapabilities,
                      runtimeCapabilityOptions,
                    ))
                  : [];
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
                humanRuntimeCapabilityOptions.length === 0 &&
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
                          messages={messages.slice(0, index + 1).map(
                            (item) =>
                              ({
                                ...(item as ChatkitMessage),
                                type:
                                  String(item.type) === 'ai'
                                    ? 'assistant'
                                    : item.type,
                              }) as ChatkitMessage,
                          )}
                          isStreaming={isStreamingMessage}
                          streamingStatus={streamingStatus}
                          isThreadRunning={currentThreadIsRunning}
                          organizationId={stream.organizationId}
                          apiUrl={stream.apiUrl}
                        />
                      ) : (
                        <>
                          {message.type === 'human' &&
                            humanRuntimeCapabilityOptions.length > 0 && (
                              <div className="mb-2 flex flex-wrap gap-1.5">
                                {humanRuntimeCapabilityOptions.map((option) => (
                                  <span
                                    key={`${option.type}:${option.id}`}
                                    className="inline-flex max-w-full items-center gap-1 rounded-md bg-primary-foreground/20 px-2 py-1 text-xs font-medium text-primary-foreground"
                                  >
                                    <RuntimeCapabilityIcon
                                      option={option}
                                      variant="chip"
                                    />
                                    <span className="max-w-[9rem] truncate">
                                      {option.label}
                                    </span>
                                  </span>
                                ))}
                              </div>
                            )}
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

        {detachedRunRuntimeCapabilityOptions.length > 0 && (
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted-foreground">
              {t('composer.capabilities.runOnly')}
            </span>
            {detachedRunRuntimeCapabilityOptions.map((option) => (
              <span
                key={`${option.type}:${option.id}`}
                className="inline-flex max-w-full items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary"
              >
                <RuntimeCapabilityIcon option={option} variant="chip" />
                <span className="max-w-40 truncate">{option.label}</span>
                <button
                  type="button"
                  onClick={() => removeRunRuntimeCapability(option)}
                  className="rounded-full p-0.5 hover:bg-primary/15"
                  title={t('composer.capabilities.removeRunCapability')}
                  aria-label={t('composer.capabilities.removeRunCapability')}
                >
                  <X size={11} />
                </button>
              </span>
            ))}
          </div>
        )}

        <PendingRuntimeServices
          state={stream.runtimeActivities.sandboxServices}
          onStopService={(serviceId) =>
            stream.stopRuntimeActivityItem('sandbox-services', serviceId)
          }
          attachToComposer={!hasPendingTodos && !hasPendingFollowUps}
          className={
            hasPendingTodos || hasPendingFollowUps ? 'mb-2' : undefined
          }
        />

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

        <RequestUserInputPanel
          request={stream.pendingRequestUserInput}
          onSubmit={stream.submitRequestUserInput}
          onDismiss={stream.stop}
          attachToComposer
        />

        <HITLApprovalPanel
          request={stream.pendingHITLRequest}
          onSubmit={stream.submitHITLDecision}
          onDismiss={stream.stop}
          attachToComposer
        />

        {runtimeCapabilityPalette && (
          <SlashPalette
            palette={runtimeCapabilityPalette}
            options={slashPaletteOptions}
            paletteRef={slashPaletteRef}
            optionRefs={slashPaletteOptionRefs}
            panelRoundedClass={getPanelRoundedClass(theme.radius)}
            itemRoundedClass={getMenuItemRoundedClass(theme.radius)}
            emptyLabel={slashPaletteEmptyLabel}
            capabilityEmptyLabels={slashPaletteCapabilityEmptyLabels}
            onSelect={selectSlashPaletteOption}
          />
        )}

        <form className="flex items-end" onSubmit={handleSubmit}>
          <div
            data-slot="composer-input-shell"
            data-layout={isComposerStacked ? 'stacked' : 'inline'}
            className={cn(
              'relative flex flex-1 overflow-hidden',
              'bg-background border border-border shadow-sm',
              isComposerStacked
                ? 'min-h-[5.5rem] px-1.5 pt-1.5 pb-12'
                : 'min-h-12 px-1.5 py-1',
              'focus-within:border-muted-foreground/30 focus-within:shadow-md',
              'transition-[min-height,padding,border-radius,box-shadow,border-color] duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)]',
              composerInputRoundedClass,
            )}
          >
            <div
              key={composerDomVersion}
              ref={composerInputRef}
              role="textbox"
              aria-multiline="true"
              aria-disabled={
                missingConfig ||
                isHistoryLoading ||
                hasPendingInteractiveRequest
              }
              contentEditable={
                !(
                  missingConfig ||
                  isHistoryLoading ||
                  hasPendingInteractiveRequest
                )
              }
              suppressContentEditableWarning
              onInput={handleComposerInput}
              onCompositionEnd={handleComposerCompositionEnd}
              onSelect={handleComposerSelect}
              onPaste={handleComposerPaste}
              onKeyDown={handleComposerKeyDown}
              data-placeholder={inputPlaceholder}
              className={cn(
                'min-h-8 max-h-32 w-full overflow-hidden whitespace-pre-wrap break-words bg-transparent text-sm leading-5 text-foreground outline-none transition-[padding,min-height] duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)]',
                isComposerStacked ? 'px-2 py-1.5' : 'py-1 pr-11 pl-11 mt-1',
                'empty:before:pointer-events-none empty:before:text-muted-foreground empty:before:content-[attr(data-placeholder)]',
                (missingConfig ||
                  isHistoryLoading ||
                  hasPendingInteractiveRequest) &&
                  'cursor-not-allowed opacity-50',
              )}
            >
              {renderedComposerParts.map((part, index) =>
                part.type === 'text' ? (
                  <React.Fragment key={`text-${index}`}>
                    {part.text}
                  </React.Fragment>
                ) : (
                  <span
                    key={part.key}
                    data-composer-capability-key={part.key}
                    data-capability-type={part.capability.type}
                    data-capability-id={part.capability.id}
                    contentEditable={false}
                    className="mx-0.5 inline-flex max-w-[14rem] select-none items-center gap-1 text-sm font-semibold text-primary align-baseline"
                  >
                    <RuntimeCapabilityIcon
                      option={part.capability}
                      variant="chip"
                    />
                    <span className="truncate">{part.capability.label}</span>
                  </span>
                ),
              )}
            </div>
            <div
              data-slot="composer-action-bar"
              className="pointer-events-none absolute inset-x-1.5 bottom-1 flex min-h-10 items-center justify-between gap-2"
            >
              <div className="pointer-events-none flex min-w-0 flex-1 items-center gap-1.5">
                <div className="pointer-events-auto flex shrink-0 items-center gap-1.5">
                  {/* Plus button inside input - left side */}
                  <ComposerMenu
                    composer={composer}
                    onAttachmentClick={handleAttachmentClick}
                    onToolSelect={handleToolSelect}
                    selectedTool={selectedTool}
                    planModeEnabled={planModeEnabled}
                    onPlanModeChange={setPlanModeEnabled}
                    runtimeCapabilities={
                      runtimeCapabilitiesReady ? runtimeCapabilities : null
                    }
                    selectedRuntimeCapabilities={
                      effectiveSessionRuntimeCapabilities
                    }
                    onRuntimeCapabilityToggle={
                      handleSessionRuntimeCapabilityToggle
                    }
                    disabled={
                      missingConfig ||
                      isHistoryLoading ||
                      hasPendingInteractiveRequest
                    }
                  />
                </div>

                {selectedTool && (
                  <span className="pointer-events-auto inline-flex h-8 min-w-0 max-w-[14rem] shrink items-center gap-1.5 rounded-full bg-primary/10 px-2 text-xs font-medium text-primary transition-all duration-200">
                    <span className="truncate">
                      {selectedTool.shortLabel ?? selectedTool.label}
                    </span>
                    <button
                      type="button"
                      onClick={() => setSelectedTool(null)}
                      className="shrink-0 rounded-full p-0.5 text-primary/70 hover:bg-primary/10 hover:text-primary"
                    >
                      <X size={12} />
                    </button>
                  </span>
                )}
              </div>

              <div className="pointer-events-auto shrink-0">
                <SendButton
                  disabled={isSendDisabled}
                  isLoading={stream.isLoading}
                  showStop={
                    stream.isLoading &&
                    (!trimmedDraft || hasPendingInteractiveRequest)
                  }
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
            </div>
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
      <SettingsSheet
        open={petSettingsOpen}
        settings={displayedPetSettings}
        petRequired={petRequired}
        onOpenChange={setPetSettingsOpen}
        onSave={savePetLocalSettings}
      />
      <PetBridge pet={effectivePet} state={petAutoState} />
    </div>
  );
}
