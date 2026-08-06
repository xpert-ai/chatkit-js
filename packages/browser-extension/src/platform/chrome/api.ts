import type {
  HostPageAutomationClientToolCall,
  HostPageAutomationClientToolHandler,
} from 'packages/host-automation/src';
import type { ClientToolMessageInput } from '@xpert-ai/chatkit-types';

import { validateConfig } from '../../config';
import {
  BROWSER_RUNNER_COMMAND_MESSAGE,
  OPEN_OVERLAY_MESSAGE,
  RUN_HOST_AUTOMATION_IN_TAB_MESSAGE,
  RUN_HOST_AUTOMATION_MESSAGE,
  TOGGLE_OVERLAY_MESSAGE,
} from '../../messages';
import { readConfig } from '../../storage';
import type { ChatKitExtensionConfig } from '../../types';
import { withDefaultHostAutomationResultDelay } from '../../host-automation-delay';
import {
  clearCdpAutomationStateForTab,
  runCdpHostAutomation,
  type ChromeDebuggerApi,
} from './cdp-automation';
import {
  createNativeRunnerBridge,
  type BrowserRunnerStatus,
  type ChromeRuntimePort,
  type NativeRunnerRequest,
  type NativeRunnerResponse,
} from './native-runner';

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

type ChromeMessageSender = {
  tab?: ChromeTab;
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
    getURL: (path: string) => string;
    openOptionsPage: () => Promise<void> | void;
    sendMessage?: (message: Record<string, unknown>) => Promise<unknown>;
    connectNative?: (application: string) => ChromeRuntimePort;
    onMessage?: {
      addListener: (
        listener: (
          message: Record<string, unknown>,
          sender: ChromeMessageSender,
          sendResponse: (response?: unknown) => void,
        ) => boolean | void,
      ) => void;
    };
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
    update?: (
      tabId: number,
      updateProperties: { url: string },
    ) => Promise<ChromeTab | undefined> | void;
    sendMessage: (
      tabId: number,
      message: Record<string, unknown>,
    ) => Promise<unknown>;
    onUpdated?: {
      addListener: (listener: ChromeTabUpdateListener) => void;
    };
    onRemoved?: {
      addListener: (listener: (tabId: number) => void) => void;
    };
  };
  scripting: {
    executeScript: (details: {
      target: { tabId: number };
      files?: string[];
      func?: (...args: string[]) => unknown;
      args?: string[];
    }) => Promise<unknown>;
  };
  sidePanel?: {
    open?: (options: { tabId?: number; windowId?: number }) => Promise<void>;
    setPanelBehavior?: (options: {
      openPanelOnActionClick: boolean;
    }) => Promise<void>;
  };
  debugger?: ChromeDebuggerApi;
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

async function sendOverlayMessageWithInjection(
  api: ChromeApi,
  tabId: number,
  type: typeof OPEN_OVERLAY_MESSAGE | typeof TOGGLE_OVERLAY_MESSAGE,
) {
  return sendMessageWithInjection(api, tabId, { type });
}

async function sendMessageWithInjection(
  api: ChromeApi,
  tabId: number,
  message: Record<string, unknown>,
) {
  try {
    return await api.tabs.sendMessage(tabId, message);
  } catch {
    await injectContentScript(api, tabId);
    return api.tabs.sendMessage(tabId, message);
  }
}

async function injectContentScript(api: ChromeApi, tabId: number) {
  await api.scripting.executeScript({
    target: { tabId },
    func: async (scriptUrl: string) => {
      await import(scriptUrl);
      return true;
    },
    args: [api.runtime.getURL(CONTENT_SCRIPT_FILE)],
  });
}

function unwrapHostAutomationResponse(value: unknown): ClientToolMessageInput {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('Invalid host automation response.');
  }

  const response = value as {
    ok?: unknown;
    response?: unknown;
    error?: unknown;
  };
  if (response.ok !== true) {
    throw new Error(
      typeof response.error === 'string'
        ? response.error
        : 'Host automation failed.',
    );
  }

  return response.response as ClientToolMessageInput;
}

function hasAccessibilityRefTarget(call: HostPageAutomationClientToolCall) {
  const params = call.params;
  if (!params || typeof params !== 'object' || Array.isArray(params)) {
    return false;
  }

  const record = params as Record<string, unknown>;
  const axRef = record.axRef;
  const ref = record.ref;
  const hasAxRef =
    (typeof axRef === 'string' && axRef.trim()) ||
    (typeof axRef === 'number' && Number.isFinite(axRef));
  const hasDomRef = typeof ref === 'string' && ref.trim();
  return Boolean(hasAxRef && !hasDomRef);
}

function hasV2PageState(call: HostPageAutomationClientToolCall) {
  return Boolean(
    call.params &&
    typeof call.params === 'object' &&
    !Array.isArray(call.params) &&
    'pageStateId' in call.params &&
    typeof call.params.pageStateId === 'string' &&
    call.params.pageStateId.trim(),
  );
}

