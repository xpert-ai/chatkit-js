import type {
  ChatKitOptions,
  ChatKitPetAnimationName,
  ChatKitPetAnimationMode,
} from '@xpert-ai/chatkit-types';
import {
  DEFAULT_PET_STORAGE_KEY,
  clampPetPosition,
  getPinnedPetPosition,
  normalizeBoundsPadding,
  normalizePetOptions,
  resolvePetCharacter,
  type NormalizedPetOptions,
  type PetPosition,
  type PetSize,
  type PetSpriteAtlasDefinition,
  type PetViewport,
  type ResolvedPetCharacter,
} from '@xpert-ai/chatkit-types';

type TransientAnimation = {
  name: ChatKitPetAnimationName;
};

type PetOverlayCopy = {
  closePetMenuItem: string;
  hideMessage: string;
  expandMessage: string;
  collapseMessage: string;
  restoreMessage: string;
  replyButton: string;
  replyPlaceholder: string;
  sendButton: string;
  sendingButton: string;
  sendFailed: string;
};

export type ThreadSummaryStatus = 'running' | 'completed' | 'failed';

export type ThreadSummary = {
  threadId: string;
  title: string;
  message: string;
  status: ThreadSummaryStatus;
  messageId?: string;
  updatedAt?: string;
};

const DRAG_DIRECTION_THRESHOLD_PX = 2;
const PET_BASE_RENDER_SCALE = 0.5;
const PET_FRAME_DURATION_MULTIPLIER = 1.5;
const PET_RESTING_FRAME_DURATION_MULTIPLIER = 3;
const PET_RESTING_DELAY_MS = 2000;
const PET_SUMMARY_GAP = 12;
const PET_SUMMARY_WIDTH = 320;
const PET_SUMMARY_MARGIN = 12;
const PET_CONTEXT_MENU_MARGIN = 8;
const PET_SUMMARY_FONT_FAMILY =
  'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
const PET_OVERLAY_COPY = {
  'en-US': {
    closePetMenuItem: 'Close pet',
    hideMessage: 'Hide message',
    expandMessage: 'Expand message',
    collapseMessage: 'Collapse message',
    restoreMessage: 'Show message',
    replyButton: 'Reply',
    replyPlaceholder: 'Reply...',
    sendButton: 'Send',
    sendingButton: 'Sending...',
    sendFailed: 'Failed to send',
  },
  'zh-CN': {
    closePetMenuItem: '关闭宠物',
    hideMessage: '隐藏消息',
    expandMessage: '展开消息',
    collapseMessage: '收起消息',
    restoreMessage: '显示消息',
    replyButton: '回复',
    replyPlaceholder: '输入回复...',
    sendButton: '发送',
    sendingButton: '发送中...',
    sendFailed: '发送失败',
  },
} satisfies Record<string, PetOverlayCopy>;
type PetOverlayCopyLocale = keyof typeof PET_OVERLAY_COPY;
type PetOverlayTheme = Exclude<NonNullable<ChatKitOptions['theme']>, string>;

type DragAnimationName = Extract<
  ChatKitPetAnimationName,
  'running-left' | 'running-right'
>;

type PetOverlayOptions = {
  onActivate?: () => void;
  onClose?: () => void;
  onReply?: (text: string) => Promise<void>;
  onThreadSummaryActivate?: (threadId: string) => void;
};

type SummaryDensityMetrics = {
  padding: string;
  gap: number;
  marginTop: number;
  toggleSize: number;
  actionSize: number;
};

function stopEventPropagation(event: Event): void {
  event.stopPropagation();
}

function getViewportSize(): PetViewport {
  const visualViewport = window.visualViewport;
  return {
    width: visualViewport?.width || window.innerWidth || 320,
    height: visualViewport?.height || window.innerHeight || 480,
  };
}

function readPersistedPosition(
  storageKey: string,
  persist: boolean,
): PetPosition | null {
  if (!persist) {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as { x?: unknown; y?: unknown } | null;
    if (
      !parsed ||
      typeof parsed !== 'object' ||
      typeof parsed.x !== 'number' ||
      typeof parsed.y !== 'number'
    ) {
      return null;
    }
    return { x: parsed.x, y: parsed.y };
  } catch {
    return null;
  }
}

function writePersistedPosition(
  storageKey: string,
  persist: boolean,
  position: PetPosition,
): void {
  if (!persist) {
    return;
  }

  try {
    window.localStorage.setItem(storageKey, JSON.stringify(position));
  } catch {
    // Persistence is best-effort; blocked storage should not break ChatKit.
  }
}

