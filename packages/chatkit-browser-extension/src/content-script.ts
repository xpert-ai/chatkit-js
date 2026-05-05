type ChromeRuntimeMessage = {
  type?: unknown;
};

type OverlayStyleMessage = {
  source?: unknown;
  type?: unknown;
  overlay?: {
    width?: unknown;
    height?: unknown;
    position?: unknown;
  };
  displayMode?: unknown;
};

type OverlayHitRegion = {
  top?: unknown;
  right?: unknown;
  bottom?: unknown;
  left?: unknown;
};

type NormalizedHitRegion = {
  top: number;
  right: number;
  bottom: number;
  left: number;
};

type OverlayHitRegionsMessage = {
  source?: unknown;
  type?: unknown;
  displayMode?: unknown;
  regions?: unknown;
  interactionActive?: unknown;
  pointer?: {
    x?: unknown;
    y?: unknown;
  };
};

declare const chrome: {
  runtime: {
    getURL: (path: string) => string;
    onMessage: {
      addListener: (
        listener: (
          message: ChromeRuntimeMessage,
          sender: unknown,
          sendResponse: (response?: unknown) => void,
        ) => boolean | void,
      ) => void;
    };
  };
};

const FRAME_ID = 'xpertai-chatkit-extension-overlay-frame';
const OPEN_OVERLAY_MESSAGE = 'xpertai.chatkit.openOverlay';
const TOGGLE_OVERLAY_MESSAGE = 'xpertai.chatkit.toggleOverlay';
const OVERLAY_STYLE_MESSAGE = 'xpertai.chatkit.overlayStyle';
const OVERLAY_HIT_REGIONS_MESSAGE = 'xpertai.chatkit.overlayHitRegions';
const EXTENSION_MESSAGE_SOURCE = 'xpertai.chatkit.browserExtension';
const HIT_REGION_PADDING = 8;

let currentDisplayMode: unknown = 'pet';
let hitRegions: NormalizedHitRegion[] = [];
let interactionActive = false;
let lastPointer: { x: number; y: number } | null = null;

