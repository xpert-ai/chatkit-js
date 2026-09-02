import * as React from 'react';
import {
  ArrowDown,
  ChevronDown,
  FileText,
  ImageIcon,
  Loader2,
  MessageSquarePlus,
  Minus,
  Pause,
  Pencil,
  Play,
  Quote,
  Settings,
  Target,
  Trash2,
  X,
} from 'lucide-react';

import type {
  AssistantModelsResponse,
  Message,
  XpertWorkspaceFile,
} from '@xpert-ai/xpert-sdk';
import type {
  ChatkitMessage,
  ChatKitImageReference,
  ChatKitOptions,
  ChatKitReference,
  ChatKitReferenceCompositionMode,
  ChatKitCommandSource,
  ModelOption,
  ToolOption,
  ThreadGoal,
  ChatKitGoalAdapter,
  ChatTaskSummaryOpenResourceEffect,
  ChatTaskSummaryResourceReference,
} from '@xpert-ai/chatkit-types';
import { CHATKIT_TASK_SUMMARY_OPEN_RESOURCE_EFFECT } from '@xpert-ai/chatkit-types';

import {
  cn,
  createMessageId,
  getMenuItemRoundedClass,
  getPanelRoundedClass,
} from '../lib/utils';
import {
  getAssistantStreamingStatus,
  hasRenderableAssistantMessage,
} from '../lib/message';
import { isNearBottom } from '../lib/scroll';
import { type AgentFile, type StorageFile } from '../lib/types';
import { useStreamContext } from '../providers/Stream';
import { ComposerMenu } from './composer/ComposerMenu';
import { ModelPicker } from './composer/ModelPicker';
import {
  WorkspaceFileMentionPalette,
  getWorkspaceFilePath,
  type WorkspaceFileMentionPaletteHandle,
} from './composer/WorkspaceFileMentionPalette';
import { ProjectSelector } from './composer/ProjectSelector';
import { SendButton } from './composer/SendButton';
import { SlashPalette } from './composer/SlashPalette';
import { HistorySidebar } from './history/HistorySidebar';
import { PendingFollowUps } from './composer/pending-follow-ups';
import { PendingRuntimeServices } from './composer/pending-runtime-services';
import { PendingTodos } from './composer/pending-todos';
import { HITLApprovalPanel } from './composer/hitl-approval-panel';
import { RequestUserInputPanel } from './composer/request-user-input-panel';
import { useConversationSummaryEvent } from './chat/useConversationSummaryEvent';
import {
  ChatAttachments,
  type AttachmentFileStatus,
  type ChatAttachmentFile,
  type ChatAttachmentsHandle,
  type ChatAttachmentsState,
} from './chat/attachments';
import { UploadDroppedFiles } from './chat/upload-dropped-files';
import { getVisibleHumanAttachments } from './chat/message-files';
import { usePetAutoState } from './chat/usePetAutoState';
import { useSlashCommands } from './chat/useSlashCommands';
import {
  AssistantMessage,
  AssistantStreamingIndicator,
} from './thread/messages/ai';
import { MessageNavigator } from './thread/MessageNavigator';
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
import { sortVisiblePendingFollowUps } from '../lib/follow-ups';
import {
  normalizeModelOptions,
  resolveSelectedModelId,
} from '../lib/assistant-models';
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
  getRecommendedRuntimeCapabilitiesSelection,
  type RuntimeCapabilitiesSelection,
  type RuntimeCapabilityOption,
} from '../lib/runtime-capabilities';
import {
  executeThreadGoalCommand,
  loadThreadGoal,
  parseGoalCommand,
} from '../lib/thread-goals';
import {
  createXpertThreadGoalAdapter,
  supportsXpertThreadGoalAdapter,
} from '../lib/xpert-thread-goal-adapter';
import { withConnectorBindingIds } from '../lib/conversation-connectors';
import {
  createComposerTextParts,
  findAdjacentComposerCapability,
  getComposerCapabilityPartMap,
  getComposerEditingLength,
  getComposerPlainText,
  getComposerSelectionOffset,
  getComposerSelectionOffsets,
  normalizeComposerParts,
  readComposerPartsFromElement,
  replaceComposerRange,
  setComposerSelectionOffset,
  type ComposerPart,
} from '../lib/composer-parts';
import { hasSelectedRuntimeSlashCommand } from '../lib/slash-commands';
import { WorkbenchToggleButton, useWorkbench } from '../workbench/context';
import {
  ComposerCapabilityToken,
  DetachedRunRuntimeCapabilities,
  HumanRuntimeCapabilityChips,
  getRemovedComposerCapabilityParts,
  getRuntimeCapabilityOptionsForSelection,
  getRuntimeCapabilityPaletteEmptyLabelKey,
  removeComposerCapabilityPartsFromSelection,
  useRuntimeCapabilitiesState,
  useRuntimeCapabilityComposerActions,
} from './chat/runtime-capabilities';
import {
  buildMessageNavigationItems,
  getMessageNavigationItemId,
  MESSAGE_NAVIGATION_MIN_ITEMS,
  type MessageNavigationItem,
  type MessageNavigationLabels,
  type MessageNavigationSourceMessage,
} from '../lib/message-navigation';
import {
  collectLiveTaskSummary,
  type TaskSummaryMessage,
  type TaskSummaryPending,
  type TaskSummaryRuntimeItem,
} from '../lib/task-summary';
import { useTaskSummary } from '../hooks/useTaskSummary';
import {
  TaskSummaryPanel,
  TaskSummaryTrigger,
  type TaskSummaryProps,
} from './task-summary/TaskSummary';

export type ChatProps = {
  className?: string;
  title?: string;
  placeholder?: string;
  clientSecret?: string;
  options?: ChatKitOptions | null;
  isClientSecretInitializing?: boolean;
  surface?: 'main' | 'side';
  referenceRequest?: ChatReferenceRequest | null;
  activeProjectId?: string;
  projectsEnabled?: boolean;
  connectorsEnabled?: boolean;
  onProjectChange?: (projectId: string | null) => void;
  onProjectCreate?: (name: string) => void;
  onConnectorsChange?: (connectorBindingIds: string[]) => void;
};

export type ChatReferenceRequest = {
  id: string;
  reference: ChatKitReference;
};

const defaultApiUrl = import.meta.env.VITE_XPERTAI_API_URL as
  | string
  | undefined;
const COMPOSER_INPUT_MAX_HEIGHT = 128;
const LONG_TEXT_REFERENCE_THRESHOLD = 5000;
const GOAL_RUN_INPUT = 'Continue working toward the active goal.';
const TASK_SUMMARY_PANEL_WIDTH_REM = 20;
const TASK_SUMMARY_PANEL_EDGE_INSET_REM = 1.25;
const TASK_SUMMARY_PANEL_SAFE_GAP_REM = 0.75;

function toError(value: unknown): Error {
  return value instanceof Error ? value : new Error(String(value));
}

function isGoalAdapter(value: unknown): value is ChatKitGoalAdapter {
  return (
    Boolean(value) &&
    typeof value === 'object' &&
    typeof (value as Partial<ChatKitGoalAdapter>).getGoal === 'function' &&
    typeof (value as Partial<ChatKitGoalAdapter>).setGoal === 'function' &&
    typeof (value as Partial<ChatKitGoalAdapter>).updateGoal === 'function' &&
    typeof (value as Partial<ChatKitGoalAdapter>).clearGoal === 'function'
  );
}

