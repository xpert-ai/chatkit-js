import './styles.css';

import {
  EXTENSION_MESSAGE_SOURCE,
  HOST_AUTOMATION_REQUEST_MESSAGE,
  HOST_AUTOMATION_RESPONSE_MESSAGE,
  OVERLAY_HIT_REGIONS_MESSAGE,
  OVERLAY_STYLE_MESSAGE,
} from './messages';
import type {
  ChatKitOptions,
  ClientToolMessageInput,
} from '@xpert-ai/chatkit-types';
import { readConfig, readConfigChange } from './storage';
import type { ChatKitDisplayMode, ChatKitExtensionConfig } from './types';
import { mountChatKitHost } from './host';
import { createChromeExtensionPlatform } from './platform/chrome/api';

const root = document.getElementById('app');

if (!root) {
  throw new Error('Missing overlay root element.');
}

const appRoot = root;
let currentConfig: ChatKitExtensionConfig | null = null;
let interactionActive = false;
let lastPointer: { x: number; y: number } | null = null;
let hostAutomationNonce = 0;
let minimizedStateObserver: MutationObserver | null = null;
let observedChatkitElement: HTMLElement | null = null;

type HostAutomationResponseMessage = {
  source?: unknown;
  type?: unknown;
  nonce?: unknown;
  response?: unknown;
  error?: unknown;
};

function createHostAutomationNonce(): string {
  hostAutomationNonce += 1;
  return `host_automation_${Date.now()}_${hostAutomationNonce}`;
}