function escapeCssUrl(value: string): string {
  return value.replace(/["\\]/g, '\\$&');
}

function getRenderScale(scale: number): number {
  return Math.max(0.1, scale) * PET_BASE_RENDER_SCALE;
}

function clampNumber(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function getDefaultLocale(): string | null {
  if (typeof window !== 'undefined') {
    try {
      const stored = window.localStorage.getItem('chatkit:locale');
      if (stored) {
        return stored;
      }
    } catch {
      // Ignore unavailable localStorage in restricted host pages.
    }
  }

  return typeof navigator !== 'undefined' ? navigator.language : null;
}

function resolveCopyLocale(locale?: string | null): PetOverlayCopyLocale {
  const normalized = (locale ?? getDefaultLocale() ?? '').trim().toLowerCase();
  if (
    normalized === 'zh-cn' ||
    normalized === 'zh-hans' ||
    normalized.startsWith('zh')
  ) {
    return 'zh-CN';
  }

  return 'en-US';
}

function getSummaryDensityMetrics(
  density: NonNullable<PetOverlayTheme['density']>,
): SummaryDensityMetrics {
  switch (density) {
    case 'compact':
      return {
        padding: '8px 10px',
        gap: 6,
        marginTop: 3,
        toggleSize: 30,
        actionSize: 22,
      };
    case 'spacious':
      return {
        padding: '14px 16px',
        gap: 10,
        marginTop: 6,
        toggleSize: 38,
        actionSize: 28,
      };
    case 'normal':
    default:
      return {
        padding: '12px 14px',
        gap: 8,
        marginTop: 4,
        toggleSize: 34,
        actionSize: 26,
      };
  }
}

function getSummaryRadius(radius: PetOverlayTheme['radius']): number {
  switch (radius) {
    case 'pill':
      return 24;
    case 'round':
      return 16;
    case 'sharp':
      return 0;
    case 'soft':
    default:
      return 12;
  }
}

function getSummaryThemeMetrics(theme?: ChatKitOptions['theme'] | null) {
  const themeObject = typeof theme === 'string' ? null : theme;
  const baseSize = themeObject?.typography?.baseSize ?? 16;
  const density = themeObject?.density ?? 'normal';
  const densityOffset =
    density === 'compact' ? -1 : density === 'spacious' ? 1 : 0;
  const bodySize = clampNumber(baseSize - 2 + densityOffset, 11, 17);
  const densityMetrics = getSummaryDensityMetrics(density);

  return {
    ...densityMetrics,
    bodySize,
    titleSize: bodySize + 1,
    iconSize: clampNumber(bodySize + 2, 13, 19),
    radius: getSummaryRadius(themeObject?.radius),
    fontFamily: themeObject?.typography?.fontFamily ?? PET_SUMMARY_FONT_FAMILY,
  };
}

function isPetState(value: unknown): value is ChatKitPetAnimationName {
  return (
    value === 'idle' ||
    value === 'running-right' ||
    value === 'running-left' ||
    value === 'waving' ||
    value === 'jumping' ||
    value === 'failed' ||
    value === 'waiting' ||
    value === 'running' ||
    value === 'review'
  );
}

export function parsePetStateChangePayload(
  value: unknown,
): { state: ChatKitPetAnimationName } | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const payload = value as { state?: unknown };
  return isPetState(payload.state) ? { state: payload.state } : null;
}

export function parsePetOptionsChangePayload(
  value: unknown,
): { pet: ChatKitOptions['pet'] | null } | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const payload = value as { pet?: unknown };
  if (payload.pet === null || typeof payload.pet === 'boolean') {
    return { pet: payload.pet };
  }

  if (
    payload.pet &&
    typeof payload.pet === 'object' &&
    !Array.isArray(payload.pet)
  ) {
    return { pet: payload.pet as ChatKitOptions['pet'] };
  }

  return null;
}

function isThreadSummaryStatus(value: unknown): value is ThreadSummaryStatus {
  return value === 'running' || value === 'completed' || value === 'failed';
}

function getThreadSummaryKey(summary: ThreadSummary | null): string | null {
  if (!summary) {
    return null;
  }

  return [
    summary.threadId,
    summary.messageId || summary.updatedAt || summary.message,
  ].join(':');
}

function getThreadSummaryInteractionKey(
  summary: ThreadSummary | null,
): string | null {
  if (!summary) {
    return null;
  }

  return [summary.threadId, summary.messageId ?? ''].join(':');
}

function parseThreadSummaryPayload(
  value: unknown,
): { summary: ThreadSummary | null } | null {
  if (value === null) {
    return { summary: null };
  }

  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const payload = value as {
    threadId?: unknown;
    title?: unknown;
    message?: unknown;
    status?: unknown;
    messageId?: unknown;
    updatedAt?: unknown;
  };
  if (
    typeof payload.threadId !== 'string' ||
    !payload.threadId.trim() ||
    typeof payload.title !== 'string' ||
    !payload.title.trim() ||
    typeof payload.message !== 'string' ||
    !payload.message.trim() ||
    !isThreadSummaryStatus(payload.status)
  ) {
    return null;
  }

  return {
    summary: {
      threadId: payload.threadId,
      title: payload.title,
      message: payload.message,
      status: payload.status,
      ...(typeof payload.messageId === 'string' && payload.messageId.trim()
        ? { messageId: payload.messageId }
        : {}),
      ...(typeof payload.updatedAt === 'string' && payload.updatedAt.trim()
        ? { updatedAt: payload.updatedAt }
        : {}),
    },
  };
}

export function parseThreadSummaryLogPayload(
  value: unknown,
): { summary: ThreadSummary | null } | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const payload = value as {
    name?: unknown;
    data?: unknown;
  };
  if (payload.name !== 'thread.summary') {
    return null;
  }

  return parseThreadSummaryPayload(payload.data ?? null);
}

export class PetOverlay {
  private readonly root: ShadowRoot;
  private readonly onActivate?: () => void;
  private readonly onClose?: () => void;
  private readonly onReply?: (text: string) => Promise<void>;
  private readonly onThreadSummaryActivate?: (threadId: string) => void;
  private overlayElement: HTMLDivElement | null = null;
  private petElement: HTMLDivElement | null = null;
  private contextMenuElement: HTMLDivElement | null = null;
  private summaryElement: HTMLDivElement | null = null;
  private summaryToggleElement: HTMLButtonElement | null = null;
  private mediaElement: HTMLElement | null = null;
  private options: NormalizedPetOptions | null = null;
  private theme: ChatKitOptions['theme'] | null = null;
  private resolved: ResolvedPetCharacter | null = null;
  private summary: ThreadSummary | null = null;
  private summaryRenderKey: string | null = null;
  private dismissedSummaryKey: string | null = null;
  private isSummaryCollapsed = false;
  private isSummaryExpanded = false;
  private isSummaryHovering = false;
  private isReplyOpen = false;
  private isReplySubmitting = false;
  private replyError: string | null = null;
  private replyDraft = '';
  private replyInputElement: HTMLInputElement | null = null;
  private copyLocale: PetOverlayCopyLocale = resolveCopyLocale();
  private copy: PetOverlayCopy = PET_OVERLAY_COPY[this.copyLocale];
  private currentState: ChatKitPetAnimationName = 'waiting';
  private lastAutoState: ChatKitPetAnimationName = 'waiting';
  private transient: TransientAnimation | null = null;
  private position: PetPosition | null = null;
  private dragPosition: PetPosition | null = null;
  private dragOffset: PetPosition = { x: 0, y: 0 };
  private lastDragPosition: PetPosition | null = null;
  private lastDragClientX: number | null = null;
  private dragAnimation: DragAnimationName | null = null;
  private activePointerId: number | null = null;
  private isDragging = false;
  private isHovering = false;
  private movedDuringDrag = false;
  private prefersReducedMotion = false;
  private frame = 0;
  private completed = false;
  private activeAnimationName: ChatKitPetAnimationName | null = null;
  private activeAnimationMode: ChatKitPetAnimationMode | null = null;
  private frameTimer: number | null = null;
  private restingDelayTimer: number | null = null;
  private mediaQuery: MediaQueryList | null = null;
  private connected = false;

  constructor(root: ShadowRoot, options?: PetOverlayOptions) {
    this.root = root;
    this.onActivate = options?.onActivate;
    this.onClose = options?.onClose;
    this.onReply = options?.onReply;
    this.onThreadSummaryActivate = options?.onThreadSummaryActivate;
    this.connect();
  }

  connect(): void {
    if (this.connected) {
      return;
    }
    this.connected = true;
    this.installViewportListeners();
    this.installReducedMotionListener();
    this.render();
  }

  setOptions(
    pet: ChatKitOptions['pet'] | null,
    theme?: ChatKitOptions['theme'],
  ): void {
    this.closeContextMenu();
    const nextOptions = normalizePetOptions(pet);
    this.options = nextOptions;
    this.theme = theme ?? null;

    if (!nextOptions) {
      this.isDragging = false;
      this.isHovering = false;
      this.position = null;
      this.dragPosition = null;
      this.dragAnimation = null;
      this.lastDragPosition = null;
      this.lastDragClientX = null;
      this.transient = null;
      this.resolved = null;
      this.clearRestingDelayTimer();
      this.removeDragListeners();
      this.removeOverlay();
      return;
    }

    this.position = readPersistedPosition(
      DEFAULT_PET_STORAGE_KEY,
      nextOptions.position.persist,
    );

    if (nextOptions.behavior === 'auto' && !this.prefersReducedMotion) {
      this.transient = { name: 'waving' };
    }

    this.resolveCharacter();
    this.render();
  }