function normalizeDimension(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function isOverlayStyleMessage(value: unknown): value is OverlayStyleMessage {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isOverlayHitRegionsMessage(
  value: unknown,
): value is OverlayHitRegionsMessage {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeHitRegion(value: unknown): NormalizedHitRegion | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return null;
  }

  const region = value as OverlayHitRegion;
  const top = typeof region.top === 'number' ? region.top : Number.NaN;
  const right = typeof region.right === 'number' ? region.right : Number.NaN;
  const bottom = typeof region.bottom === 'number' ? region.bottom : Number.NaN;
  const left = typeof region.left === 'number' ? region.left : Number.NaN;

  if (![top, right, bottom, left].every(Number.isFinite)) {
    return null;
  }

  return { top, right, bottom, left };
}

function normalizeHitRegions(value: unknown): NormalizedHitRegion[] {
  return Array.isArray(value)
    ? value.flatMap((entry) => {
        const region = normalizeHitRegion(entry);
        return region ? [region] : [];
      })
    : [];
}

function isPointInHitRegion(point: { x: number; y: number }): boolean {
  return hitRegions.some(
    (region) =>
      point.x >= region.left - HIT_REGION_PADDING &&
      point.x <= region.right + HIT_REGION_PADDING &&
      point.y >= region.top - HIT_REGION_PADDING &&
      point.y <= region.bottom + HIT_REGION_PADDING,
  );
}

function getFrame(): HTMLIFrameElement | null {
  return document.getElementById(FRAME_ID) as HTMLIFrameElement | null;
}

function syncPointerEvents(frame = getFrame()) {
  if (!frame) {
    return;
  }

  if (currentDisplayMode !== 'pet') {
    frame.style.pointerEvents = 'auto';
    return;
  }

  if (interactionActive) {
    frame.style.pointerEvents = 'auto';
    return;
  }

  frame.style.pointerEvents =
    lastPointer && isPointInHitRegion(lastPointer) ? 'auto' : 'none';
}

function applyFramePosition(
  frame: HTMLIFrameElement,
  position: unknown = 'bottom-right',
) {
  frame.style.top = 'auto';
  frame.style.right = 'auto';
  frame.style.bottom = 'auto';
  frame.style.left = 'auto';

  switch (position) {
    case 'bottom-left':
      frame.style.bottom = '20px';
      frame.style.left = '20px';
      break;
    case 'top-right':
      frame.style.top = '20px';
      frame.style.right = '20px';
      break;
    case 'top-left':
      frame.style.top = '20px';
      frame.style.left = '20px';
      break;
    default:
      frame.style.right = '20px';
      frame.style.bottom = '20px';
      break;
  }
}

function applyOverlayStyle(
  frame: HTMLIFrameElement,
  overlay?: OverlayStyleMessage['overlay'],
  displayMode?: unknown,
) {
  if (displayMode === 'pet') {
    frame.style.inset = '0';
    frame.style.width = '100vw';
    frame.style.height = '100vh';
    frame.style.border = '0';
    frame.style.borderRadius = '0';
    frame.style.background = 'transparent';
    frame.style.boxShadow = 'none';
    syncPointerEvents(frame);
  } else {
    const width = normalizeDimension(overlay?.width, 420);
    const height = normalizeDimension(overlay?.height, 720);

    frame.style.width = `min(${width}px, calc(100vw - 32px))`;
    frame.style.height = `min(${height}px, calc(100vh - 32px))`;
    frame.style.borderRadius = '10px';
    frame.style.border = '1px solid rgba(15, 23, 42, 0.18)';
    frame.style.background = '#fff';
    frame.style.boxShadow = '0 24px 80px rgba(15, 23, 42, 0.24)';
    frame.style.pointerEvents = 'auto';
    applyFramePosition(frame, overlay?.position);
  }
}

function createFrame(): HTMLIFrameElement {
  const frame = document.createElement('iframe');
  frame.id = FRAME_ID;
  frame.src = chrome.runtime.getURL('overlay.html');
  frame.title = 'Xpert ChatKit';
  frame.setAttribute('allow', 'clipboard-read; clipboard-write');
  frame.style.position = 'fixed';
  frame.style.zIndex = '2147483647';
  frame.style.colorScheme = 'light';
  frame.style.overflow = 'hidden';
  applyOverlayStyle(frame, undefined, 'pet');
  document.documentElement.appendChild(frame);
  return frame;
}

function openOverlay(): boolean {
  if (getFrame()) {
    return true;
  }

  createFrame();
  return true;
}

function toggleOverlay(): boolean {
  const existing = getFrame();
  if (existing) {
    existing.remove();
    return false;
  }

  createFrame();
  return true;
}

window.addEventListener('message', (event) => {
  const frame = getFrame();
  if (!frame || event.source !== frame.contentWindow) {
    return;
  }

  const message = event.data;
  if (
    !isOverlayStyleMessage(message) ||
    message.source !== EXTENSION_MESSAGE_SOURCE
  ) {
    return;
  }

  if (message.type === OVERLAY_STYLE_MESSAGE) {
    currentDisplayMode = message.displayMode;
    applyOverlayStyle(frame, message.overlay, message.displayMode);
    return;
  }

  if (
    message.type === OVERLAY_HIT_REGIONS_MESSAGE &&
    isOverlayHitRegionsMessage(message)
  ) {
    const hitMessage = message as OverlayHitRegionsMessage;
    currentDisplayMode = hitMessage.displayMode;
    hitRegions = normalizeHitRegions(hitMessage.regions);
    interactionActive = hitMessage.interactionActive === true;

    if (
      typeof hitMessage.pointer?.x === 'number' &&
      typeof hitMessage.pointer?.y === 'number'
    ) {
      lastPointer = {
        x: hitMessage.pointer.x,
        y: hitMessage.pointer.y,
      };
    }

    syncPointerEvents(frame);
  }
});

window.addEventListener(
  'pointermove',
  (event) => {
    lastPointer = { x: event.clientX, y: event.clientY };
    syncPointerEvents();
  },
  { passive: true },
);

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (
    message.type !== TOGGLE_OVERLAY_MESSAGE &&
    message.type !== OPEN_OVERLAY_MESSAGE
  ) {
    return false;
  }

  try {
    sendResponse({
      ok: true,
      open:
        message.type === OPEN_OVERLAY_MESSAGE ? openOverlay() : toggleOverlay(),
    });
  } catch (error) {
    sendResponse({
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : 'Failed to toggle ChatKit overlay.',
    });
  }

  return false;
});
