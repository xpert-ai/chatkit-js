import { validateConfig } from '../../config';
import { OPEN_OVERLAY_MESSAGE, TOGGLE_OVERLAY_MESSAGE } from '../../messages';
import { readConfig } from '../../storage';
import type { ChatKitExtensionConfig } from '../../types';

export type ChromeTab = {
  id?: number;
  url?: string;
  windowId?: number;
};

type ActiveChromeTab = ChromeTab & {
  id: number;
};

type ChromeTabUpdateChangeInfo = {
  status?: string;
  url?: string;
};

type ChromeTabUpdateListener = (
  tabId: number,
  changeInfo: ChromeTabUpdateChangeInfo,
  tab: ChromeTab,
) => void;

export type ChromeStorageArea = {
  get: (keys?: string | string[] | null) => Promise<Record<string, unknown>>;
  set: (items: Record<string, unknown>) => Promise<void>;
  setAccessLevel?: (options: {
    accessLevel: 'TRUSTED_CONTEXTS';
  }) => Promise<void>;
};

export type ChromeApi = {
  runtime: {
    openOptionsPage: () => Promise<void> | void;
    onInstalled?: {
      addListener: (listener: () => void) => void;
    };
    onStartup?: {
      addListener: (listener: () => void) => void;
    };
  };
  storage: {
    local: ChromeStorageArea;
    onChanged?: {
      addListener: (
        listener: (
          changes: Record<string, { oldValue?: unknown; newValue?: unknown }>,
          areaName: string,
        ) => void,
      ) => void;
    };
  };
  tabs: {
    query: (queryInfo: {
      active: boolean;
      currentWindow: boolean;
    }) => Promise<ChromeTab[]>;
    sendMessage: (
      tabId: number,
      message: Record<string, unknown>,
    ) => Promise<unknown>;
    onUpdated?: {
      addListener: (listener: ChromeTabUpdateListener) => void;
    };
  };
  scripting: {
    executeScript: (details: {
      target: { tabId: number };
      files: string[];
    }) => Promise<unknown>;
  };
  sidePanel?: {
    open?: (options: { tabId?: number; windowId?: number }) => Promise<void>;
    setPanelBehavior?: (options: {
      openPanelOnActionClick: boolean;
    }) => Promise<void>;
  };
};

export type ChromeExtensionPlatform = ReturnType<
  typeof createChromeExtensionPlatform
>;

declare const chrome: ChromeApi;

const CONTENT_SCRIPT_FILE = 'content-script.js';

function getChromeApi(): ChromeApi {
  return chrome;
}

export function isInjectableTabUrl(url: string | undefined): boolean {
  return typeof url === 'string' && /^https?:\/\//i.test(url);
}

export function shouldAutoOpenPagePet(config: ChatKitExtensionConfig): boolean {
  return (
    config.surfaces.pageOverlay &&
    config.surfaces.autoPageOverlay &&
    config.displayMode === 'pet' &&
    validateConfig(config).ok
  );
}

async function queryActiveTab(api: ChromeApi): Promise<ActiveChromeTab> {
  const [tab] = await api.tabs.query({ active: true, currentWindow: true });
  if (!tab || typeof tab.id !== 'number') {
    throw new Error('No active tab is available.');
  }

  return { ...tab, id: tab.id };
}

async function sendOverlayMessage(
  api: ChromeApi,
  tabId: number,
  type: typeof OPEN_OVERLAY_MESSAGE | typeof TOGGLE_OVERLAY_MESSAGE,
) {
  return api.tabs.sendMessage(tabId, {
    type,
  });
}

async function sendOverlayMessageWithInjection(
  api: ChromeApi,
  tabId: number,
  type: typeof OPEN_OVERLAY_MESSAGE | typeof TOGGLE_OVERLAY_MESSAGE,
) {
  try {
    return await sendOverlayMessage(api, tabId, type);
  } catch {
    await api.scripting.executeScript({
      target: { tabId },
      files: [CONTENT_SCRIPT_FILE],
    });
    return sendOverlayMessage(api, tabId, type);
  }
}

export function createChromeExtensionPlatform(api: ChromeApi = getChromeApi()) {
  const openOptionsPage = async () => {
    await api.runtime.openOptionsPage();
  };

  const openSidePanelForActiveTab = async () => {
    if (!api.sidePanel?.open) {
      throw new Error('Chrome side panel API is not available.');
    }

    const tab = await queryActiveTab(api);
    await api.sidePanel.open({ tabId: tab.id });
  };

  const togglePageOverlayForActiveTab = async () => {
    const tab = await queryActiveTab(api);
    if (!isInjectableTabUrl(tab.url)) {
      throw new Error(
        'ChatKit overlay can only be injected into HTTP(S) pages.',
      );
    }

    return sendOverlayMessageWithInjection(api, tab.id, TOGGLE_OVERLAY_MESSAGE);
  };

  const openPageOverlayForTab = async (tab: ActiveChromeTab) => {
    if (!isInjectableTabUrl(tab.url)) {
      return false;
    }

    const config = await readConfig(api.storage.local);
    if (!shouldAutoOpenPagePet(config)) {
      return false;
    }

    await sendOverlayMessageWithInjection(api, tab.id, OPEN_OVERLAY_MESSAGE);
    return true;
  };

  const restrictStorageAccess = async () => {
    if (!api.storage.local.setAccessLevel) {
      return;
    }

    await api.storage.local.setAccessLevel({
      accessLevel: 'TRUSTED_CONTEXTS',
    });
  };

  const initializeBackground = () => {
    const configure = () => {
      void restrictStorageAccess();
      void api.sidePanel?.setPanelBehavior?.({
        openPanelOnActionClick: false,
      });
    };

    configure();
    api.runtime.onInstalled?.addListener(configure);
    api.runtime.onStartup?.addListener(configure);
    api.tabs.onUpdated?.addListener((tabId, changeInfo, tab) => {
      if (changeInfo.status !== 'complete') {
        return;
      }

      void openPageOverlayForTab({ ...tab, id: tabId }).catch(() => undefined);
    });
  };

  return {
    storage: api.storage.local,
    onStorageChanged: api.storage.onChanged,
    openOptionsPage,
    openSidePanelForActiveTab,
    togglePageOverlayForActiveTab,
    openPageOverlayForTab,
    restrictStorageAccess,
    initializeBackground,
  };
}