  setState(state: ChatKitPetAnimationName): void {
    const previous = this.lastAutoState;
    this.lastAutoState = state;
    this.currentState = state;

    if (
      this.options?.behavior === 'auto' &&
      !this.prefersReducedMotion &&
      state === 'idle' &&
      (previous === 'running' || previous === 'review') &&
      !this.transient
    ) {
      this.transient = { name: 'jumping' };
    } else if (state !== 'idle') {
      this.transient = null;
    }

    this.render();
  }

  setLocale(locale?: string | null): void {
    const nextLocale = resolveCopyLocale(locale);
    if (nextLocale === this.copyLocale) {
      return;
    }

    this.copyLocale = nextLocale;
    this.copy = PET_OVERLAY_COPY[nextLocale];
    this.summaryRenderKey = null;
    this.closeContextMenu();
    this.render();
  }

  setThreadSummary(summary: ThreadSummary | null): void {
    const previousKey = getThreadSummaryInteractionKey(this.summary);
    const nextKey = getThreadSummaryInteractionKey(summary);
    this.summary = summary;

    if (!summary) {
      this.isSummaryCollapsed = false;
      this.isSummaryExpanded = false;
      this.isSummaryHovering = false;
      this.isReplyOpen = false;
      this.isReplySubmitting = false;
      this.replyError = null;
      this.replyDraft = '';
      this.summaryRenderKey = null;
      this.removeSummaryElements();
      return;
    }

    if (previousKey !== nextKey) {
      this.isSummaryCollapsed = false;
      this.isSummaryExpanded = false;
      this.isSummaryHovering = false;
      this.isReplyOpen = false;
      this.isReplySubmitting = false;
      this.replyError = null;
      this.replyDraft = '';
    }

    this.render();
  }

  setThreadSummaryStatus(status: ThreadSummaryStatus): void {
    if (!this.summary || this.summary.status === status) {
      return;
    }

    this.summary = { ...this.summary, status };
    this.render();
  }

  destroy(): void {
    if (!this.connected) {
      return;
    }
    this.connected = false;
    this.clearRestingDelayTimer();
    this.clearTimers();
    this.removeDragListeners();
    this.removeOverlay();
    window.removeEventListener('resize', this.handleViewportChange);
    window.visualViewport?.removeEventListener(
      'resize',
      this.handleViewportChange,
    );
    window.visualViewport?.removeEventListener(
      'scroll',
      this.handleViewportChange,
    );
    this.mediaQuery?.removeEventListener?.(
      'change',
      this.handleReducedMotionChange,
    );
    this.mediaQuery = null;
  }

  private installViewportListeners(): void {
    window.addEventListener('resize', this.handleViewportChange);
    window.visualViewport?.addEventListener(
      'resize',
      this.handleViewportChange,
    );
    window.visualViewport?.addEventListener(
      'scroll',
      this.handleViewportChange,
    );
  }

  private installReducedMotionListener(): void {
    if (!window.matchMedia) {
      return;
    }

    this.mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    this.prefersReducedMotion = this.mediaQuery.matches;
    this.mediaQuery.addEventListener?.(
      'change',
      this.handleReducedMotionChange,
    );
  }

  private handleViewportChange = (): void => {
    this.closeContextMenu();
    this.render();
  };

  private handleReducedMotionChange = (): void => {
    this.prefersReducedMotion = Boolean(this.mediaQuery?.matches);
    if (this.prefersReducedMotion) {
      this.transient = null;
    }
    this.render();
  };

  private resolveCharacter(): void {
    if (!this.options) {
      this.resolved = null;
      return;
    }

    const character = this.options.character;
    this.resolved = resolvePetCharacter(character);
  }

  private ensureOverlay(): void {
    if (this.overlayElement && this.petElement) {
      return;
    }

    const overlay = document.createElement('div');
    overlay.setAttribute('data-chatkit-host-pet-layer', '');
    overlay.style.position = 'fixed';
    overlay.style.inset = '0';
    overlay.style.pointerEvents = 'none';
    overlay.style.overflow = 'visible';

    const style = document.createElement('style');
    style.textContent = `
      @keyframes chatkit-pet-summary-spin {
        to { transform: rotate(360deg); }
      }
    `;

    const pet = document.createElement('div');
    pet.setAttribute('data-chatkit-host-pet', '');
    pet.style.position = 'absolute';
    pet.style.top = '0';
    pet.style.left = '0';
    pet.style.pointerEvents = 'auto';
    pet.style.touchAction = 'none';
    pet.style.userSelect = 'none';
    pet.style.willChange = 'transform';
    pet.addEventListener('pointerenter', this.handlePointerEnter);
    pet.addEventListener('pointerleave', this.handlePointerLeave);
    pet.addEventListener('pointerdown', this.handlePointerDown);
    pet.addEventListener('lostpointercapture', this.handleLostPointerCapture);
    pet.addEventListener('contextmenu', this.handleContextMenu);
    pet.addEventListener('click', this.handleClick);

    overlay.append(style, pet);
    this.root.append(overlay);
    this.overlayElement = overlay;
    this.petElement = pet;
  }

  private removeOverlay(): void {
    this.cancelActiveDrag();
    this.clearRestingDelayTimer();
    this.clearTimers();
    this.closeContextMenu();
    if (this.petElement) {
      this.petElement.removeEventListener(
        'pointerenter',
        this.handlePointerEnter,
      );
      this.petElement.removeEventListener(
        'pointerleave',
        this.handlePointerLeave,
      );
      this.petElement.removeEventListener(
        'pointerdown',
        this.handlePointerDown,
      );
      this.petElement.removeEventListener(
        'lostpointercapture',
        this.handleLostPointerCapture,
      );
      this.petElement.removeEventListener(
        'contextmenu',
        this.handleContextMenu,
      );
      this.petElement.removeEventListener('click', this.handleClick);
    }
    this.isHovering = false;
    this.removeSummaryElements();
    this.overlayElement?.remove();
    this.overlayElement = null;
    this.petElement = null;
    this.mediaElement = null;
  }

  private removeSummaryElements(): void {
    this.summaryElement?.remove();
    this.summaryToggleElement?.remove();
    this.summaryElement = null;
    this.summaryToggleElement = null;
    this.replyInputElement = null;
    this.summaryRenderKey = null;
  }

  private getSize(): PetSize {
    if (!this.options || !this.resolved) {
      return { width: 0, height: 0 };
    }

    const scale = getRenderScale(this.options.position.scale);
    const baseSize = {
      width: this.resolved.atlas.cellWidth,
      height: this.resolved.atlas.cellHeight,
    };
    return {
      width: baseSize.width * scale,
      height: baseSize.height * scale,
    };
  }