function isStructuredBrowserAutomationError(response: ClientToolMessageInput) {
  if (typeof response.content !== 'string') return false;
  try {
    const content = JSON.parse(response.content);
    return Boolean(
      content &&
      typeof content === 'object' &&
      !Array.isArray(content) &&
      (typeof content.code === 'string' ||
        content.outcome === 'rejected_before_execution'),
    );
  } catch {
    return false;
  }
}

function createHostAutomationToolMessage(
  call: HostPageAutomationClientToolCall,
  status: 'success' | 'error',
  content: unknown,
): ClientToolMessageInput {
  return {
    tool_call_id: call.tool_call_id ?? call.id,
    name: call.name,
    status,
    content: JSON.stringify(content),
  };
}

function resolveNavigationUrl(
  tab: ActiveChromeTab,
  call: HostPageAutomationClientToolCall,
) {
  if (call.name !== 'host_page_navigate') {
    return null;
  }

  const params = call.params;
  const rawUrl =
    params && typeof params === 'object' && !Array.isArray(params)
      ? (params as Record<string, unknown>).url
      : undefined;
  if (typeof rawUrl !== 'string' || !rawUrl.trim()) {
    throw new Error('url must be a non-empty string.');
  }

  const nextUrl = new URL(rawUrl, tab.url);
  if (nextUrl.protocol !== 'http:' && nextUrl.protocol !== 'https:') {
    throw new Error('Navigation only supports HTTP(S) URLs.');
  }

  return nextUrl.toString();
}

async function navigateRestrictedTab(
  api: ChromeApi,
  tab: ActiveChromeTab,
  call: HostPageAutomationClientToolCall,
): Promise<ClientToolMessageInput> {
  if (!api.tabs.update) {
    throw new Error('Chrome tabs.update API is not available.');
  }

  const url = resolveNavigationUrl(tab, call);
  if (!url) {
    throw new Error('Host page automation can only run on HTTP(S) pages.');
  }

  await api.tabs.update(tab.id, { url });
  return createHostAutomationToolMessage(call, 'success', {
    ok: true,
    result: {
      navigated: url,
      strategy: 'chrome_tabs_update',
    },
  });
}

async function runHostAutomationForTab(
  api: ChromeApi,
  tab: ActiveChromeTab,
  call: HostPageAutomationClientToolCall,
): Promise<ClientToolMessageInput> {
  if (!isInjectableTabUrl(tab.url)) {
    return withDefaultHostAutomationResultDelay(call, () =>
      navigateRestrictedTab(api, tab, call),
    );
  }

  if (api.debugger) {
    const cdpResponse = await withDefaultHostAutomationResultDelay(call, () =>
      runCdpHostAutomation(api, tab, call),
    );
    if (
      cdpResponse.status !== 'error' ||
      hasAccessibilityRefTarget(call) ||
      hasV2PageState(call) ||
      isStructuredBrowserAutomationError(cdpResponse)
    ) {
      return cdpResponse;
    }
  }

  const response = await sendMessageWithInjection(api, tab.id, {
    type: RUN_HOST_AUTOMATION_MESSAGE,
    call,
  });
  return unwrapHostAutomationResponse(response);
}

function readNativeRunnerResponse(value: unknown): NativeRunnerResponse {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Invalid browser runner response.');
  }
  const response = value as NativeRunnerResponse;
  if (response.ok !== true) {
    throw new Error(response.error ?? 'The browser runner command failed.');
  }
  return response;
}