function formatGoalElapsed(seconds: number): string {
  if (seconds < 60) {
    return `${seconds}s`;
  }
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return remainingSeconds ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`;
}

type UploadedMessageFile = ChatAttachmentFile;

type HumanMessageWithMeta = Message & {
  attachments?: UploadedMessageFile[];
  fileAssets?: UploadedMessageFile[];
  references?: ChatKitReference[];
  submittedInput?: string;
  referenceComposition?: ChatKitReferenceCompositionMode;
  runtimeCapabilities?: RuntimeCapabilitiesSelection;
  runtimeCapabilityOptions?: RuntimeCapabilityOption[];
  model?: string;
};

type QuoteSelectionState = {
  reference: ChatKitReference;
  top: number;
  left: number;
};

type WorkspaceFileMentionState = {
  start: number;
  end: number;
  query: string;
};

type SubmitDraftOptions = {
  inputText?: string;
  displayText?: string;
  commandSource?: ChatKitCommandSource;
  runtimeCapabilities?: RuntimeCapabilitiesSelection;
  planMode?: boolean;
};

function getWorkspaceFileMention(
  text: string,
  caretOffset: number,
): WorkspaceFileMentionState | null {
  const beforeCaret = text.slice(0, caretOffset);
  const mentionStart = beforeCaret.lastIndexOf('@');
  if (mentionStart < 0) return null;

  const precedingCharacter = beforeCaret[mentionStart - 1];
  if (precedingCharacter && !/\s/.test(precedingCharacter)) return null;

  const query = beforeCaret.slice(mentionStart + 1);
  if (/[\n，,。！？!?]/.test(query)) return null;

  return { start: mentionStart, end: caretOffset, query };
}

function toReferencedWorkspaceFile(
  file: XpertWorkspaceFile,
): ChatAttachmentFile {
  const filePath = getWorkspaceFilePath(file);
  return {
    filePath,
    workspacePath: filePath,
    originalName: file.filePath,
    mimeType: file.mimeType,
    size: file.size,
    purpose: 'workspace',
  };
}

function mergeSubmittedFiles(
  uploadedFiles: ChatAttachmentFile[],
  referencedFiles: ChatAttachmentFile[],
): ChatAttachmentFile[] {
  const filesById = new Map<string, ChatAttachmentFile>();
  [...uploadedFiles, ...referencedFiles].forEach((file) => {
    const id =
      file.fileAssetId ??
      file.fileId ??
      file.id ??
      file.storageFileId ??
      file.workspacePath;
    if (id) filesById.set(id, file);
  });
  return Array.from(filesById.values());
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

function getUploadedFileUrl(file: AgentFile | StorageFile): string | undefined {
  return file.url ?? file.fileUrl ?? file.thumbUrl;
}

function buildPastedImageReference(
  file: File,
  uploadedFile: AgentFile,
  dimensions?: { width?: number; height?: number },
): ChatKitImageReference {
  const name =
    uploadedFile.originalName?.trim() || file.name.trim() || 'Pasted image';
  const mimeType =
    uploadedFile.mimeType?.trim() || file.type.trim() || 'image/*';
  const size = uploadedFile.size ?? file.size;
  const width = dimensions?.width;
  const height = dimensions?.height;
  const metaParts = [
    mimeType,
    width && height ? `${width}x${height}` : null,
    typeof size === 'number' ? `${size} bytes` : null,
  ].filter((part): part is string => Boolean(part));

  return {
    type: 'image',
    id: uploadedFile.id,
    fileId: uploadedFile.storageFileId,
    url: getUploadedFileUrl(uploadedFile),
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

function WorkspaceFileChip({
  file,
  onRemove,
  removeLabel,
}: {
  file: ChatAttachmentFile;
  onRemove: () => void;
  removeLabel: string;
}) {
  const label =
    file.originalName ??
    file.workspacePath ??
    file.id ??
    file.fileAssetId ??
    'File';
  const meta = file.workspacePath ?? file.mimeType;

  return (
    <div
      data-slot="workspace-file-reference"
      className="flex min-w-0 items-start gap-2 rounded-md bg-muted px-2 py-1 text-foreground"
      title={label}
    >
      <FileText className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm">{label}</div>
        {meta ? (
          <div className="truncate text-xs text-muted-foreground">{meta}</div>
        ) : null}
      </div>
      <button
        type="button"
        onClick={onRemove}
        className="ml-1 rounded-full p-0.5 hover:bg-muted-foreground/20"
        title={removeLabel}
        aria-label={removeLabel}
      >
        <X size={12} />
      </button>
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
  surface = 'main',
  referenceRequest,
  activeProjectId,
  projectsEnabled = false,
  connectorsEnabled = false,
  onProjectChange,
  onProjectCreate,
  onConnectorsChange,
}: ChatProps) {
  const { t, i18n } = useChatkitTranslation();
  const composer = options?.composer;
  const startScreen = options?.startScreen;
  const history = options?.history;
  const disclaimer = options?.disclaimer;
  const apiUrl = options?.api?.apiUrl || defaultApiUrl;
  const messageNavigationEnabled =
    options?.messageNavigation?.enabled !== false;
  const { setStream } = useStreamManager();
  const stream = useStreamContext();
  const workbench = useWorkbench();
  const xpertPlatformClient = stream.client;
  const { theme } = useTheme();
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

  const [isHistoryLoading, setIsHistoryLoading] = React.useState(false);
  const [historyError, setHistoryError] = React.useState<string | null>(null);
  const [assistantName, setAssistantName] = React.useState<string | null>(null);
  const [assistantAvatar, setAssistantAvatar] =
    React.useState<ChatkitAvatarData | null>(null);
  const [threadGoal, setThreadGoal] = React.useState<ThreadGoal | null>(null);
  const [goalError, setGoalError] = React.useState<string | null>(null);
  const [isGoalLoading, setIsGoalLoading] = React.useState(false);
  const [isGoalPanelOpen, setIsGoalPanelOpen] = React.useState(false);
  const [isGoalObjectiveExpanded, setIsGoalObjectiveExpanded] =
    React.useState(false);
  const [goalElapsedStartedAt, setGoalElapsedStartedAt] = React.useState<
    number | null
  >(null);

  // Minimum loading dots display time (ms)
  const LOADING_DOTS_MIN_DURATION = 800;
  const STREAMING_STATUS_REFRESH_MS = 250;
  const [showLoadingDots, setShowLoadingDots] = React.useState(false);
  const [streamingNow, setStreamingNow] = React.useState(() => Date.now());
  const loadingStartTimeRef = React.useRef<number | null>(null);
  const lastStreamOutputAtRef = React.useRef<number | null>(null);

  React.useEffect(() => {
    if (surface === 'main') setStream(stream);
  }, [setStream, stream, surface]);

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

  React.useEffect(() => {
    if (threadGoal?.status === 'active' && stream.isLoading) {
      setGoalElapsedStartedAt(Date.now());
      return;
    }
    setGoalElapsedStartedAt(null);
  }, [
    stream.isLoading,
    threadGoal?.elapsedSeconds,
    threadGoal?.id,
    threadGoal?.status,
  ]);

  React.useEffect(() => {
    setIsGoalObjectiveExpanded(false);
  }, [threadGoal?.id]);

  const [composerParts, setComposerParts] = React.useState<ComposerPart[]>([]);
  const [renderedComposerParts, setRenderedComposerParts] = React.useState<
    ComposerPart[]
  >([]);
  const [composerDomVersion, setComposerDomVersion] = React.useState(0);
  const [selectedTool, setSelectedTool] = React.useState<ToolOption | null>(
    null,
  );
  const [availableModels, setAvailableModels] = React.useState<ModelOption[]>(
    [],
  );
  const [hostedModelCatalog, setHostedModelCatalog] =
    React.useState<AssistantModelsResponse | null>(null);
  const modelAssistantId = stream.assistantId;
  const modelClient = stream.client;
  const selectedModelId = stream.selectedModelId;
  const setSelectedModelId = stream.setSelectedModelId;
  const selectedModelIdRef = React.useRef(selectedModelId);
  selectedModelIdRef.current = selectedModelId;
  const requestedModelIdRef = React.useRef<string | null | undefined>(
    undefined,
  );
  const modelAssistantIdRef = React.useRef(modelAssistantId);
  const [planModeEnabled, setPlanModeEnabled] = React.useState(false);
  const [petSettingsOpen, setPetSettingsOpen] = React.useState(false);
  const [hasSelectableProjects, setHasSelectableProjects] =
    React.useState(false);
  const [petLocalSettings, setPetLocalSettings] =
    React.useState<PetLocalSettings | null>(() => readPetLocalSettings());
  const [attachmentState, setAttachmentState] =
    React.useState<ChatAttachmentsState>({
      uploadedFiles: [],
      hasUploadingFiles: false,
      hasParsingFiles: false,
    });
  const [references, setReferences] = React.useState<ChatKitReference[]>([]);
  const [referencedWorkspaceFiles, setReferencedWorkspaceFiles] =
    React.useState<ChatAttachmentFile[]>([]);
  const [workspaceFileMention, setWorkspaceFileMention] =
    React.useState<WorkspaceFileMentionState | null>(null);
  const [isUploadingReferenceImages, setIsUploadingReferenceImages] =
    React.useState(false);
  const [quoteSelection, setQuoteSelection] =
    React.useState<QuoteSelectionState | null>(null);
  const [isOpeningSideChat, setIsOpeningSideChat] = React.useState(false);
  const [sideChatError, setSideChatError] = React.useState<string | null>(null);
  const [isAtBottom, setIsAtBottom] = React.useState(true);
  const [hasUpdatesBelow, setHasUpdatesBelow] = React.useState(false);
  const {
    threads,
    deleteThread,
    refreshThreads,
    isLoading: isThreadsLoading,
  } = useThreads(undefined, surface === 'main' && history?.enabled !== false);
  const viewportRef = React.useRef<HTMLDivElement>(null);
  const chatColumnRef = React.useRef<HTMLDivElement>(null);
  const messageNavigationAnchorsRef = React.useRef(
    new Map<string, HTMLDivElement>(),
  );
  const attachmentsRef = React.useRef<ChatAttachmentsHandle>(null);
  const composerInputRef = React.useRef<HTMLDivElement>(null);
  const appliedReferenceRequestRef = React.useRef<string | null>(null);
  const goalRequestIdRef = React.useRef(0);
  const goalAbortControllerRef = React.useRef<AbortController | null>(null);
  const activeProjectIdRef = React.useRef(activeProjectId);
  activeProjectIdRef.current = activeProjectId;
  const isComposerComposingRef = React.useRef(false);
  const slashPaletteRef = React.useRef<HTMLDivElement>(null);
  const slashPaletteOptionRefs = React.useRef<Array<HTMLButtonElement | null>>(
    [],
  );
  const workspaceFileMentionPaletteRef =
    React.useRef<WorkspaceFileMentionPaletteHandle>(null);
  const composerPartsRef = React.useRef<ComposerPart[]>([]);
  const pendingComposerCaretOffsetRef = React.useRef<number | null>(null);
  const shouldAutoScrollRef = React.useRef(true);
  const forceFollowRef = React.useRef(false);
  const previousMessageCountRef = React.useRef(0);
  const previousScrollTopRef = React.useRef(0);
  const isPrependingHistoryMessagesRef = React.useRef(false);
  const autoScrollFrameRef = React.useRef<number | null>(null);
  const isPointerDownRef = React.useRef(false);
  const lastTouchYRef = React.useRef<number | null>(null);
  const {
    runtimeCapabilities,
    runtimeCapabilitiesReady,
    runtimeCapabilityOptions,
    effectiveSessionRuntimeCapabilities,
    runRuntimeCapabilities,
    detachedRunRuntimeCapabilityOptions,
    runtimeCapabilityPalette,
    setRunRuntimeCapabilities,
    setRuntimeCapabilityPalette,
    applyExternalRuntimeCapabilities,
    handleSessionRuntimeCapabilityToggle,
    addRunRuntimeCapabilities,
    resetRunRuntimeCapabilities,
    getRuntimeCapabilitiesForSubmit,
    getRuntimeCapabilitiesForCommand,
    persistSessionRuntimeCapabilities,
  } = useRuntimeCapabilitiesState({
    client: stream.client,
    assistantId: stream.assistantId,
    projectId: activeProjectId,
    threadId: stream.threadId,
    disabled: missingConfig || !stream.client || !stream.assistantId,
    composerParts,
  });

  const resolvedTitle = title ?? t('chat.title');
  const resolvedPlaceholder = placeholder ?? t('chat.placeholder');
  const assistantTitle = assistantName || resolvedTitle;
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
  const isInitialComposer =
    messages.length === 0 && !canLoadMoreMessages && !stream.isLoading;
  const draft = React.useMemo(
    () => getComposerPlainText(composerParts),
    [composerParts],
  );
  const trimmedDraft = draft.trim();
  const hasReferences =
    references.length > 0 || referencedWorkspaceFiles.length > 0;
  const referencedWorkspaceFilePaths = React.useMemo(
    () =>
      new Set(
        referencedWorkspaceFiles.flatMap((file) => {
          const filePath = file.workspacePath ?? file.filePath;
          return filePath ? [filePath] : [];
        }),
      ),
    [referencedWorkspaceFiles],
  );
  const hasCompletedGoal = threadGoal?.status === 'complete';
  const isGoalModeOpen = isGoalPanelOpen;
  const pendingFollowUps = React.useMemo(
    () => sortVisiblePendingFollowUps(stream.pendingFollowUps ?? []),
    [stream.pendingFollowUps],
  );
  const hasPendingFollowUps = pendingFollowUps.length > 0;
  const hasPendingRequestUserInput = Boolean(stream.pendingRequestUserInput);
  const hasPendingHITLRequest = Boolean(stream.pendingHITLRequest);
  const hasPendingInteractiveRequest =
    hasPendingRequestUserInput || hasPendingHITLRequest;
  const isProjectSelectionLocked =
    Boolean(stream.threadId || stream.conversationId) ||
    messages.length > 0 ||
    canLoadMoreMessages;
  const isConfiguredProjectLocked =
    options?.composer?.projects?.locked === true && Boolean(activeProjectId);
  const isProjectSelectorVisible =
    projectsEnabled &&
    (isConfiguredProjectLocked ||
      (!isProjectSelectionLocked && hasSelectableProjects));
  const hasPendingTodos = Boolean(stream.todos?.items.length);
  const goalAdapter = React.useMemo<ChatKitGoalAdapter | null>(() => {
    if (surface !== 'main') return null;
    if (isGoalAdapter(options?.goal)) {
      return options.goal;
    }
    return supportsXpertThreadGoalAdapter(stream.client)
      ? createXpertThreadGoalAdapter(stream.client, {
          xpertId: stream.assistantId,
          projectId: activeProjectId,
        })
      : null;
  }, [
    activeProjectId,
    options?.goal,
    stream.assistantId,
    stream.client,
    surface,
  ]);
  const displayedGoalElapsedSeconds = threadGoal
    ? (threadGoal.elapsedSeconds ?? 0) +
      (goalElapsedStartedAt
        ? Math.max(0, Math.floor((streamingNow - goalElapsedStartedAt) / 1000))
        : 0)
    : 0;
  const goalCommandAvailable = hasSelectedRuntimeSlashCommand(
    surface === 'main' ? runtimeCapabilities : null,
    surface === 'main' ? effectiveSessionRuntimeCapabilities : null,
    'goal',
  );
  const showGoalStatus =
    goalCommandAvailable &&
    !hasCompletedGoal &&
    (Boolean(goalError) ||
      (threadGoal?.status === 'active' && stream.isLoading));

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
        const removedCapabilities = getRemovedComposerCapabilityParts(
          previous,
          normalized,
        );

        if (removedCapabilities.length > 0) {
          setRunRuntimeCapabilities((selection) =>
            removeComposerCapabilityPartsFromSelection(
              selection,
              removedCapabilities,
            ),
          );
        }
      }

      setComposerParts(normalized);
      if (options?.resetDom) {
        setRenderedComposerParts(normalized);
        setComposerDomVersion((version) => version + 1);
      }
    },
    [setRunRuntimeCapabilities],
  );

  const handleProjectSelectionChange = React.useCallback(
    (projectId: string | null) => {
      const textParts = composerPartsRef.current.filter(
        (part) => part.type === 'text',
      );
      commitComposerParts(textParts, {
        resetDom: true,
        syncRemovedCapabilityTokens: false,
      });
      attachmentsRef.current?.clear();
      setReferences([]);
      setReferencedWorkspaceFiles([]);
      setWorkspaceFileMention(null);
      setSelectedTool(null);
      resetRunRuntimeCapabilities();
      void stream.setConnectorBindingIds([]).catch((persistError) => {
        console.warn(
          '[Chat] Failed to clear connector selection before changing project:',
          persistError,
        );
      });
      onConnectorsChange?.([]);
      onProjectChange?.(projectId);
    },
    [
      commitComposerParts,
      onProjectChange,
      onConnectorsChange,
      resetRunRuntimeCapabilities,
      stream,
    ],
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

  React.useEffect(() => {
    if (
      !referenceRequest ||
      appliedReferenceRequestRef.current === referenceRequest.id
    ) {
      return;
    }
    appliedReferenceRequestRef.current = referenceRequest.id;
    setReferences((previous) =>
      mergeReferences(previous, [referenceRequest.reference]),
    );
    requestAnimationFrame(() => composerInputRef.current?.focus());
  }, [referenceRequest]);

  const {
    applyComposerValueRuntimeCapabilities,
    updateRuntimeCapabilityPalette,
    removeRunRuntimeCapability,
    insertComposerCapabilityToken,
  } = useRuntimeCapabilityComposerActions({
    runtimeCapabilities,
    runtimeCapabilitiesReady,
    runtimeCapabilityOptions,
    setRunRuntimeCapabilities,
    setRuntimeCapabilityPalette,
    applyExternalRuntimeCapabilities,
    composerInputRef,
    composerPartsRef,
    commitComposerParts,
    focusComposerAt,
  });

  const handleSetComposerValue = React.useCallback(
    (payload: ComposerValuePayload | null) => {
      if (!payload) return;
      const shouldInsertRuntimeCapabilitiesBeforeText =
        typeof payload.text === 'string' &&
        payload.insertRuntimeCapabilities === true;

      if (typeof payload.text === 'string') setComposerText(payload.text);
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
      if (payload.selectedModelId !== undefined) {
        requestedModelIdRef.current = payload.selectedModelId;
        setSelectedModelId?.(
          availableModels.length
            ? resolveSelectedModelId(availableModels, payload.selectedModelId)
            : payload.selectedModelId,
        );
      }
      applyComposerValueRuntimeCapabilities(
        payload,
        shouldInsertRuntimeCapabilitiesBeforeText ? { insertAt: 0 } : undefined,
      );
    },
    [
      applyComposerValueRuntimeCapabilities,
      availableModels,
      composer?.tools,
      setComposerText,
      setSelectedModelId,
    ],
  );
  const handleSetRuntimeCapabilities = React.useCallback(
    (selection: RuntimeCapabilitiesSelection | null) => {
      applyExternalRuntimeCapabilities(selection);
    },
    [applyExternalRuntimeCapabilities],
  );
  const handleFocusComposer = React.useCallback(() => {
    composerInputRef.current?.focus();
  }, []);
  const handleSetPetEnabled = React.useCallback(
    (enabled: boolean) => {
      if (petRequired) return;
      savePetLocalSettings({ ...displayedPetSettings, enabled });
    },
    [displayedPetSettings, petRequired, savePetLocalSettings],
  );
  const parentMessenger = useParentMessenger(
    surface === 'main'
      ? {
          onSetComposerValue: handleSetComposerValue,
          onSetRuntimeCapabilities: handleSetRuntimeCapabilities,
          onFocusComposer: handleFocusComposer,
          onSetPetEnabled: handleSetPetEnabled,
        }
      : {},
  );
  const sendParentEvent = parentMessenger?.sendEvent;

  React.useEffect(() => {
    if (modelAssistantIdRef.current !== modelAssistantId) {
      modelAssistantIdRef.current = modelAssistantId;
      requestedModelIdRef.current = undefined;
    }

    if (composer?.models !== undefined) {
      const models = normalizeModelOptions(composer.models);
      setAvailableModels(models);
      setHostedModelCatalog(null);
      setSelectedModelId?.(
        resolveSelectedModelId(
          models,
          requestedModelIdRef.current === undefined
            ? selectedModelIdRef.current
            : requestedModelIdRef.current,
        ),
      );
      return;
    }

    setAvailableModels([]);
    setHostedModelCatalog(null);
    setSelectedModelId?.(null);
    if (missingConfig || !modelAssistantId) return;

    const assistants = modelClient.assistants;
    if (typeof assistants?.getModels !== 'function') return;

    const abortController = new AbortController();
    void assistants
      .getModels(modelAssistantId, { signal: abortController.signal })
      .then((response) => {
        if (abortController.signal.aborted) return;
        const models = normalizeModelOptions(response.models);
        setAvailableModels(models);
        setHostedModelCatalog({ ...response, models });
        const requestedModelId = requestedModelIdRef.current;
        setSelectedModelId?.(
          requestedModelId === undefined
            ? response.selected_model_id
              ? resolveSelectedModelId(models, response.selected_model_id)
              : null
            : requestedModelId === null
              ? (models.find((model) => model.default && !model.disabled)?.id ??
                null)
              : resolveSelectedModelId(models, requestedModelId),
        );
      })
      .catch((error) => {
        if (abortController.signal.aborted) return;
        if (
          error !== null &&
          typeof error === 'object' &&
          Reflect.get(error, 'status') === 404
        ) {
          return;
        }
        sendParentEvent?.('public_event', ['error', { error: toError(error) }]);
      });

    return () => abortController.abort();
  }, [
    composer?.models,
    missingConfig,
    modelAssistantId,
    modelClient,
    sendParentEvent,
    setSelectedModelId,
  ]);

  const handleModelSelect = React.useCallback(
    (modelId: string) => {
      const nextModelId = resolveSelectedModelId(availableModels, modelId);
      if (!nextModelId) return;

      requestedModelIdRef.current = nextModelId;
      setSelectedModelId?.(nextModelId);
      if (!hostedModelCatalog?.preference_persistable) return;

      const assistants = modelClient.assistants;
      if (typeof assistants?.setModelPreference !== 'function') return;

      void assistants
        .setModelPreference(modelAssistantId, nextModelId)
        .catch((error) => {
          sendParentEvent?.('public_event', [
            'error',
            { error: toError(error) },
          ]);
        });
    },
    [
      availableModels,
      hostedModelCatalog?.preference_persistable,
      modelAssistantId,
      modelClient,
      sendParentEvent,
      setSelectedModelId,
    ],
  );
  const canMinimizeToPet =
    parentMessenger?.isParentAvailable === true && isPetEnabled(effectivePet);
  const handleMinimizeToPet = React.useCallback(() => {
    parentMessenger?.sendEvent('chat_minimize_change', { minimized: true });
  }, [parentMessenger]);

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

  const taskSummaryEnabled = options?.taskSummary?.enabled === true;
  const taskSummaryConversationId = stream.conversationId ?? null;
  const [taskSummaryDocked, setTaskSummaryDocked] = React.useState(false);
  const [taskSummaryOpen, setTaskSummaryOpen] = React.useState(false);
  const manuallyClosedTaskSummaryConversationIdsRef = React.useRef(
    new Set<string>(),
  );
  const liveTaskSummaryPending = React.useMemo<TaskSummaryPending[]>(() => {
    const followUps = pendingFollowUps.map((item) => ({
      id: `follow-up:${item.id}`,
      kind: 'follow_up' as const,
      title:
        item.mode === 'steer'
          ? t('taskSummary.pending.steer')
          : t('taskSummary.pending.followUp'),
      messageId: item.clientMessageId,
      createdAt: new Date(item.createdAt).toISOString(),
    }));
    const userInput = stream.pendingRequestUserInput
      ? [
          {
            id: `user-input:${stream.pendingRequestUserInput.id}`,
            kind: 'user_input' as const,
            title:
              stream.pendingRequestUserInput.params.questions[0]?.header ||
              t('taskSummary.pending.userInput'),
            createdAt: new Date(
              stream.pendingRequestUserInput.createdAt,
            ).toISOString(),
          },
        ]
      : [];
    const approvals = stream.pendingHITLRequest
      ? [
          {
            id: `approval:${stream.pendingHITLRequest.id}`,
            kind: 'approval' as const,
            title: t('taskSummary.pending.approval'),
            createdAt: new Date(
              stream.pendingHITLRequest.createdAt,
            ).toISOString(),
          },
        ]
      : [];
    return [...approvals, ...userInput, ...followUps];
  }, [
    pendingFollowUps,
    stream.pendingHITLRequest,
    stream.pendingRequestUserInput,
    t,
  ]);
  const liveTaskSummaryRunning = React.useMemo<TaskSummaryRuntimeItem[]>(
    () =>
      stream.runtimeActivities.sandboxServices.services
        .filter(
          (service) =>
            service.status === 'starting' ||
            service.status === 'running' ||
            service.status === 'stopping',
        )
        .map((service) => ({
          id:
            service.id ??
            `${service.provider}:${service.name}:${service.actualPort ?? service.requestedPort ?? ''}`,
          title: service.name,
          status: service.status,
          description:
            service.actualPort || service.requestedPort
              ? `:${service.actualPort ?? service.requestedPort}`
              : undefined,
          resource: {
            type: 'browser' as const,
            serviceId: service.id,
            url: service.previewUrl ?? undefined,
          },
          updatedAt: service.startedAt ?? undefined,
        })),
    [stream.runtimeActivities.sandboxServices.services],
  );
  const taskSummaryAgentNames = React.useMemo(() => {
    const names = new Map<string, string>();
    runtimeCapabilityOptions.forEach((option) => {
      if (option.type !== 'subAgent') return;
      const name = option.capability.name?.trim();
      if (!name) return;
      names.set(option.id, name);
      const agentKey = option.capability.agentKey?.trim();
      if (agentKey) names.set(agentKey, name);
    });
    return names;
  }, [runtimeCapabilityOptions]);
  const liveTaskSummary = React.useMemo(
    () =>
      collectLiveTaskSummary({
        messages: messages.map(
          (message): TaskSummaryMessage => ({
            id: message.id,
            content: message.content,
            createdAt: message.createdAt,
            updatedAt: message.updatedAt,
            taskSummary: message.taskSummary,
            references: message.references,
            attachments: message.attachments,
            fileAssets: message.fileAssets,
            agentRuns: message.agentRuns,
            runtimeCapabilities: message.runtimeCapabilities,
          }),
        ),
        goal: threadGoal,
        todos: stream.todos,
        pending: liveTaskSummaryPending,
        running: liveTaskSummaryRunning,
        agentNames: taskSummaryAgentNames,
      }),
    [
      liveTaskSummaryPending,
      liveTaskSummaryRunning,
      messages,
      stream.todos,
      taskSummaryAgentNames,
      threadGoal,
    ],
  );
  const taskSummary = useTaskSummary({
    enabled: taskSummaryEnabled,
    conversationId: taskSummaryConversationId,
    client: stream.client,
    live: liveTaskSummary,
    refreshVersion: stream.historyMessageLoadVersion,
  });

  const navigateToTaskSummaryMessage = React.useCallback(
    async (messageId: string) => {
      try {
        let anchor = messageNavigationAnchorsRef.current.get(messageId);
        let pageCount = 0;
        while (!anchor && pageCount < 100) {
          const loaded = await stream.loadMoreConversationMessages();
          if (!loaded.length) break;
          pageCount += 1;
          await new Promise<void>((resolve) =>
            requestAnimationFrame(() => resolve()),
          );
          anchor = messageNavigationAnchorsRef.current.get(messageId);
        }
        if (!anchor) return;
        disableAutoFollow();
        clearQuoteSelection();
        anchor.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } catch (error) {
        console.warn('Failed to locate task summary message', error);
      }
    },
    [clearQuoteSelection, disableAutoFollow, stream],
  );

  const openTaskSummaryResource = React.useCallback(
    (
      resource: ChatTaskSummaryResourceReference,
      messageId?: string,
      resourceTitle?: string,
    ) => {
      const data: ChatTaskSummaryOpenResourceEffect = {
        resource,
        conversationId: taskSummaryConversationId ?? undefined,
        messageId,
        title: resourceTitle,
      };
      parentMessenger.sendEvent('public_event', [
        'effect',
        {
          name: CHATKIT_TASK_SUMMARY_OPEN_RESOURCE_EFFECT,
          data,
        },
      ]);
    },
    [parentMessenger, taskSummaryConversationId],
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

  const showMissingConfig = !isClientSecretInitializing && missingConfig;
  // File parsing can continue after submit; only the transport upload blocks send.
  const hasUploadingFiles = attachmentState.hasUploadingFiles;
  const isSubmissionBlocked =
    hasPendingInteractiveRequest ||
    missingConfig ||
    isHistoryLoading ||
    hasUploadingFiles ||
    isUploadingReferenceImages;
  const isSendDisabled =
    (!trimmedDraft && !hasReferences) || isSubmissionBlocked;
  const isPromptEditDisabled =
    hasPendingInteractiveRequest || missingConfig || isHistoryLoading;

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
    setThreadGoal(stream.threadGoal);
  }, [stream.threadGoal]);

  React.useEffect(() => {
    const threadId = stream.threadId?.trim();
    if (!threadId || !goalCommandAvailable) {
      setThreadGoal(null);
      setGoalError(null);
      setIsGoalLoading(false);
      setIsGoalPanelOpen(false);
      return;
    }
    if (!goalAdapter) {
      setThreadGoal(null);
      setGoalError(null);
      setIsGoalLoading(false);
      setIsGoalPanelOpen(false);
      return;
    }

    const controller = new AbortController();
    setIsGoalLoading(true);
    setGoalError(null);

    void loadThreadGoal({
      goal: goalAdapter,
      threadId,
      signal: controller.signal,
    })
      .then((goal) => {
        if (!controller.signal.aborted) {
          setThreadGoal(goal);
        }
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) {
          return;
        }
        setGoalError(error instanceof Error ? error.message : String(error));
        setThreadGoal(null);
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setIsGoalLoading(false);
        }
      });

    return () => controller.abort();
  }, [goalAdapter, goalCommandAvailable, stream.threadId]);

  // Submit only FileAsset handles. Parsed summaries/content stay server-side and
  // are fetched later by built-in file-understanding tools.
  const uploadedFiles = attachmentState.uploadedFiles;

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
      const nextMention = getWorkspaceFileMention(
        getComposerPlainText(nextParts),
        selectionOffset,
      );
      setWorkspaceFileMention(nextMention);
      if (nextMention) {
        setRuntimeCapabilityPalette(null);
      } else {
        updateRuntimeCapabilityPalette(nextParts, selectionOffset);
      }
    },
    [
      commitComposerParts,
      setRuntimeCapabilityPalette,
      updateRuntimeCapabilityPalette,
    ],
  );

  const handleComposerInput = React.useCallback(
    (event: React.FormEvent<HTMLDivElement>) => {
      if (isComposerComposingRef.current) return;

      syncComposerInputFromElement(event.currentTarget);
    },
    [syncComposerInputFromElement],
  );

  const handleComposerCompositionStart = React.useCallback(() => {
    isComposerComposingRef.current = true;
  }, []);

  const handleComposerCompositionEnd = React.useCallback(
    (event: React.CompositionEvent<HTMLDivElement>) => {
      isComposerComposingRef.current = false;
      syncComposerInputFromElement(event.currentTarget);
    },
    [syncComposerInputFromElement],
  );

  const handleComposerSelect = React.useCallback(() => {
    const selectionOffset = composerInputRef.current
      ? getComposerSelectionOffset(composerInputRef.current)
      : undefined;
    if (typeof selectionOffset === 'number') {
      const mention = getWorkspaceFileMention(
        getComposerPlainText(composerPartsRef.current),
        selectionOffset,
      );
      setWorkspaceFileMention(mention);
      if (mention) {
        setRuntimeCapabilityPalette(null);
        return;
      }
    }
    updateRuntimeCapabilityPalette(composerPartsRef.current, selectionOffset);
  }, [setRuntimeCapabilityPalette, updateRuntimeCapabilityPalette]);

  const submitDraft = React.useCallback(
    (submitOptions: SubmitDraftOptions = {}) => {
      if (isSubmissionBlocked) return;

      const contentToSubmit = (submitOptions.inputText ?? trimmedDraft).trim();
      const mergedFiles = mergeSubmittedFiles(
        uploadedFiles,
        referencedWorkspaceFiles,
      );
      const filesToSend = mergedFiles.length > 0 ? mergedFiles : undefined;
      const referencesToSend =
        references.length > 0 ? [...references] : undefined;
      const nextFollowUpMode = stream.isLoading ? 'queue' : undefined;
      const effectivePlanMode = submitOptions.planMode ?? planModeEnabled;
      const humanInput =
        buildHumanMessageInputPayload({
          content: contentToSubmit,
          references: referencesToSend,
        }) ?? (filesToSend ? { input: '' } : null);

      if (!humanInput) {
        return;
      }

      const {
        runtimeCapabilitiesForSubmit,
        runtimeCapabilityOptionsForMessage,
      } = getRuntimeCapabilitiesForSubmit(submitOptions.runtimeCapabilities);

      const displayContent =
        submitOptions.displayText ||
        contentToSubmit ||
        (referencesToSend || filesToSend
          ? t('chat.referencedContentOnly')
          : '');
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
        ...(filesToSend ? { fileAssets: filesToSend } : {}),
        ...(referencesToSend ? { references: referencesToSend } : {}),
        ...(stream.selectedModelId ? { model: stream.selectedModelId } : {}),
      };

      const inputPayload: {
        input: string;
        files?: typeof uploadedFiles;
        references?: ChatKitReference[];
        referenceComposition?: ChatKitReferenceCompositionMode;
        planMode?: boolean;
        runtimeCapabilities?: RuntimeCapabilitiesSelection;
        commandSource?: ChatKitCommandSource;
        model?: string;
      } = {
        ...humanInput,
        ...(stream.selectedModelId ? { model: stream.selectedModelId } : {}),
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

      const submittedComposerParts = composerPartsRef.current;
      const submittedReferences = references;
      const submittedWorkspaceFiles = referencedWorkspaceFiles;
      const submittedRunRuntimeCapabilities = runRuntimeCapabilities;
      const submittedTool =
        selectedTool && !selectedTool.pinned ? selectedTool : null;

      commitComposerParts([], {
        caretOffset: 0,
        resetDom: true,
        syncRemovedCapabilityTokens: false,
      });
      const rollbackAttachments =
        attachmentsRef.current?.clearWithRollback() ?? (() => undefined);
      setReferences([]);
      setReferencedWorkspaceFiles([]);
      setWorkspaceFileMention(null);
      if (submittedTool) {
        setSelectedTool(null);
      }
      resetRunRuntimeCapabilities();

      const restoreSubmittedDraft = () => {
        const currentParts = composerPartsRef.current;
        const currentCapabilities = getComposerCapabilityPartMap(currentParts);
        const submittedPartsToRestore = submittedComposerParts.filter(
          (part) => part.type === 'text' || !currentCapabilities.has(part.key),
        );
        const separator =
          submittedPartsToRestore.length > 0 && currentParts.length > 0
            ? createComposerTextParts('\n')
            : [];
        commitComposerParts(
          [...submittedPartsToRestore, ...separator, ...currentParts],
          {
            resetDom: true,
            syncRemovedCapabilityTokens: false,
          },
        );
        rollbackAttachments();
        setReferences((current) =>
          mergeReferences(submittedReferences, current),
        );
        setReferencedWorkspaceFiles((current) =>
          mergeSubmittedFiles(submittedWorkspaceFiles, current),
        );
        if (submittedTool) {
          setSelectedTool((current) => current ?? submittedTool);
        }
        addRunRuntimeCapabilities(submittedRunRuntimeCapabilities);
      };

      const submission = stream.submit(
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
      void submission.catch(() => {
        restoreSubmittedDraft();
      });

      scrollToBottom(true, true);
    },
    [
      addRunRuntimeCapabilities,
      effectiveSessionRuntimeCapabilities,
      getRuntimeCapabilitiesForSubmit,
      isSubmissionBlocked,
      options?.request,
      persistSessionRuntimeCapabilities,
      references,
      referencedWorkspaceFiles,
      resetRunRuntimeCapabilities,
      scrollToBottom,
      selectedTool,
      commitComposerParts,
      planModeEnabled,
      runRuntimeCapabilities,
      stream,
      trimmedDraft,
      uploadedFiles,
      t,
    ],
  );

  const handleGoalCommand = React.useCallback(
    async ({
      args,
      commandSource,
      runtimeCapabilities: commandRuntimeCapabilities,
      visibleInput,
    }: {
      args: string;
      commandSource: ChatKitCommandSource;
      runtimeCapabilities?: RuntimeCapabilitiesSelection;
      visibleInput?: string;
    }) => {
      const command = parseGoalCommand(args);
      const threadId = stream.threadId?.trim();
      setGoalError(null);

      if (!threadId) {
        if (command.type === 'show') {
          setThreadGoal(null);
          setIsGoalLoading(false);
          return;
        }
        if (command.type !== 'set' && command.type !== 'edit') {
          setGoalError(t('chat.goal.startThreadRequired'));
          return;
        }
      }
      if (!goalAdapter) {
        setGoalError(t('chat.goal.unavailable'));
        return;
      }

      goalAbortControllerRef.current?.abort();
      const goalAbortController = new AbortController();
      goalAbortControllerRef.current = goalAbortController;
      const goalRequestId = ++goalRequestIdRef.current;
      const goalProjectId = activeProjectId;
      setIsGoalLoading(true);
      try {
        const runtimeCapabilitiesForGoalSetup =
          commandRuntimeCapabilities || stream.connectorBindingIds.length
            ? withConnectorBindingIds(
                commandRuntimeCapabilities
                  ? { runtimeCapabilities: commandRuntimeCapabilities }
                  : undefined,
                stream.connectorBindingIds,
              ).runtimeCapabilities
            : undefined;
        const result = await executeThreadGoalCommand({
          goal: goalAdapter,
          threadId,
          assistantId: stream.assistantId,
          projectId: goalProjectId,
          command,
          runtimeCapabilities: runtimeCapabilitiesForGoalSetup,
          signal: goalAbortController.signal,
        });
        if (
          goalAbortController.signal.aborted ||
          goalRequestIdRef.current !== goalRequestId ||
          activeProjectIdRef.current !== goalProjectId
        ) {
          return;
        }
        if (!threadId && result.threadId) {
          stream.reset(result.threadId, []);
          void refreshThreads();
        }
        const startsGoalRun =
          result.goal?.status === 'active' &&
          (command.type === 'set' ||
            command.type === 'edit' ||
            command.type === 'resume');

        setThreadGoal(command.type === 'clear' ? null : result.goal);
        if (command.type === 'clear' || startsGoalRun) {
          setIsGoalPanelOpen(false);
        }
        if (startsGoalRun) {
          const goalRunThreadId = result.threadId ?? threadId;
          const runtimeCapabilitiesForGoalRun =
            getRuntimeCapabilitiesForCommand(commandRuntimeCapabilities);
          const inputPayload: {
            input: string;
            runtimeCapabilities?: RuntimeCapabilitiesSelection;
            commandSource: ChatKitCommandSource;
            goalRun: true;
            model?: string;
          } = {
            input: GOAL_RUN_INPUT,
            commandSource,
            goalRun: true,
            ...(stream.selectedModelId
              ? { model: stream.selectedModelId }
              : {}),
            ...(runtimeCapabilitiesForGoalRun
              ? { runtimeCapabilities: runtimeCapabilitiesForGoalRun }
              : {}),
          };
          const requestOptions = buildInjectedRequestOptions({
            defaults: options?.request,
            humanInput: inputPayload,
          });
          const visibleGoalMessage: HumanMessageWithMeta | null = visibleInput
            ? {
                id: createMessageId(),
                type: 'human',
                content: visibleInput,
                submittedInput: visibleInput,
                ...(stream.selectedModelId
                  ? { model: stream.selectedModelId }
                  : {}),
              }
            : null;

          void stream
            .submit(
              {
                input: inputPayload,
                ...(requestOptions.state
                  ? { state: requestOptions.state }
                  : {}),
              },
              {
                ...(goalRunThreadId && !threadId
                  ? {
                      threadId: goalRunThreadId,
                      joinExistingThread: true,
                    }
                  : {}),
                ...(requestOptions.context
                  ? { context: requestOptions.context }
                  : {}),
                ...(requestOptions.config
                  ? { config: requestOptions.config }
                  : {}),
                ...(visibleGoalMessage
                  ? {
                      preserveOptimisticMessages: true,
                      optimisticValues: (prev) => {
                        const prevMessages = prev?.messages ?? [];
                        return {
                          ...prev,
                          messages: [...prevMessages, visibleGoalMessage],
                        };
                      },
                    }
                  : {}),
              },
            )
            .catch((error: unknown) => {
              setGoalError(
                error instanceof Error ? error.message : String(error),
              );
            });
        }
      } catch (error) {
        if (
          goalAbortController.signal.aborted ||
          goalRequestIdRef.current !== goalRequestId ||
          activeProjectIdRef.current !== goalProjectId
        ) {
          return;
        }
        setGoalError(error instanceof Error ? error.message : String(error));
      } finally {
        if (goalRequestIdRef.current === goalRequestId) {
          if (goalAbortControllerRef.current === goalAbortController) {
            goalAbortControllerRef.current = null;
          }
          setIsGoalLoading(false);
        }
      }
    },
    [
      activeProjectId,
      getRuntimeCapabilitiesForCommand,
      goalAdapter,
      options?.request,
      refreshThreads,
      stream,
      t,
    ],
  );

  const handleGoalPanelOpenChange = React.useCallback((open: boolean) => {
    setIsGoalPanelOpen(open);
  }, []);

  const {
    slashPaletteOptions,
    executeSlashCommandFromDraft,
    selectSlashPaletteOption,
  } = useSlashCommands({
    hostCommands: composer?.slashCommands,
    runtimeCapabilities,
    runtimeCapabilitiesReady,
    runtimeCapabilityOptions,
    recommendedRuntimeCapabilities: runRuntimeCapabilities,
    draft,
    palette: runtimeCapabilityPalette,
    setPalette: setRuntimeCapabilityPalette,
    parentMessenger,
    getComposerEditingLength: () =>
      getComposerEditingLength(composerPartsRef.current),
    setComposerText,
    focusComposerAt,
    setPlanModeEnabled,
    setGoalPanelOpen: setIsGoalPanelOpen,
    onPetCommand: handlePetCommand,
    onGoalCommand: handleGoalCommand,
    addRunRuntimeCapabilities,
    setRunRuntimeCapabilities,
    insertComposerCapabilityToken,
    submitPrompt: submitDraft,
  });
  const slashPaletteEmptyLabel = runtimeCapabilityPalette
    ? t(
        getRuntimeCapabilityPaletteEmptyLabelKey(
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
  }, [
    runtimeCapabilityPalette,
    setRuntimeCapabilityPalette,
    slashPaletteOptions.length,
  ]);

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

  const submitGoalModeDraft = React.useCallback(() => {
    const objective = getComposerPlainText(composerPartsRef.current).trim();
    if (!isGoalModeOpen || !goalCommandAvailable || !objective) {
      return false;
    }

    setComposerText('', 0);
    setRuntimeCapabilityPalette(null);
    focusComposerAt(0);
    void handleGoalCommand({
      args: objective,
      commandSource: {
        type: 'slash_command',
        name: 'goal',
        source: 'runtime',
        executionType: 'insert_invocation',
      },
      runtimeCapabilities: runRuntimeCapabilities,
      visibleInput: objective,
    });
    return true;
  }, [
    focusComposerAt,
    goalCommandAvailable,
    handleGoalCommand,
    isGoalModeOpen,
    runRuntimeCapabilities,
    setComposerText,
    setRuntimeCapabilityPalette,
  ]);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (executeSlashCommandFromDraft()) {
      return;
    }
    if (submitGoalModeDraft()) {
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

  const handleAttachmentClick = () => {
    attachmentsRef.current?.openFilePicker();
  };

  const uploadContextFile = React.useCallback(
    (file: File) => {
      const formData = new FormData();
      formData.append('file', file, file.name || 'upload');
      // The backend creates a StorageFile for object storage, then returns an
      // AgentFile/FileAsset handle for chat runtime and file tools.
      formData.append('purpose', 'chat_attachment');
      formData.append('parseMode', 'auto');
      if (stream.assistantId) {
        formData.append('xpertId', stream.assistantId);
      }
      if (stream.threadId) {
        formData.append('threadId', stream.threadId);
      }
      return (
        stream.client.contexts as unknown as {
          fetch<TResponse>(
            path: string,
            options: RequestInit,
          ): Promise<TResponse>;
        }
      ).fetch<AgentFile>('/contexts/file', {
        method: 'POST',
        body: formData,
      });
    },
    [stream.assistantId, stream.client, stream.threadId],
  );

  const getContextFileStatus = React.useCallback(
    (fileId: string) =>
      (
        stream.client.contexts as unknown as {
          fetch<TResponse>(
            path: string,
            options?: RequestInit,
          ): Promise<TResponse>;
        }
      ).fetch<AttachmentFileStatus>(`/files/${fileId}/status`, {
        method: 'GET',
      }),
    [stream.client],
  );

  const deleteContextFile = React.useCallback(
    (storageFileId: string) => stream.client.contexts.deleteFile(storageFileId),
    [stream.client],
  );

  const selectWorkspaceFileMention = React.useCallback(
    (file: XpertWorkspaceFile) => {
      const mention = workspaceFileMention;
      if (!mention) return;

      const filePath = getWorkspaceFilePath(file);

      setReferencedWorkspaceFiles((current) =>
        current.some(
          (item) => (item.workspacePath ?? item.filePath) === filePath,
        )
          ? current
          : [...current, toReferencedWorkspaceFile(file)],
      );
      const nextParts = replaceComposerRange(
        composerPartsRef.current,
        mention.start,
        mention.end,
        [],
      );
      commitComposerParts(nextParts, {
        caretOffset: mention.start,
        resetDom: true,
      });
      setWorkspaceFileMention(null);
      setRuntimeCapabilityPalette(null);
      focusComposerAt(mention.start);
    },
    [
      commitComposerParts,
      workspaceFileMention,
      focusComposerAt,
      setRuntimeCapabilityPalette,
    ],
  );

  React.useEffect(() => {
    setReferencedWorkspaceFiles([]);
    setWorkspaceFileMention(null);
  }, [activeProjectId, stream.assistantId]);

  React.useEffect(() => {
    setIsGoalLoading(false);
    return () => {
      goalRequestIdRef.current += 1;
      goalAbortControllerRef.current?.abort();
      goalAbortControllerRef.current = null;
    };
  }, [activeProjectId, stream.assistantId]);

  const handleComposerKeyDown = (
    event: React.KeyboardEvent<HTMLDivElement>,
  ) => {
    if (workspaceFileMention) {
      if (event.key === 'Escape') {
        event.preventDefault();
        setWorkspaceFileMention(null);
        return;
      }

      if (
        event.key === 'ArrowDown' ||
        event.key === 'ArrowUp' ||
        event.key === 'Tab'
      ) {
        event.preventDefault();
        workspaceFileMentionPaletteRef.current?.moveActive(
          event.key === 'ArrowUp' ? -1 : 1,
        );
        return;
      }

      if (event.key === 'Enter') {
        event.preventDefault();
        workspaceFileMentionPaletteRef.current?.selectActive();
        return;
      }
    }

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
      if (submitGoalModeDraft()) {
        return;
      }
      submitDraft();
      return;
    }

    if (executeSlashCommandFromDraft()) {
      return;
    }
    if (submitGoalModeDraft()) {
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
            const [dimensions, uploadedFile] = await Promise.all([
              readImageDimensions(file),
              uploadContextFile(file),
            ]);

            return buildPastedImageReference(file, uploadedFile, dimensions);
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

  const handleToolSelect = (tool: ToolOption) => {
    setSelectedTool((prev) => (prev?.id === tool.id ? null : tool));
  };

  const handlePromptClick = React.useCallback(
    (prompt: string) => {
      submitDraft({ inputText: prompt, displayText: prompt });
    },
    [submitDraft],
  );

  const handlePromptEdit = React.useCallback(
    (prompt: string) => {
      if (isPromptEditDisabled) return;
      setComposerText(prompt, prompt.length);
      setRuntimeCapabilityPalette(null);
      focusComposerAt(prompt.length);
    },
    [
      focusComposerAt,
      isPromptEditDisabled,
      setComposerText,
      setRuntimeCapabilityPalette,
    ],
  );

  const loadConversationMessages = React.useCallback(
    async (recordId: string, threadId?: string) => {
      if (missingConfig) {
        setHistoryError(missingConfigShortMessage);
        return;
      }
      setHistoryError(null);
      setIsHistoryLoading(true);
      try {
        await stream.loadConversationMessages(recordId, threadId);
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

  const handleNewThread = async () => {
    if (missingConfig || isHistoryLoading) return;
    setHistoryError(null);
    try {
      // const created = await createThread({ title: t('history.newThreadTitle') });
      // setActiveThreadId(created.id);
      const hadSelectedConnectors = stream.connectorBindingIds.length > 0;
      stream.reset(null, []);
      if (hadSelectedConnectors) onConnectorsChange?.([]);
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
        void loadConversationMessages(thread.recordId, thread.id);
      }
      return;
    }
    stream.reset(id, []);
    if (thread.recordId) {
      void loadConversationMessages(thread.recordId, thread.id);
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
      const retryTarget = messages[messageIndex];
      const retryInput = {
        ...humanInput,
        ...(lastHumanMessage?.runtimeCapabilities
          ? { runtimeCapabilities: lastHumanMessage.runtimeCapabilities }
          : {}),
      };
      stream.submit(
        retryTarget?.executionId
          ? {
              input: retryInput,
              retry: true,
              id: retryTarget.id,
              executionId: retryTarget.executionId,
              conversationId: stream.conversationId ?? undefined,
            }
          : {
              input: {
                ...retryInput,
                ...(lastHumanMessage?.model
                  ? { model: lastHumanMessage.model }
                  : {}),
              },
            },
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
  const canUploadDroppedFiles =
    composer?.attachments?.enabled === true &&
    !missingConfig &&
    !isHistoryLoading &&
    !hasPendingInteractiveRequest;
  const handleDroppedFiles = React.useCallback((files: ArrayLike<File>) => {
    return attachmentsRef.current?.queueFiles(files) ?? false;
  }, []);

  const currentThread = React.useMemo(
    () => threads.find((item) => item.id === stream.threadId),
    [threads, stream.threadId],
  );
  const assistantStatusText = React.useMemo(() => {
    if (!stream.threadId) return t('chat.statusOnline');
    return currentThread?.title?.trim() || t('chat.statusOnline');
  }, [currentThread?.title, stream.threadId, t]);

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

  const layoutMaxWidth = options?.layout?.maxWidth;
  const chatColumnStyle = React.useMemo<React.CSSProperties | undefined>(() => {
    if (
      layoutMaxWidth === undefined ||
      layoutMaxWidth === null ||
      layoutMaxWidth === ''
    ) {
      return undefined;
    }

    return { maxWidth: layoutMaxWidth };
  }, [layoutMaxWidth]);
  React.useLayoutEffect(() => {
    if (!taskSummaryEnabled) {
      setTaskSummaryDocked(false);
      return;
    }

    const viewport = viewportRef.current;
    const chatColumn = chatColumnRef.current;
    if (!viewport || !chatColumn) {
      setTaskSummaryDocked(false);
      return;
    }

    const updateDockedState = () => {
      const viewportRect = viewport.getBoundingClientRect();
      const chatColumnRect = chatColumn.getBoundingClientRect();
      const rootFontSize = Number.parseFloat(
        window.getComputedStyle(document.documentElement).fontSize,
      );
      const remInPixels = Number.isFinite(rootFontSize) ? rootFontSize : 16;
      const requiredSideSpace =
        (TASK_SUMMARY_PANEL_WIDTH_REM +
          TASK_SUMMARY_PANEL_EDGE_INSET_REM +
          TASK_SUMMARY_PANEL_SAFE_GAP_REM) *
        remInPixels;
      const availableSideSpace = viewportRect.right - chatColumnRect.right;
      setTaskSummaryDocked(availableSideSpace >= requiredSideSpace);
    };

    updateDockedState();
    window.addEventListener('resize', updateDockedState);
    const resizeObserver =
      typeof ResizeObserver === 'function'
        ? new ResizeObserver(updateDockedState)
        : null;
    resizeObserver?.observe(viewport);
    resizeObserver?.observe(chatColumn);

    return () => {
      window.removeEventListener('resize', updateDockedState);
      resizeObserver?.disconnect();
    };
  }, [layoutMaxWidth, taskSummaryEnabled]);
  const taskSummaryAvailable = Boolean(
    taskSummaryEnabled && stream.threadId && taskSummaryConversationId,
  );
  const handleTaskSummaryOpenChange = React.useCallback(
    (open: boolean) => {
      setTaskSummaryOpen(open);
      if (!taskSummaryConversationId) return;
      if (open) {
        manuallyClosedTaskSummaryConversationIdsRef.current.delete(
          taskSummaryConversationId,
        );
        return;
      }
      manuallyClosedTaskSummaryConversationIdsRef.current.add(
        taskSummaryConversationId,
      );
    },
    [taskSummaryConversationId],
  );
  React.useEffect(() => {
    if (!taskSummaryDocked) {
      setTaskSummaryOpen(false);
    }
  }, [taskSummaryDocked]);
  React.useEffect(() => {
    if (
      !taskSummaryDocked ||
      !taskSummaryAvailable ||
      !taskSummaryConversationId ||
      manuallyClosedTaskSummaryConversationIdsRef.current.has(
        taskSummaryConversationId,
      )
    ) {
      return;
    }

    setTaskSummaryOpen(true);
  }, [taskSummaryAvailable, taskSummaryConversationId, taskSummaryDocked]);
  const taskSummaryProps: TaskSummaryProps = {
    summary: taskSummary.summary,
    historyError: taskSummary.historyError,
    loadingSections: taskSummary.loadingSections,
    loadedSectionCounts: taskSummary.loadedSectionCounts,
    onRetryHistory: taskSummary.retryHistory,
    onLoadSection: taskSummary.loadSection,
    onNavigateMessage: (messageId) => {
      void navigateToTaskSummaryMessage(messageId);
    },
    onFocusComposer: () => focusComposerAt(),
    onOpenResource: openTaskSummaryResource,
  };

  return (
    <div
      className="relative flex h-full w-full min-w-0 bg-background"
      data-task-summary-layout={taskSummaryDocked ? 'docked' : 'popover'}
    >
      <UploadDroppedFiles
        ref={viewportRef}
        data-chatkit-root=""
        enabled={canUploadDroppedFiles}
        dropTitle={t('chat.dropFilesTitle')}
        dropHint={t('chat.dropFilesHint')}
        activeClassName="ring-2 ring-primary/40 ring-inset"
        onFiles={handleDroppedFiles}
        className={cn(
          'relative flex h-full w-full min-w-0 flex-col flex-1 overflow-x-hidden overflow-y-auto bg-background shadow-sm transition-[box-shadow] duration-150',
          className,
        )}
      >
        {surface === 'main' && options?.header?.enabled !== false && (
          <div
            ref={chatColumnRef}
            data-slot="chatkit-chat-header"
            className="mx-auto flex w-full items-center justify-between border-b p-2 sticky top-0 z-10 bg-background"
            style={chatColumnStyle}
          >
            <div className="flex min-w-0 items-center gap-3 overflow-hidden">
              <div className="relative shrink-0">
                <ChatkitAvatar
                  avatar={assistantAvatar}
                  className="h-9 w-9 border border-border/60"
                  label={assistantTitle}
                />
                <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-background bg-green-500" />
              </div>
              <div className="min-w-0">
                <h2
                  className="text-lg font-semibold truncate"
                  title={assistantTitle}
                >
                  {assistantTitle}
                </h2>
                <p
                  className="truncate text-xs text-muted-foreground"
                  title={assistantStatusText}
                >
                  {assistantStatusText}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {taskSummaryAvailable && (
                <TaskSummaryTrigger
                  {...taskSummaryProps}
                  displayMode={taskSummaryDocked ? 'docked' : 'popover'}
                  open={taskSummaryOpen}
                  onOpenChange={handleTaskSummaryOpenChange}
                />
              )}
              <WorkbenchToggleButton />

              {canMinimizeToPet && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="inline-flex h-8 w-8">
                      <button
                        type="button"
                        onClick={handleMinimizeToPet}
                        className={cn(
                          'flex h-8 w-8 cursor-pointer items-center justify-center rounded-md',
                          'text-muted-foreground hover:text-foreground hover:bg-muted',
                          'transition-colors duration-150',
                        )}
                        aria-label={t('chat.minimizeToPet')}
                      >
                        <Minus size={16} />
                      </button>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    {t('chat.minimizeToPet')}
                  </TooltipContent>
                </Tooltip>
              )}

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
                <TooltipContent side="bottom">
                  {t('settings.open')}
                </TooltipContent>
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
                    onRefresh={refreshThreads}
                    onSelectThread={handleSelectThread}
                    onDeleteThread={handleDeleteThread}
                    isRefreshing={isThreadsLoading}
                    showDelete={history?.showDelete !== false}
                    disabled={
                      missingConfig || isThreadsLoading || isHistoryLoading
                    }
                  />
                </>
              )}
            </div>
          </div>
        )}

        {showMessageNavigation && (
          <MessageNavigator
            items={messageNavigationItems}
            viewportRef={viewportRef}
            getAnchor={getMessageNavigationAnchor}
            onNavigate={handleMessageNavigationNavigate}
            label={t('message.navigation.label')}
            tagsOverflowLabel={(count) =>
              t('message.navigation.moreTags', { count })
            }
          />
        )}

        <div
          data-slot="chatkit-chat-content"
          className={cn(
            'mx-auto w-full p-4',
            isInitialComposer ? 'mt-auto shrink-0 pb-0' : 'flex-1',
          )}
          style={chatColumnStyle}
        >
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
          {messages.length === 0 && !canLoadMoreMessages ? (
            <StartScreen
              startScreen={startScreen}
              onPromptClick={handlePromptClick}
              onPromptEdit={handlePromptEdit}
              promptSendDisabled={isSubmissionBlocked}
              promptEditDisabled={isPromptEditDisabled}
              className="px-4 pb-4 pt-2"
            />
          ) : (
            <div className="space-y-4">
              {canLoadMoreMessages && (
                <div className="flex items-center gap-3 py-1">
                  <div className="h-px min-w-8 flex-1 bg-border" />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleLoadMoreMessages}
                    disabled={isLoadingMoreMessages}
                    className="h-7 px-2 text-xs font-medium text-muted-foreground hover:text-foreground"
                  >
                    {isLoadingMoreMessages
                      ? t('chat.loadingMoreMessages')
                      : t('chat.loadMoreMessages')}
                  </Button>
                  <div className="h-px min-w-8 flex-1 bg-border" />
                </div>
              )}
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
                const humanAttachments = getVisibleHumanAttachments(
                  [
                    ...(humanMessage.fileAssets ?? []),
                    ...(humanMessage.attachments ?? []),
                  ],
                  humanReferences,
                );
                const humanRuntimeCapabilityOptions =
                  message.type === 'human'
                    ? (humanMessage.runtimeCapabilityOptions ??
                      getRuntimeCapabilityOptionsForSelection(
                        getRecommendedRuntimeCapabilitiesSelection(
                          humanMessage.runtimeCapabilities,
                        ),
                        runtimeCapabilityOptions,
                      ))
                    : [];
                const hasHumanAttachments =
                  message.type === 'human' && humanAttachments.length > 0;
                const canQuoteMessage =
                  message.type === 'human' || isAssistantMessage;
                const quoteSource =
                  message.type === 'human'
                    ? t('chat.youLabel')
                    : assistantTitle;
                const messageNavigationId = getMessageNavigationItemId(
                  message as MessageNavigationSourceMessage,
                  index,
                );

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
                    ref={(node) =>
                      setMessageNavigationAnchor(messageNavigationId, node)
                    }
                    data-message-navigation-id={messageNavigationId}
                    className={cn(
                      'group flex gap-3',
                      message.type === 'human'
                        ? 'justify-end'
                        : 'justify-start -ml-1', // AI messages: slightly closer to left
                    )}
                  >
                    <div
                      className={cn(
                        'flex flex-col px-3 overflow-hidden',
                        isAssistantMessage && 'min-w-0 flex-1',
                      )}
                    >
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
                            pet={effectivePet}
                            mcpApps={options?.mcpApps}
                          />
                        ) : (
                          <>
                            {message.type === 'human' &&
                              humanRuntimeCapabilityOptions.length > 0 && (
                                <HumanRuntimeCapabilityChips
                                  options={humanRuntimeCapabilityOptions}
                                />
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
                                        {file.originalName ?? file.id}
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
            className="pointer-events-none fixed z-50 flex flex-col items-center gap-1"
            style={{
              top: `${quoteSelection.top}px`,
              left: `${quoteSelection.left}px`,
              transform: 'translateX(-50%)',
            }}
          >
            <div className="pointer-events-auto flex overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-lg">
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="rounded-none border-r"
                onMouseDown={(event) => event.preventDefault()}
                onClick={handleQuoteSelection}
                aria-label={t('composer.quoteSelection')}
                title={t('composer.quoteSelection')}
              >
                <Quote size={14} />
                {t('composer.quoteSelection')}
              </Button>
              {workbench.sideChatEnabled && (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="rounded-none"
                  disabled={
                    isOpeningSideChat || stream.isLoading || !stream.threadId
                  }
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => void handleAskInSideChat()}
                  aria-label={t('composer.askInSideChat')}
                  title={t('composer.askInSideChat')}
                >
                  {isOpeningSideChat ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <MessageSquarePlus size={14} />
                  )}
                  {t('composer.askInSideChat')}
                </Button>
              )}
            </div>
            {sideChatError && (
              <div className="pointer-events-auto max-w-72 rounded-md bg-destructive px-2 py-1 text-xs text-destructive-foreground shadow">
                {sideChatError}
              </div>
            )}
          </div>
        )}

        <div
          data-slot="chatkit-chat-composer"
          data-position={isInitialComposer ? 'centered' : 'bottom'}
          className={cn(
            'mx-auto w-full max-w-2xl px-4 py-2 z-10 bg-background',
            isInitialComposer ? 'mb-auto' : 'sticky bottom-0',
          )}
          style={chatColumnStyle}
        >
          {threadErrorMessage && (
            <div className="mb-3 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive overflow-auto">
              {threadErrorMessage}
            </div>
          )}
          <ChatAttachments
            ref={attachmentsRef}
            accept={acceptMimes}
            maxCount={composer?.attachments?.maxCount ?? 10}
            maxSize={composer?.attachments?.maxSize ?? 100 * 1024 * 1024}
            retryUploadLabel={t('chat.retryUpload')}
            uploadFile={uploadContextFile}
            deleteFile={deleteContextFile}
            getFileStatus={getContextFileStatus}
            onStateChange={setAttachmentState}
          />

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

          {referencedWorkspaceFiles.length > 0 && (
            <div className="mb-3 flex flex-wrap gap-2">
              {referencedWorkspaceFiles.map((file) => {
                const id =
                  file.workspacePath ??
                  file.filePath ??
                  file.fileAssetId ??
                  file.fileId ??
                  file.id;
                return (
                  <WorkspaceFileChip
                    key={id}
                    file={file}
                    onRemove={() =>
                      setReferencedWorkspaceFiles((current) =>
                        current.filter(
                          (item) =>
                            (item.workspacePath ??
                              item.filePath ??
                              item.fileAssetId ??
                              item.fileId ??
                              item.id) !== id,
                        ),
                      )
                    }
                    removeLabel={t('composer.fileMentions.remove')}
                  />
                );
              })}
            </div>
          )}
          <DetachedRunRuntimeCapabilities
            options={detachedRunRuntimeCapabilityOptions}
            runOnlyLabel={t('composer.capabilities.runOnly')}
            removeLabel={t('composer.capabilities.removeRunCapability')}
            onRemove={removeRunRuntimeCapability}
          />

          {showGoalStatus && (
            <div
              className={cn(
                'mb-2 flex min-h-10 gap-2 rounded-md border border-border bg-background px-2.5 py-2 text-xs text-foreground shadow-sm',
                isGoalObjectiveExpanded ? 'items-start' : 'items-center',
              )}
            >
              <Target
                className={cn(
                  'size-4 shrink-0 text-muted-foreground',
                  isGoalObjectiveExpanded && 'mt-1',
                )}
              />
              <div className="min-w-0 flex-1">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="font-medium">{t('chat.goal.label')}</span>
                  {threadGoal && (
                    <span className="shrink-0 rounded-md bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
                      {t(`chat.goal.status.${threadGoal.status}`)}
                    </span>
                  )}
                  {isGoalLoading && (
                    <Loader2 className="size-3 animate-spin text-muted-foreground" />
                  )}
                </div>
                <div
                  className={cn(
                    'mt-0.5 text-muted-foreground',
                    threadGoal?.objective &&
                      !goalError &&
                      isGoalObjectiveExpanded
                      ? 'whitespace-pre-wrap break-words'
                      : 'truncate',
                  )}
                >
                  {goalError || threadGoal?.objective}
                </div>
                {threadGoal && (
                  <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                    <span>
                      {t('chat.goal.elapsed', {
                        elapsed: formatGoalElapsed(displayedGoalElapsedSeconds),
                      })}
                    </span>
                  </div>
                )}
              </div>
              {threadGoal && (
                <div className="flex shrink-0 items-center gap-1">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-xs"
                        disabled={isGoalLoading}
                        onClick={() => {
                          const prefix = '/goal edit ';
                          setComposerText(`${prefix}${threadGoal.objective}`);
                        }}
                      >
                        <Pencil className="size-3" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>{t('chat.goal.edit')}</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-xs"
                        disabled={isGoalLoading}
                        onClick={() =>
                          void handleGoalCommand({
                            args:
                              threadGoal.status === 'paused'
                                ? 'resume'
                                : 'pause',
                            commandSource: {
                              type: 'slash_command',
                              name: 'goal',
                              source: 'runtime',
                              executionType: 'insert_invocation',
                            },
                          })
                        }
                      >
                        {threadGoal.status === 'paused' ? (
                          <Play className="size-3" />
                        ) : (
                          <Pause className="size-3" />
                        )}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      {threadGoal.status === 'paused'
                        ? t('chat.goal.resume')
                        : t('chat.goal.pause')}
                    </TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-xs"
                        disabled={isGoalLoading}
                        onClick={() =>
                          void handleGoalCommand({
                            args: 'clear',
                            commandSource: {
                              type: 'slash_command',
                              name: 'goal',
                              source: 'runtime',
                              executionType: 'insert_invocation',
                            },
                          })
                        }
                      >
                        <Trash2 className="size-3" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>{t('chat.goal.clear')}</TooltipContent>
                  </Tooltip>
                  {threadGoal.objective && !goalError && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-xs"
                          aria-expanded={isGoalObjectiveExpanded}
                          aria-label={
                            isGoalObjectiveExpanded
                              ? t('chat.goal.collapseObjective')
                              : t('chat.goal.expandObjective')
                          }
                          onClick={() =>
                            setIsGoalObjectiveExpanded((expanded) => !expanded)
                          }
                        >
                          <ChevronDown
                            className={cn(
                              'size-3 transition-transform',
                              isGoalObjectiveExpanded && 'rotate-180',
                            )}
                          />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        {isGoalObjectiveExpanded
                          ? t('chat.goal.collapseObjective')
                          : t('chat.goal.expandObjective')}
                      </TooltipContent>
                    </Tooltip>
                  )}
                </div>
              )}
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

          {workspaceFileMention && (
            <WorkspaceFileMentionPalette
              ref={workspaceFileMentionPaletteRef}
              client={xpertPlatformClient}
              assistantId={stream.assistantId ?? null}
              projectId={activeProjectId ?? null}
              query={workspaceFileMention.query}
              selectedFilePaths={referencedWorkspaceFilePaths}
              onSelect={selectWorkspaceFileMention}
            />
          )}

          {runtimeCapabilityPalette && !workspaceFileMention && (
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
              data-layout="stacked"
              className={cn(
                'relative flex min-w-0 flex-1 flex-col overflow-visible',
                'bg-composer-shell px-composer-inset pt-composer-inset',
                !isProjectSelectorVisible && 'pb-composer-inset',
                'transition-[border-radius] duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)]',
                'rounded-composer-shell shadow-composer-shell',
              )}
            >
              <div
                data-slot="composer-editor-surface"
                className={cn(
                  'relative flex min-h-[6.5rem] min-w-0 bg-background px-2 pt-2 pb-14',
                  'rounded-composer-editor',
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
                  onCompositionStart={handleComposerCompositionStart}
                  onCompositionEnd={handleComposerCompositionEnd}
                  onSelect={handleComposerSelect}
                  onPaste={handleComposerPaste}
                  onKeyDown={handleComposerKeyDown}
                  data-placeholder={inputPlaceholder}
                  className={cn(
                    'min-h-10 max-h-36 w-full overflow-y-auto whitespace-pre-wrap break-words bg-transparent px-2 py-2 text-base leading-6 text-foreground outline-none',
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
                      <ComposerCapabilityToken key={part.key} part={part} />
                    ),
                  )}
                </div>
                <div
                  data-slot="composer-action-bar"
                  className="pointer-events-none absolute inset-x-3 bottom-2 flex min-h-10 items-center justify-between gap-2"
                >
                  <div className="pointer-events-none flex min-w-0 flex-1 items-center gap-1.5">
                    <div className="pointer-events-auto flex shrink-0 items-center gap-1.5">
                      <ComposerMenu
                        composer={composer}
                        onAttachmentClick={handleAttachmentClick}
                        onToolSelect={handleToolSelect}
                        selectedTool={selectedTool}
                        planModeEnabled={planModeEnabled}
                        onPlanModeChange={setPlanModeEnabled}
                        goalCommandAvailable={goalCommandAvailable}
                        goalPanelOpen={isGoalModeOpen}
                        onGoalPanelOpenChange={handleGoalPanelOpenChange}
                        runtimeCapabilities={
                          runtimeCapabilitiesReady ? runtimeCapabilities : null
                        }
                        selectedRuntimeCapabilities={
                          effectiveSessionRuntimeCapabilities
                        }
                        onRuntimeCapabilityToggle={
                          handleSessionRuntimeCapabilityToggle
                        }
                        connectorClient={xpertPlatformClient}
                        connectorXpertId={stream.assistantId}
                        connectorProjectId={activeProjectId}
                        selectedConnectorBindingIds={stream.connectorBindingIds}
                        onConnectorSelectionChange={(bindingIds) => {
                          void stream
                            .setConnectorBindingIds(bindingIds)
                            .then(() => onConnectorsChange?.(bindingIds))
                            .catch((persistError) => {
                              console.warn(
                                '[Chat] Failed to persist connector selection:',
                                persistError,
                              );
                            });
                        }}
                        connectorsEnabled={connectorsEnabled}
                        apiUrl={apiUrl}
                        disabled={
                          missingConfig ||
                          isHistoryLoading ||
                          hasPendingInteractiveRequest
                        }
                      />
                    </div>

                    {selectedTool && (
                      <span
                        data-slot="composer-selected-tool"
                        className="group/tool pointer-events-auto inline-flex h-8 min-w-0 max-w-[14rem] shrink items-center rounded-full bg-primary/10 px-2 text-xs font-medium text-primary transition-all duration-200"
                      >
                        <span className="truncate">
                          {selectedTool.shortLabel ?? selectedTool.label}
                        </span>
                        <button
                          data-slot="composer-selected-tool-remove"
                          type="button"
                          onClick={() => setSelectedTool(null)}
                          aria-label={t('composer.removeTool', {
                            label:
                              selectedTool.shortLabel ?? selectedTool.label,
                          })}
                          className={cn(
                            'pointer-events-none ml-0 flex w-0 shrink-0 items-center justify-center overflow-hidden rounded-full p-0 text-primary/70 opacity-0 outline-none',
                            'transition-[width,margin,opacity,background-color,color] duration-200',
                            'group-hover/tool:pointer-events-auto group-hover/tool:ml-1 group-hover/tool:w-4 group-hover/tool:opacity-100',
                            'focus-visible:pointer-events-auto focus-visible:ml-1 focus-visible:w-4 focus-visible:opacity-100',
                            'hover:bg-primary/10 hover:text-primary focus-visible:bg-primary/10 focus-visible:text-primary',
                          )}
                        >
                          <X className="size-3 shrink-0" />
                        </button>
                      </span>
                    )}
                  </div>

                  <div className="pointer-events-auto flex shrink-0 items-center gap-1">
                    <ContextUsageIndicator className="size-8" />
                    <ModelPicker
                      models={availableModels}
                      selectedModelId={stream.selectedModelId}
                      onSelect={handleModelSelect}
                      disabled={
                        Boolean(missingConfig) ||
                        isHistoryLoading ||
                        hasPendingInteractiveRequest
                      }
                      copy={{
                        label: t('chat.modelPicker.label'),
                        title: t('chat.modelPicker.title'),
                        description: t('chat.modelPicker.description'),
                        availableModels: t('chat.modelPicker.availableModels'),
                        defaultBadge: t('chat.modelPicker.defaultBadge'),
                        unavailableBadge: t(
                          'chat.modelPicker.unavailableBadge',
                        ),
                        futureTitle: t('chat.modelPicker.futureTitle'),
                        futureDescription: t(
                          'chat.modelPicker.futureDescription',
                        ),
                        futureBadge: t('chat.modelPicker.futureBadge'),
                      }}
                    />
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
                                label: t('chat.followUps.queue'),
                                keys: 'Enter',
                              },
                            ]
                          : undefined
                      }
                    />
                  </div>
                </div>
              </div>

              {projectsEnabled &&
              (isConfiguredProjectLocked || !isProjectSelectionLocked) ? (
                <ProjectSelector
                  client={xpertPlatformClient}
                  xpertId={stream.assistantId}
                  activeProjectId={activeProjectId}
                  locked={isConfiguredProjectLocked}
                  label={options?.composer?.projects?.label}
                  disabled={
                    missingConfig ||
                    isHistoryLoading ||
                    isGoalLoading ||
                    hasPendingInteractiveRequest
                  }
                  onAvailabilityChange={setHasSelectableProjects}
                  onProjectChange={handleProjectSelectionChange}
                  onProjectCreate={onProjectCreate}
                />
              ) : null}
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

          <div
            data-slot="chat-footer"
            className="relative mt-2 flex min-h-6 items-center justify-center gap-2 text-xs text-muted-foreground"
          >
            <span>{t('chat.poweredBy')}</span>
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
      </UploadDroppedFiles>
      {taskSummaryAvailable && taskSummaryDocked && taskSummaryOpen && (
        <div className="pointer-events-none absolute right-5 top-3 z-20 max-h-[calc(100%-1.5rem)] w-80">
          <TaskSummaryPanel
            {...taskSummaryProps}
            className="pointer-events-auto max-h-full"
          />
        </div>
      )}
    </div>
  );
}