  private getCurrentPosition(size: PetSize): PetPosition {
    const options = this.options;
    if (!options) {
      return { x: 0, y: 0 };
    }

    const viewport = getViewportSize();
    const padding = normalizeBoundsPadding(options.position.boundsPadding);
    const pin =
      options.position.pin === undefined
        ? 'bottom-right'
        : options.position.pin;
    const pinnedPosition = pin
      ? getPinnedPetPosition(pin, size, viewport, padding)
      : null;

    return clampPetPosition(
      this.dragPosition ??
        this.position ??
        pinnedPosition ?? { x: padding.left, y: padding.top },
      size,
      viewport,
      padding,
    );
  }

  private persistPosition(nextPosition: PetPosition): void {
    if (!this.options) {
      return;
    }

    const size = this.getSize();
    const clamped = clampPetPosition(
      nextPosition,
      size,
      getViewportSize(),
      normalizeBoundsPadding(this.options.position.boundsPadding),
    );
    this.position = clamped;
    writePersistedPosition(
      DEFAULT_PET_STORAGE_KEY,
      this.options.position.persist,
      clamped,
    );
  }

  private getActiveAnimationName(): ChatKitPetAnimationName {
    if (!this.options) {
      return 'idle';
    }

    if (this.isDragging) {
      return this.dragAnimation ?? 'running';
    }

    if (this.transient) {
      return this.transient.name;
    }

    if (this.options.behavior === 'manual') {
      return 'idle';
    }

    return this.currentState;
  }

  private getActiveAnimationMode(): ChatKitPetAnimationMode {
    if (this.isDragging) {
      return 'loop';
    }

    return this.transient ? 'once' : 'loop';
  }

  private resetAnimationIfNeeded(
    name: ChatKitPetAnimationName,
    mode: ChatKitPetAnimationMode,
  ): void {
    if (
      this.activeAnimationName === name &&
      this.activeAnimationMode === mode
    ) {
      return;
    }

    this.clearTimers();
    this.activeAnimationName = name;
    this.activeAnimationMode = mode;
    this.frame = 0;
    this.completed = false;
  }

  private render(): void {
    if (!this.options || !this.resolved) {
      this.clearTimers();
      if (this.petElement) {
        this.petElement.replaceChildren();
      }
      this.removeSummaryElements();
      this.mediaElement = null;
      this.activeAnimationName = null;
      this.activeAnimationMode = null;
      this.frame = 0;
      this.completed = false;
      return;
    }

    this.ensureOverlay();
    const overlay = this.overlayElement;
    const pet = this.petElement;
    if (!overlay || !pet) {
      return;
    }

    const size = this.getSize();
    const position = this.getCurrentPosition(size);
    const animationName = this.getActiveAnimationName();
    const animationMode = this.getActiveAnimationMode();
    this.resetAnimationIfNeeded(animationName, animationMode);

    overlay.style.zIndex = String(this.options.position.zIndex);
    pet.style.width = `${size.width}px`;
    pet.style.height = `${size.height}px`;
    pet.style.transform = `translate3d(${position.x}px, ${position.y}px, 0)`;
    pet.style.cursor = this.options.position.draggable
      ? this.isDragging
        ? 'grabbing'
        : 'grab'
      : 'default';
    pet.dataset.petAnimation = animationName;
    pet.setAttribute('aria-label', this.options.ariaLabel);
    pet.setAttribute('role', 'img');

    this.renderAtlas(animationName, animationMode);
    this.renderThreadSummary(position, size);

    this.scheduleNextFrame(animationName, animationMode);
  }

  private renderThreadSummary(position: PetPosition, size: PetSize): void {
    const summary = this.summary;
    const summaryKey = getThreadSummaryKey(summary);
    if (!summary || !summaryKey || this.dismissedSummaryKey === summaryKey) {
      this.removeSummaryElements();
      return;
    }

    if (this.isSummaryCollapsed) {
      this.renderCollapsedSummary(position, size);
      return;
    }

    const nextRenderKey = [
      this.copyLocale,
      this.isSummaryExpanded ? 'expanded' : 'compact',
      this.isSummaryHovering ? 'hover' : 'rest',
      this.isReplyOpen ? 'reply' : 'closed',
      this.isReplySubmitting ? 'submitting' : 'ready',
      this.replyError ?? '',
    ].join('|');

    if (!this.summaryElement || this.summaryRenderKey !== nextRenderKey) {
      this.summaryElement?.remove();
      this.summaryToggleElement?.remove();
      this.summaryElement = this.createSummaryBubble(summary);
      this.summaryToggleElement = this.createSummaryToggleButton('v');
      this.overlayElement?.append(
        this.summaryElement,
        this.summaryToggleElement,
      );
      this.summaryRenderKey = nextRenderKey;
      if (this.isReplyOpen && !this.isReplySubmitting) {
        window.setTimeout(() => this.replyInputElement?.focus(), 0);
      }
    }

    this.updateSummaryBubbleContent(summary);
    this.positionSummaryBubble(position, size);
  }

  private renderCollapsedSummary(position: PetPosition, size: PetSize): void {
    this.summaryElement?.remove();
    this.summaryElement = null;
    this.summaryRenderKey = null;

    if (!this.summaryToggleElement) {
      this.summaryToggleElement = this.createSummaryToggleButton('1');
      this.overlayElement?.append(this.summaryToggleElement);
    }

    this.summaryToggleElement.textContent = '1';
    this.positionSummaryToggleBadge(position, size);
  }

  private positionSummaryToggleBadge(
    position: PetPosition,
    size: PetSize,
  ): void {
    const badge = this.summaryToggleElement;
    if (!badge) {
      return;
    }

    const viewport = getViewportSize();
    const badgeSize = getSummaryThemeMetrics(this.theme).toggleSize;
    const x = clampNumber(
      position.x + size.width - badgeSize * 0.35,
      PET_SUMMARY_MARGIN,
      viewport.width - badgeSize - PET_SUMMARY_MARGIN,
    );
    const y = clampNumber(
      position.y - badgeSize * 0.35,
      PET_SUMMARY_MARGIN,
      viewport.height - badgeSize - PET_SUMMARY_MARGIN,
    );
    badge.style.width = `${badgeSize}px`;
    badge.style.height = `${badgeSize}px`;
    badge.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    badge.style.borderRadius = '999px';
  }

  private positionSummaryBubble(position: PetPosition, size: PetSize): void {
    const bubble = this.summaryElement;
    const toggle = this.summaryToggleElement;
    if (!bubble || !toggle) {
      return;
    }

    const viewport = getViewportSize();
    const width = Math.min(
      PET_SUMMARY_WIDTH,
      viewport.width - PET_SUMMARY_MARGIN * 2,
    );
    bubble.style.width = `${width}px`;
    const bubbleHeight = bubble.offsetHeight || 96;
    const aboveY = position.y - bubbleHeight - PET_SUMMARY_GAP;
    const showAbove = aboveY >= PET_SUMMARY_MARGIN;
    const y = showAbove
      ? aboveY
      : clampNumber(
          position.y + size.height + PET_SUMMARY_GAP,
          PET_SUMMARY_MARGIN,
          viewport.height - bubbleHeight - PET_SUMMARY_MARGIN,
        );
    const x = clampNumber(
      position.x + size.width / 2 - width / 2,
      PET_SUMMARY_MARGIN,
      viewport.width - width - PET_SUMMARY_MARGIN,
    );

    bubble.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    this.positionSummaryToggleBadge(position, size);
  }