function isHostAutomationResponseMessage(
  value: unknown,
): value is HostAutomationResponseMessage {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function createOverlayHostAutomationHandler(): ChatKitOptions['onClientTool'] {
  return (call) =>
    new Promise<ClientToolMessageInput>((resolve, reject) => {
      const nonce = createHostAutomationNonce();
      const timeout = window.setTimeout(() => {
        window.removeEventListener('message', handleMessage);
        reject(new Error('Timed out waiting for host page automation result.'));
      }, 30_000);

      const handleMessage = (event: MessageEvent) => {
        if (event.source !== window.parent) {
          return;
        }

        const message = event.data;
        if (
          !isHostAutomationResponseMessage(message) ||
          message.source !== EXTENSION_MESSAGE_SOURCE ||
          message.type !== HOST_AUTOMATION_RESPONSE_MESSAGE ||
          message.nonce !== nonce
        ) {
          return;
        }

        window.clearTimeout(timeout);
        window.removeEventListener('message', handleMessage);
        if (message.error) {
          reject(new Error(String(message.error)));
        } else {
          resolve(message.response as ClientToolMessageInput);
        }
      };

      window.addEventListener('message', handleMessage);
      window.parent.postMessage(
        {
          source: EXTENSION_MESSAGE_SOURCE,
          type: HOST_AUTOMATION_REQUEST_MESSAGE,
          nonce,
          call,
        },
        '*',
      );
    });
}

function getChatkitElement(): HTMLElement | null {
  const element = appRoot.querySelector('xpertai-chatkit');
  return element instanceof HTMLElement ? element : null;
}

function isChatMinimizedToPet(): boolean {
  return getChatkitElement()?.dataset.chatMinimizedToPet === 'true';
}

function getEffectiveDisplayMode(
  config: ChatKitExtensionConfig | null = currentConfig,
): ChatKitDisplayMode | undefined {
  return isChatMinimizedToPet() ? 'pet' : config?.displayMode;
}

function notifyOverlayStyle(config: ChatKitExtensionConfig) {
  window.parent.postMessage(
    {
      source: EXTENSION_MESSAGE_SOURCE,
      type: OVERLAY_STYLE_MESSAGE,
      overlay: config.overlay,
      displayMode: getEffectiveDisplayMode(config),
    },
    '*',
  );
}

function notifyOverlayState() {
  if (currentConfig) {
    notifyOverlayStyle(currentConfig);
  }
  notifyHitRegions();
}

function observeChatkitMinimizeState() {
  const chatkit = getChatkitElement();
  if (chatkit === observedChatkitElement) {
    return;
  }

  minimizedStateObserver?.disconnect();
  observedChatkitElement = chatkit;

  if (!chatkit) {
    minimizedStateObserver = null;
    return;
  }

  minimizedStateObserver = new MutationObserver(notifyOverlayState);
  minimizedStateObserver.observe(chatkit, {
    attributes: true,
    attributeFilter: ['data-chat-minimized-to-pet'],
  });
}

function isVisibleHitElement(element: Element): element is HTMLElement {
  if (!(element instanceof HTMLElement)) {
    return false;
  }

  const style = window.getComputedStyle(element);
  if (
    style.display === 'none' ||
    style.visibility === 'hidden' ||
    style.pointerEvents === 'none' ||
    style.opacity === '0'
  ) {
    return false;
  }

  const rect = element.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

function getHitRegions() {
  const chatkit = appRoot.querySelector('xpertai-chatkit');
  const shadow = chatkit?.shadowRoot;
  if (!shadow) {
    return [];
  }

  return Array.from(
    shadow.querySelectorAll(
      [
        '[data-chatkit-host-pet]',
        '[data-chatkit-pet-summary]',
        '.ck-wrapper',
        '.ck-launcher-close',
      ].join(','),
    ),
  )
    .filter(isVisibleHitElement)
    .map((element) => {
      const rect = element.getBoundingClientRect();
      return {
        top: rect.top,
        right: rect.right,
        bottom: rect.bottom,
        left: rect.left,
      };
    });
}

function notifyHitRegions() {
  window.parent.postMessage(
    {
      source: EXTENSION_MESSAGE_SOURCE,
      type: OVERLAY_HIT_REGIONS_MESSAGE,
      displayMode: getEffectiveDisplayMode(),
      regions: getHitRegions(),
      interactionActive,
      pointer: lastPointer,
    },
    '*',
  );
}

function startHitRegionSync() {
  let frame = 0;
  const tick = () => {
    frame += 1;
    if (frame % 6 === 0 || interactionActive) {
      notifyHitRegions();
    }

    window.requestAnimationFrame(tick);
  };

  window.requestAnimationFrame(tick);
}

const platform = createChromeExtensionPlatform();

async function main() {
  const config = await readConfig(platform.storage);
  currentConfig = config;
  notifyOverlayStyle(config);

  const host = mountChatKitHost(appRoot, config, 'pageOverlay', {
    openOptionsPage: platform.openOptionsPage,
    onClientTool: createOverlayHostAutomationHandler(),
  });
  observeChatkitMinimizeState();

  platform.onStorageChanged?.addListener((changes, areaName) => {
    if (areaName !== 'local') {
      return;
    }

    const nextConfig = readConfigChange(changes);
    if (nextConfig) {
      currentConfig = nextConfig;
      notifyOverlayStyle(nextConfig);
      host.update(nextConfig);
      observeChatkitMinimizeState();
      notifyHitRegions();
    }
  });

  window.addEventListener(
    'pointermove',
    (event) => {
      lastPointer = { x: event.clientX, y: event.clientY };
      notifyHitRegions();
    },
    { passive: true },
  );

  window.addEventListener(
    'pointerdown',
    (event) => {
      interactionActive = true;
      lastPointer = { x: event.clientX, y: event.clientY };
      notifyHitRegions();
    },
    { capture: true },
  );

  window.addEventListener(
    'pointerup',
    (event) => {
      interactionActive = false;
      lastPointer = { x: event.clientX, y: event.clientY };
      notifyHitRegions();
    },
    { capture: true },
  );

  window.addEventListener(
    'pointercancel',
    (event) => {
      interactionActive = false;
      lastPointer = { x: event.clientX, y: event.clientY };
      notifyHitRegions();
    },
    { capture: true },
  );

  startHitRegionSync();

  window.addEventListener('pagehide', () => {
    minimizedStateObserver?.disconnect();
    host.destroy();
  });
}

void main();