export function createChromeExtensionPlatform(api: ChromeApi = getChromeApi()) {
  const requestBrowserRunner = async (request: NativeRunnerRequest) => {
    if (!api.runtime.sendMessage) {
      throw new Error('Chrome runtime messaging is not available.');
    }
    return readNativeRunnerResponse(
      await api.runtime.sendMessage({
        type: BROWSER_RUNNER_COMMAND_MESSAGE,
        ...request,
      }),
    );
  };

  const getBrowserRunnerStatus = async (): Promise<BrowserRunnerStatus> => {
    const response = await requestBrowserRunner({ command: 'status' });
    return response.status ?? { state: 'stopped' };
  };

  const startBrowserRunner = async (startUrl?: string) => {
    const response = await requestBrowserRunner({
      command: 'start',
      ...(startUrl ? { startUrl } : {}),
    });
    return response.status ?? { state: 'stopped' as const };
  };

  const stopBrowserRunner = async () => {
    const response = await requestBrowserRunner({ command: 'stop' });
    return response.status ?? { state: 'stopped' as const };
  };

  const runHostAutomationInBrowserRunner = async (
    call: HostPageAutomationClientToolCall,
  ): Promise<ClientToolMessageInput> => {
    await requestBrowserRunner({ command: 'start' });
    const response = await requestBrowserRunner({
      command: 'execute',
      call,
    });
    if (!response.result) {
      throw new Error('The browser runner returned no tool result.');
    }
    return response.result as ClientToolMessageInput;
  };

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

  const runHostAutomationForActiveTab: HostPageAutomationClientToolHandler =
    async (call: HostPageAutomationClientToolCall) => {
      const config = await readConfig(api.storage.local);
      if (!config.hostAutomation.enabled) {
        throw new Error('Host page automation is disabled.');
      }

      if (config.hostAutomation.provider === 'isolated_runner') {
        return runHostAutomationInBrowserRunner(call);
      }

      const tab = await queryActiveTab(api);
      return runHostAutomationForTab(api, tab, call);
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
    const nativeRunnerBridge = api.runtime.connectNative
      ? createNativeRunnerBridge(api.runtime.connectNative)
      : undefined;
    const configure = () => {
      void restrictStorageAccess();
      void api.sidePanel?.setPanelBehavior?.({
        openPanelOnActionClick: false,
      });
    };

    api.runtime.onMessage?.addListener((message, sender, sendResponse) => {
      if (message.type === BROWSER_RUNNER_COMMAND_MESSAGE) {
        if (!nativeRunnerBridge) {
          sendResponse({
            requestId: '',
            ok: false,
            error: 'Chrome Native Messaging is not available.',
          });
          return false;
        }
        const command = message.command;
        if (
          command !== 'status' &&
          command !== 'start' &&
          command !== 'stop' &&
          command !== 'execute'
        ) {
          sendResponse({
            requestId: '',
            ok: false,
            error: 'Invalid browser runner command.',
          });
          return false;
        }
        void nativeRunnerBridge
          .request({
            command,
            ...(typeof message.startUrl === 'string'
              ? { startUrl: message.startUrl }
              : {}),
            ...(message.call &&
            typeof message.call === 'object' &&
            !Array.isArray(message.call)
              ? { call: message.call as Record<string, unknown> }
              : {}),
          })
          .then(sendResponse, (error) =>
            sendResponse({
              requestId: '',
              ok: false,
              error: error instanceof Error ? error.message : String(error),
            }),
          );
        return true;
      }

      if (message.type !== RUN_HOST_AUTOMATION_IN_TAB_MESSAGE) {
        return false;
      }

      const tab = sender.tab;
      if (!tab || typeof tab.id !== 'number') {
        sendResponse({ ok: false, error: 'No sender tab is available.' });
        return false;
      }
      const senderTab: ActiveChromeTab = { ...tab, id: tab.id };

      const call = message.call;
      if (typeof call !== 'object' || call === null || Array.isArray(call)) {
        sendResponse({ ok: false, error: 'Invalid host automation request.' });
        return false;
      }

      void readConfig(api.storage.local)
        .then((config) => {
          if (!config.hostAutomation.enabled) {
            throw new Error('Host page automation is disabled.');
          }

          if (config.hostAutomation.provider === 'isolated_runner') {
            if (!nativeRunnerBridge) {
              throw new Error('Chrome Native Messaging is not available.');
            }
            return nativeRunnerBridge
              .request({ command: 'start' })
              .then((response) => readNativeRunnerResponse(response))
              .then(() =>
                nativeRunnerBridge.request({
                  command: 'execute',
                  call: call as Record<string, unknown>,
                }),
              )
              .then((response) => {
                if (response.ok !== true || !response.result) {
                  throw new Error(
                    response.error ?? 'The browser runner returned no result.',
                  );
                }
                return response.result as ClientToolMessageInput;
              });
          }

          return runHostAutomationForTab(
            api,
            senderTab,
            call as HostPageAutomationClientToolCall,
          );
        })
        .then(
          (response) => sendResponse({ ok: true, response }),
          (error) =>
            sendResponse({
              ok: false,
              error:
                error instanceof Error
                  ? error.message
                  : 'Host automation failed.',
            }),
        );
      return true;
    });

    configure();
    api.runtime.onInstalled?.addListener(configure);
    api.runtime.onStartup?.addListener(configure);
    api.tabs.onUpdated?.addListener((tabId, changeInfo, tab) => {
      if (changeInfo.status !== 'complete') {
        return;
      }

      void openPageOverlayForTab({ ...tab, id: tabId }).catch(() => undefined);
    });
    api.tabs.onRemoved?.addListener(clearCdpAutomationStateForTab);
  };

  return {
    storage: api.storage.local,
    onStorageChanged: api.storage.onChanged,
    openOptionsPage,
    openSidePanelForActiveTab,
    togglePageOverlayForActiveTab,
    openPageOverlayForTab,
    runHostAutomationForActiveTab,
    getBrowserRunnerStatus,
    startBrowserRunner,
    stopBrowserRunner,
    restrictStorageAccess,
    initializeBackground,
  };
}