  private createSummaryBubble(summary: ThreadSummary): HTMLDivElement {
    const shouldShowReplyButton = this.isSummaryHovering && !this.isReplyOpen;
    const metrics = getSummaryThemeMetrics(this.theme);

    const bubble = document.createElement('div');
    bubble.setAttribute('data-chatkit-pet-summary', '');
    bubble.addEventListener('pointerenter', this.handleSummaryPointerEnter);
    bubble.addEventListener('pointerleave', this.handleSummaryPointerLeave);
    bubble.addEventListener('click', this.handleSummaryClick);
    bubble.style.position = 'absolute';
    bubble.style.top = '0';
    bubble.style.left = '0';
    bubble.style.boxSizing = 'border-box';
    bubble.style.pointerEvents = 'auto';
    bubble.style.padding = metrics.padding;
    bubble.style.border = '1px solid rgba(148, 163, 184, 0.22)';
    bubble.style.borderRadius = `${metrics.radius}px`;
    bubble.style.background = 'rgba(255, 255, 255, 0.94)';
    bubble.style.color = '#1f2937';
    bubble.style.boxShadow = '0 8px 24px rgba(15, 23, 42, 0.1)';
    bubble.style.font = `500 ${metrics.bodySize}px/1.35 ${metrics.fontFamily}`;
    bubble.style.backdropFilter = 'blur(10px)';

    const header = document.createElement('div');
    header.style.display = 'flex';
    header.style.alignItems = 'center';
    header.style.gap = `${metrics.gap}px`;

    if (this.isSummaryHovering || this.isReplyOpen) {
      header.append(
        this.createSummaryActionButton(
          'x',
          this.copy.hideMessage,
          this.handleSummaryDelete,
        ),
      );
    }

    const title = document.createElement('div');
    title.textContent = summary.title;
    title.style.minWidth = '0';
    title.style.flex = '1';
    title.style.overflow = 'hidden';
    title.style.textOverflow = 'ellipsis';
    title.style.whiteSpace = 'nowrap';
    title.style.fontWeight = '700';
    title.style.fontSize = `${metrics.titleSize}px`;
    title.dataset.chatkitPetSummaryTitle = '';
    header.append(title);

    if (this.isSummaryHovering || this.isReplyOpen) {
      header.append(
        this.createSummaryActionButton(
          this.isSummaryExpanded ? '-' : '>',
          this.isSummaryExpanded
            ? this.copy.collapseMessage
            : this.copy.expandMessage,
          this.handleSummaryExpandToggle,
        ),
      );
    } else {
      header.append(this.createStatusIcon(summary.status));
    }

    const message = document.createElement('div');
    message.textContent = summary.message;
    message.style.marginTop = `${metrics.marginTop}px`;
    message.style.fontWeight = '400';
    message.style.color = '#374151';
    message.style.overflow = 'hidden';
    if (this.isSummaryExpanded) {
      message.style.maxHeight = '7em';
      message.style.overflowY = 'auto';
    } else {
      message.style.display = '-webkit-box';
      message.style.setProperty('-webkit-line-clamp', '2');
      message.style.setProperty('-webkit-box-orient', 'vertical');
    }
    message.dataset.chatkitPetSummaryMessage = '';

    bubble.append(header, message);

    if (shouldShowReplyButton) {
      const reply = this.createTextButton(
        this.copy.replyButton,
        this.handleReplyOpen,
      );
      reply.style.position = 'absolute';
      reply.style.right = '14px';
      reply.style.bottom = '10px';
      bubble.append(reply);
    }

    if (this.isReplyOpen) {
      bubble.append(this.createReplyForm());
    }

    return bubble;
  }

  private updateSummaryBubbleContent(summary: ThreadSummary): void {
    const title = this.summaryElement?.querySelector<HTMLElement>(
      '[data-chatkit-pet-summary-title]',
    );
    if (title && title.textContent !== summary.title) {
      title.textContent = summary.title;
    }

    const message = this.summaryElement?.querySelector<HTMLElement>(
      '[data-chatkit-pet-summary-message]',
    );
    if (message && message.textContent !== summary.message) {
      message.textContent = summary.message;
    }

    const statusIcon = this.summaryElement?.querySelector<HTMLElement>(
      '[data-chatkit-pet-summary-status]',
    );
    if (
      statusIcon &&
      statusIcon.dataset.chatkitPetSummaryStatus !== summary.status
    ) {
      const nextIcon = this.createStatusIcon(summary.status);
      statusIcon.replaceWith(nextIcon);
    }
  }

  private createSummaryToggleButton(label: string): HTMLButtonElement {
    const metrics = getSummaryThemeMetrics(this.theme);
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = label;
    button.title =
      label === '1' ? this.copy.restoreMessage : this.copy.collapseMessage;
    button.addEventListener('click', stopEventPropagation);
    button.addEventListener('click', this.handleSummaryCollapseToggle);
    button.style.position = 'absolute';
    button.style.top = '0';
    button.style.left = '0';
    button.style.pointerEvents = 'auto';
    button.style.border = '1px solid rgba(148, 163, 184, 0.28)';
    button.style.background = 'rgba(248, 250, 252, 0.94)';
    button.style.color = '#475569';
    button.style.boxShadow = '0 6px 18px rgba(15, 23, 42, 0.1)';
    button.style.cursor = 'pointer';
    button.style.font = `600 ${metrics.titleSize}px/1 ${metrics.fontFamily}`;
    button.style.display = 'flex';
    button.style.alignItems = 'center';
    button.style.justifyContent = 'center';
    return button;
  }

  private createStatusIcon(status: ThreadSummaryStatus): HTMLSpanElement {
    const metrics = getSummaryThemeMetrics(this.theme);
    const iconSize = metrics.iconSize;
    const icon = document.createElement('span');
    icon.setAttribute('aria-hidden', 'true');
    icon.dataset.chatkitPetSummaryStatus = status;
    icon.style.display = 'inline-flex';
    icon.style.width = `${iconSize}px`;
    icon.style.height = `${iconSize}px`;
    icon.style.alignItems = 'center';
    icon.style.justifyContent = 'center';
    icon.style.flex = '0 0 auto';

    if (status === 'running') {
      icon.style.border = '2px solid rgba(71, 85, 105, 0.32)';
      icon.style.borderTopColor = '#64748b';
      icon.style.borderRadius = '999px';
      icon.style.animation = 'chatkit-pet-summary-spin 900ms linear infinite';
      return icon;
    }

    icon.style.borderRadius = '999px';
    icon.style.fontSize = `${Math.max(10, iconSize - 4)}px`;
    icon.style.fontWeight = '700';
    if (status === 'failed') {
      icon.textContent = '!';
      icon.style.background = '#fee2e2';
      icon.style.color = '#b91c1c';
      return icon;
    }

    icon.textContent = '';
    icon.style.border = '2px solid #22c55e';
    icon.style.position = 'relative';
    const check = document.createElement('span');
    check.style.width = `${Math.round(iconSize * 0.44)}px`;
    check.style.height = `${Math.round(iconSize * 0.25)}px`;
    check.style.borderLeft = '2px solid #22c55e';
    check.style.borderBottom = '2px solid #22c55e';
    check.style.transform = 'rotate(-45deg) translate(1px, -1px)';
    icon.append(check);
    return icon;
  }

