import { TOGGLE_OVERLAY_MESSAGE } from '../../messages';

export type ChromeTab = {
  id?: number;
  url?: string;
  windowId?: number;
};

type ActiveChromeTab = ChromeTab & {
  id: number;
};

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

async function queryActiveTab(api: ChromeApi): Promise<ActiveChromeTab> {
  const [tab] = await api.tabs.query({ active: true, currentWindow: true });
  if (!tab || typeof tab.id !== 'number') {
    throw new Error('No active tab is available.');
  }

  return { ...tab, id: tab.id };
}

async function sendToggleMessage(api: ChromeApi, tabId: number) {
  return api.tabs.sendMessage(tabId, {
    type: TOGGLE_OVERLAY_MESSAGE,
  });
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

    try {
      return await sendToggleMessage(api, tab.id);
    } catch {
      await api.scripting.executeScript({
        target: { tabId: tab.id },
        files: [CONTENT_SCRIPT_FILE],
      });
      return sendToggleMessage(api, tab.id);
    }
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
  };

  return {
    storage: api.storage.local,
    onStorageChanged: api.storage.onChanged,
    openOptionsPage,
    openSidePanelForActiveTab,
    togglePageOverlayForActiveTab,
    restrictStorageAccess,
    initializeBackground,
  };
}