  private createSummaryActionButton(
    label: string,
    title: string,
    onClick: () => void,
  ): HTMLButtonElement {
    const metrics = getSummaryThemeMetrics(this.theme);
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = label;
    button.title = title;
    button.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      onClick();
    });
    button.style.width = `${metrics.actionSize}px`;
    button.style.height = `${metrics.actionSize}px`;
    button.style.border = '0';
    button.style.borderRadius = '999px';
    button.style.background = 'rgba(241, 245, 249, 0.96)';
    button.style.color = '#475569';
    button.style.cursor = 'pointer';
    button.style.font = `600 ${metrics.titleSize}px/1 ${metrics.fontFamily}`;
    return button;
  }

  private createTextButton(
    label: string,
    onClick: () => void,
  ): HTMLButtonElement {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = label;
    button.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      onClick();
    });
    button.style.border = '1px solid rgba(148, 163, 184, 0.28)';
    button.style.borderRadius = '999px';
    button.style.background = 'rgba(248, 250, 252, 0.95)';
    button.style.color = '#334155';
    button.style.cursor = 'pointer';
    button.style.padding = '3px 10px';
    button.style.font =
      '600 12px/1.4 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    return button;
  }

  private createReplyForm(): HTMLFormElement {
    const form = document.createElement('form');
    form.addEventListener('click', stopEventPropagation);
    form.addEventListener('submit', this.handleReplySubmit);
    form.addEventListener('keydown', this.handleReplyKeyDown);
    form.style.display = 'flex';
    form.style.gap = '6px';
    form.style.alignItems = 'center';
    form.style.marginTop = '8px';

    const input = document.createElement('input');
    input.type = 'text';
    input.value = this.replyDraft;
    input.disabled = this.isReplySubmitting;
    input.placeholder = this.copy.replyPlaceholder;
    input.addEventListener('input', this.handleReplyInput);
    input.style.minWidth = '0';
    input.style.flex = '1';
    input.style.border = '1px solid rgba(148, 163, 184, 0.35)';
    input.style.borderRadius = '999px';
    input.style.padding = '6px 10px';
    input.style.font =
      '400 13px/1.2 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    this.replyInputElement = input;

    const send = document.createElement('button');
    send.type = 'submit';
    send.textContent = this.isReplySubmitting
      ? this.copy.sendingButton
      : this.copy.sendButton;
    send.disabled = this.isReplySubmitting;
    send.style.border = '0';
    send.style.borderRadius = '999px';
    send.style.background = '#22c55e';
    send.style.color = '#052e16';
    send.style.cursor = this.isReplySubmitting ? 'default' : 'pointer';
    send.style.padding = '6px 10px';
    send.style.font =
      '700 12px/1.2 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

    form.append(input, send);

    if (this.replyError) {
      const error = document.createElement('div');
      error.textContent = this.copy.sendFailed;
      error.style.flexBasis = '100%';
      error.style.color = '#b91c1c';
      error.style.fontSize = '12px';
      form.style.flexWrap = 'wrap';
      form.append(error);
    }

    return form;
  }

  private createContextMenu(): HTMLDivElement {
    const menu = document.createElement('div');
    menu.setAttribute('data-chatkit-pet-context-menu', '');
    menu.setAttribute('role', 'menu');
    menu.addEventListener('contextmenu', this.handleContextMenuEvent);
    menu.addEventListener('pointerdown', stopEventPropagation);
    menu.addEventListener('click', stopEventPropagation);
    menu.style.position = 'absolute';
    menu.style.top = '0';
    menu.style.left = '0';
    menu.style.boxSizing = 'border-box';
    menu.style.minWidth = '132px';
    menu.style.padding = '4px';
    menu.style.pointerEvents = 'auto';
    menu.style.border = '1px solid rgba(148, 163, 184, 0.28)';
    menu.style.borderRadius = '10px';
    menu.style.background = 'rgba(255, 255, 255, 0.96)';
    menu.style.color = '#1f2937';
    menu.style.boxShadow = '0 12px 28px rgba(15, 23, 42, 0.16)';
    menu.style.font =
      '500 13px/1.3 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    menu.style.backdropFilter = 'blur(10px)';

    const closeItem = document.createElement('button');
    closeItem.type = 'button';
    closeItem.textContent = this.copy.closePetMenuItem;
    closeItem.setAttribute('role', 'menuitem');
    closeItem.addEventListener('click', this.handleClosePetMenuItemClick);
    closeItem.style.display = 'block';
    closeItem.style.width = '100%';
    closeItem.style.border = '0';
    closeItem.style.borderRadius = '7px';
    closeItem.style.background = 'transparent';
    closeItem.style.color = 'inherit';
    closeItem.style.cursor = 'pointer';
    closeItem.style.padding = '7px 10px';
    closeItem.style.textAlign = 'left';
    closeItem.style.font = 'inherit';

    menu.append(closeItem);
    return menu;
  }

  private openContextMenu(position: PetPosition): void {
    const overlay = this.overlayElement;
    if (!overlay) {
      return;
    }

    this.closeContextMenu();
    const menu = this.createContextMenu();
    overlay.append(menu);
    this.contextMenuElement = menu;
    this.positionContextMenu(position);
    menu.querySelector('button')?.focus({ preventScroll: true });
    window.addEventListener(
      'pointerdown',
      this.handleContextMenuOutsidePointerDown,
      true,
    );
    window.addEventListener('keydown', this.handleContextMenuKeyDown);
  }

  private closeContextMenu(): void {
    this.contextMenuElement?.remove();
    this.contextMenuElement = null;
    window.removeEventListener(
      'pointerdown',
      this.handleContextMenuOutsidePointerDown,
      true,
    );
    window.removeEventListener('keydown', this.handleContextMenuKeyDown);
  }

  private positionContextMenu(position: PetPosition): void {
    const menu = this.contextMenuElement;
    if (!menu) {
      return;
    }

    const viewport = getViewportSize();
    const width = menu.offsetWidth || 132;
    const height = menu.offsetHeight || 40;
    const maxX = Math.max(
      PET_CONTEXT_MENU_MARGIN,
      viewport.width - width - PET_CONTEXT_MENU_MARGIN,
    );
    const maxY = Math.max(
      PET_CONTEXT_MENU_MARGIN,
      viewport.height - height - PET_CONTEXT_MENU_MARGIN,
    );
    const x = clampNumber(position.x, PET_CONTEXT_MENU_MARGIN, maxX);
    const y = clampNumber(position.y, PET_CONTEXT_MENU_MARGIN, maxY);
    menu.style.transform = `translate3d(${x}px, ${y}px, 0)`;
  }

  private renderAtlas(
    animationName: ChatKitPetAnimationName,
    animationMode: ChatKitPetAnimationMode,
  ): void {
    if (!this.petElement || this.resolved?.kind !== 'atlas' || !this.options) {
      return;
    }

    if (!(this.mediaElement instanceof HTMLDivElement)) {
      const frame = document.createElement('div');
      frame.setAttribute('aria-hidden', 'true');
      this.petElement.replaceChildren(frame);
      this.mediaElement = frame;
    }

    const frameElement = this.mediaElement;
    const atlas = this.resolved.atlas;
    const definition = atlas.animations[animationName] ?? atlas.animations.idle;
    const safeFrame =
      animationMode === 'once' && this.completed
        ? Math.max(0, definition.frames - 1)
        : Math.min(this.frame, Math.max(0, definition.frames - 1));
    const scale = getRenderScale(this.options.position.scale);
    const sourceWidth = atlas.cellWidth;
    const sourceHeight = atlas.cellHeight;
    const backgroundWidth = atlas.columns * sourceWidth;
    const backgroundHeight = atlas.rows * sourceHeight;

    frameElement.style.width = `${sourceWidth}px`;
    frameElement.style.height = `${sourceHeight}px`;
    frameElement.style.overflow = 'hidden';
    frameElement.style.transform = `scale(${scale})`;
    frameElement.style.transformOrigin = 'top left';
    frameElement.style.pointerEvents = 'none';
    frameElement.style.backgroundImage = `url("${escapeCssUrl(
      this.resolved.src,
    )}")`;
    frameElement.style.backgroundRepeat = 'no-repeat';
    frameElement.style.backgroundSize = `${backgroundWidth}px ${backgroundHeight}px`;
    frameElement.style.backgroundPosition = `${-safeFrame * sourceWidth}px ${
      -definition.row * sourceHeight
    }px`;
    frameElement.style.imageRendering = this.options.imageRendering;
    frameElement.dataset.petFrame = String(safeFrame);
  }

  private scheduleNextFrame(
    animationName: ChatKitPetAnimationName,
    animationMode: ChatKitPetAnimationMode,
  ): void {
    if (this.prefersReducedMotion || this.completed || !this.resolved) {
      this.clearTimers();
      return;
    }

    if (this.frameTimer !== null) {
      return;
    }

    const atlas: PetSpriteAtlasDefinition = this.resolved.atlas;
    const definition = atlas.animations[animationName] ?? atlas.animations.idle;
    const duration =
      definition.frameDurations[this.frame] ??
      definition.frameDurations[definition.frameDurations.length - 1] ??
      150;
    const baseDuration = duration * PET_FRAME_DURATION_MULTIPLIER;
    const effectiveDuration =
      this.isHovering || this.isDragging
        ? baseDuration
        : baseDuration * PET_RESTING_FRAME_DURATION_MULTIPLIER;

    this.frameTimer = window.setTimeout(() => {
      this.frameTimer = null;
      const nextFrame = this.frame + 1;

      if (nextFrame >= definition.frames) {
        if (animationMode === 'once') {
          this.completed = true;
          this.frame = Math.max(0, definition.frames - 1);
          this.finishTransient();
          return;
        }

        this.frame = 0;
        this.render();
        return;
      }

      this.frame = nextFrame;
      this.render();
    }, effectiveDuration);
  }

  private clearTimers(): void {
    if (this.frameTimer !== null) {
      window.clearTimeout(this.frameTimer);
      this.frameTimer = null;
    }
  }

  private clearRestingDelayTimer(): void {
    if (this.restingDelayTimer !== null) {
      window.clearTimeout(this.restingDelayTimer);
      this.restingDelayTimer = null;
    }
  }

  private finishTransient(): void {
    this.transient = null;
    this.activeAnimationName = null;
    this.activeAnimationMode = null;
    this.render();
  }

  private rescheduleAnimation(): void {
    this.clearTimers();
    this.render();
  }

  private enterRestingAfterDelay(): void {
    this.clearRestingDelayTimer();
    this.isHovering = true;
    this.restingDelayTimer = window.setTimeout(() => {
      this.restingDelayTimer = null;
      if (this.isDragging) {
        return;
      }
      this.isHovering = false;
      this.rescheduleAnimation();
    }, PET_RESTING_DELAY_MS);
  }

  private isPointOverPet(clientX: number, clientY: number): boolean {
    const rect = this.petElement?.getBoundingClientRect();
    if (!rect) {
      return false;
    }

    return (
      clientX >= rect.left &&
      clientX <= rect.right &&
      clientY >= rect.top &&
      clientY <= rect.bottom
    );
  }

  private isPointerOverPet(event: PointerEvent): boolean {
    return this.isPointOverPet(event.clientX, event.clientY);
  }

  private handlePointerEnter = (): void => {
    this.clearRestingDelayTimer();
    this.isHovering = true;
    this.rescheduleAnimation();
  };

  private handlePointerLeave = (): void => {
    if (!this.isDragging) {
      this.enterRestingAfterDelay();
    }
  };

  private handleContextMenu = (event: MouseEvent): void => {
    event.preventDefault();
    event.stopPropagation();
    this.openContextMenu({ x: event.clientX, y: event.clientY });
  };

  private handleContextMenuEvent = (event: Event): void => {
    event.preventDefault();
    event.stopPropagation();
  };

  private handleContextMenuOutsidePointerDown = (event: PointerEvent): void => {
    const menu = this.contextMenuElement;
    if (menu && event.composedPath().includes(menu)) {
      return;
    }

    this.closeContextMenu();
  };

  private handleContextMenuKeyDown = (event: KeyboardEvent): void => {
    if (event.key !== 'Escape') {
      return;
    }

    event.preventDefault();
    this.closeContextMenu();
  };

  private handleClosePetMenuItemClick = (event: Event): void => {
    event.preventDefault();
    event.stopPropagation();
    this.closeContextMenu();
    this.onClose?.();
  };

  private handleSummaryPointerEnter = (): void => {
    this.isSummaryHovering = true;
    this.render();
  };

  private handleSummaryPointerLeave = (): void => {
    this.isSummaryHovering = false;
    if (!this.isReplyOpen) {
      this.render();
    }
  };

  private handleSummaryClick = (): void => {
    const threadId = this.summary?.threadId.trim();
    if (!threadId) {
      return;
    }

    this.onThreadSummaryActivate?.(threadId);
  };

  private handleSummaryDelete = (): void => {
    const summaryKey = getThreadSummaryKey(this.summary);
    if (summaryKey) {
      this.dismissedSummaryKey = summaryKey;
    }
    this.isSummaryCollapsed = false;
    this.isReplyOpen = false;
    this.replyDraft = '';
    this.replyError = null;
    this.removeSummaryElements();
  };

  private handleSummaryCollapseToggle = (): void => {
    this.isSummaryCollapsed = !this.isSummaryCollapsed;
    this.isSummaryExpanded = false;
    this.isReplyOpen = false;
    this.replyError = null;
    this.render();
  };

  private handleSummaryExpandToggle = (): void => {
    this.isSummaryExpanded = !this.isSummaryExpanded;
    this.render();
  };

  private handleReplyOpen = (): void => {
    this.isReplyOpen = true;
    this.replyError = null;
    this.render();
  };

  private handleReplyInput = (event: Event): void => {
    const target = event.currentTarget;
    if (target instanceof HTMLInputElement) {
      this.replyDraft = target.value;
      this.replyError = null;
    }
  };

  private handleReplySubmit = (event: Event): void => {
    event.preventDefault();
    void this.submitReply();
  };

  private handleReplyKeyDown = (event: KeyboardEvent): void => {
    if (event.key !== 'Escape') {
      return;
    }

    event.preventDefault();
    this.isReplyOpen = false;
    this.replyError = null;
    this.render();
  };

  private async submitReply(): Promise<void> {
    const text = this.replyDraft.trim();
    if (!text || this.isReplySubmitting) {
      return;
    }

    this.isReplySubmitting = true;
    this.replyError = null;
    this.render();
    try {
      await this.onReply?.(text);
      this.replyDraft = '';
      this.isReplyOpen = false;
      this.isSummaryHovering = false;
    } catch {
      this.replyError = 'Failed to send';
    } finally {
      this.isReplySubmitting = false;
      this.render();
    }
  }

  private handlePointerDown = (event: PointerEvent): void => {
    if (event.button !== 0 || event.ctrlKey || this.isDragging) {
      return;
    }

    this.closeContextMenu();

    if (!this.options?.position.draggable) {
      return;
    }

    event.preventDefault();
    const rect = this.petElement?.getBoundingClientRect();
    if (!rect) {
      return;
    }

    const nextPosition = {
      x: rect.left,
      y: rect.top,
    };
    this.dragOffset = {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };
    this.lastDragPosition = nextPosition;
    this.lastDragClientX = event.clientX;
    this.dragAnimation = null;
    this.movedDuringDrag = false;
    this.dragPosition = nextPosition;
    this.isDragging = true;
    this.activePointerId = event.pointerId;
    this.clearRestingDelayTimer();
    this.isHovering = true;
    this.captureActivePointer();
    this.installDragListeners();
    this.rescheduleAnimation();
  };

  private captureActivePointer(): void {
    const pointerId = this.activePointerId;
    const pet = this.petElement;
    if (pointerId === null || typeof pet?.setPointerCapture !== 'function') {
      return;
    }

    try {
      pet.setPointerCapture(pointerId);
    } catch {
      // Keep the window-listener fallback for older or restricted hosts.
    }
  }

  private releaseActivePointer(): void {
    const pointerId = this.activePointerId;
    const pet = this.petElement;
    this.activePointerId = null;
    if (
      pointerId === null ||
      typeof pet?.hasPointerCapture !== 'function' ||
      typeof pet.releasePointerCapture !== 'function'
    ) {
      return;
    }

    try {
      if (pet.hasPointerCapture(pointerId)) {
        pet.releasePointerCapture(pointerId);
      }
    } catch {
      // Capture may already have been released by pointerup/pointercancel.
    }
  }

  private isActiveDragPointer(event: PointerEvent): boolean {
    return this.isDragging && event.pointerId === this.activePointerId;
  }

  private getNextDragPosition(event: PointerEvent): PetPosition {
    if (!this.options) {
      return { x: 0, y: 0 };
    }

    return clampPetPosition(
      {
        x: event.clientX - this.dragOffset.x,
        y: event.clientY - this.dragOffset.y,
      },
      this.getSize(),
      getViewportSize(),
      normalizeBoundsPadding(this.options.position.boundsPadding),
    );
  }

  private handlePointerMove = (event: PointerEvent): void => {
    if (!this.isActiveDragPointer(event)) {
      return;
    }

    const nextPosition = this.getNextDragPosition(event);
    const last = this.lastDragPosition;
    if (
      last &&
      (Math.abs(last.x - nextPosition.x) > DRAG_DIRECTION_THRESHOLD_PX ||
        Math.abs(last.y - nextPosition.y) > DRAG_DIRECTION_THRESHOLD_PX)
    ) {
      this.movedDuringDrag = true;
    }

    if (this.lastDragClientX !== null) {
      const deltaX = event.clientX - this.lastDragClientX;
      if (deltaX > DRAG_DIRECTION_THRESHOLD_PX) {
        this.dragAnimation = 'running-right';
      } else if (deltaX < -DRAG_DIRECTION_THRESHOLD_PX) {
        this.dragAnimation = 'running-left';
      }
    }

    this.lastDragClientX = event.clientX;
    this.lastDragPosition = nextPosition;
    this.dragPosition = nextPosition;
    this.render();
  };

  private handlePointerUp = (event: PointerEvent): void => {
    if (!this.isActiveDragPointer(event)) {
      return;
    }

    const finalPosition =
      this.lastDragPosition ?? this.getNextDragPosition(event);
    this.finishDrag(finalPosition, event);
  };

  private handleLostPointerCapture = (event: PointerEvent): void => {
    if (!this.isActiveDragPointer(event)) {
      return;
    }

    const finalPosition =
      this.lastDragPosition ?? this.getNextDragPosition(event);
    this.finishDrag(finalPosition, event);
  };

  private finishDrag(finalPosition: PetPosition, event: PointerEvent): void {
    this.isDragging = false;
    this.dragPosition = null;
    this.dragAnimation = null;
    this.lastDragClientX = null;
    this.removeDragListeners();
    this.releaseActivePointer();
    this.persistPosition(finalPosition);
    if (event.pointerType === 'mouse' && this.isPointerOverPet(event)) {
      this.isHovering = true;
      this.rescheduleAnimation();
    } else {
      this.enterRestingAfterDelay();
      this.rescheduleAnimation();
    }
  }

  private cancelActiveDrag(): void {
    this.isDragging = false;
    this.dragPosition = null;
    this.dragAnimation = null;
    this.lastDragPosition = null;
    this.lastDragClientX = null;
    this.removeDragListeners();
    this.releaseActivePointer();
  }

  private handleClick = (): void => {
    if (this.movedDuringDrag) {
      return;
    }
    this.onActivate?.();
    if (this.prefersReducedMotion) {
      return;
    }
    this.transient = { name: 'waving' };
    this.render();
  };

  private installDragListeners(): void {
    window.addEventListener('pointermove', this.handlePointerMove);
    window.addEventListener('pointerup', this.handlePointerUp);
    window.addEventListener('pointercancel', this.handlePointerUp);
  }

  private removeDragListeners(): void {
    window.removeEventListener('pointermove', this.handlePointerMove);
    window.removeEventListener('pointerup', this.handlePointerUp);
    window.removeEventListener('pointercancel', this.handlePointerUp);
  }
}
