import { describe, expect, it, vi } from 'vitest';

import {
  createChromeExtensionPlatform,
  isInjectableTabUrl,
  shouldAutoOpenPagePet,
  type ChromeApi,
} from './api';
import {
  OPEN_OVERLAY_MESSAGE,
  RUN_HOST_AUTOMATION_IN_TAB_MESSAGE,
  RUN_HOST_AUTOMATION_MESSAGE,
  TOGGLE_OVERLAY_MESSAGE,
} from '../../messages';
import { STORAGE_KEY, normalizeConfig } from '../../config';

function createChromeApi(overrides: Partial<ChromeApi> = {}): ChromeApi {
  return {
    runtime: {
      getURL: vi.fn((path: string) => `chrome-extension://extension/${path}`),
      openOptionsPage: vi.fn(async () => undefined),
      onInstalled: { addListener: vi.fn() },
      onStartup: { addListener: vi.fn() },
    },
    storage: {
      local: {
        get: vi.fn(async () => ({})),
        set: vi.fn(async () => undefined),
        setAccessLevel: vi.fn(async () => undefined),
      },
      onChanged: { addListener: vi.fn() },
    },
    tabs: {
      query: vi.fn(async () => [
        { id: 42, url: 'https://example.com', windowId: 7 },
      ]),
      update: vi.fn(async (_tabId, updateProperties) => ({
        id: 42,
        url: updateProperties.url,
        windowId: 7,
      })),
      sendMessage: vi.fn(async () => ({ ok: true, open: true })),
      onUpdated: { addListener: vi.fn() },
    },
    scripting: {
      executeScript: vi.fn(async () => undefined),
    },
    sidePanel: {
      open: vi.fn(async () => undefined),
      setPanelBehavior: vi.fn(async () => undefined),
    },
    ...overrides,
  };
}

describe('chrome extension platform', () => {
  it('detects injectable tab URLs', () => {
    expect(isInjectableTabUrl('https://example.com')).toBe(true);
    expect(isInjectableTabUrl('http://localhost:3000')).toBe(true);
    expect(isInjectableTabUrl('chrome://extensions')).toBe(false);
    expect(isInjectableTabUrl('about:blank')).toBe(false);
  });

  it('only auto opens the page pet for valid pet overlay configs', () => {
    expect(
      shouldAutoOpenPagePet(
        normalizeConfig({
          frameUrl: 'https://chat.example/frame',
          apiUrl: 'https://api.example/api/ai',
          clientSecret: 'secret',
          displayMode: 'pet',
          surfaces: { pageOverlay: true, autoPageOverlay: true },
        }),
      ),
    ).toBe(true);

    expect(
      shouldAutoOpenPagePet(
        normalizeConfig({
          frameUrl: 'https://chat.example/frame',
          apiUrl: 'https://api.example/api/ai',
          clientSecret: 'secret',
          displayMode: 'chat',
          surfaces: { pageOverlay: true, autoPageOverlay: true },
        }),
      ),
    ).toBe(false);
  });

  it('opens the side panel for the active tab', async () => {
    const api = createChromeApi();

    await createChromeExtensionPlatform(api).openSidePanelForActiveTab();

    expect(api.sidePanel?.open).toHaveBeenCalledWith({ tabId: 42 });
  });

  it('injects the content script when overlay message delivery fails', async () => {
    const api = createChromeApi({
      tabs: {
        query: vi.fn(async () => [{ id: 42, url: 'https://example.com' }]),
        sendMessage: vi
          .fn()
          .mockRejectedValueOnce(new Error('Receiving end does not exist.'))
          .mockResolvedValueOnce({ ok: true, open: true }),
      },
    });

    await expect(
      createChromeExtensionPlatform(api).togglePageOverlayForActiveTab(),
    ).resolves.toEqual({ ok: true, open: true });

    expect(api.scripting.executeScript).toHaveBeenCalledWith(
      expect.objectContaining({
        target: { tabId: 42 },
        args: ['chrome-extension://extension/content-script.js'],
      }),
    );
    expect(api.tabs.sendMessage).toHaveBeenLastCalledWith(42, {
      type: TOGGLE_OVERLAY_MESSAGE,
    });
    expect(api.tabs.sendMessage).toHaveBeenCalledTimes(2);
  });

  it('auto opens page pet on completed HTTP tabs when enabled', async () => {
    const api = createChromeApi();
    const onUpdatedListeners: Array<
      Parameters<NonNullable<ChromeApi['tabs']['onUpdated']>['addListener']>[0]
    > = [];
    api.tabs.onUpdated = {
      addListener: vi.fn((listener) => {
        onUpdatedListeners.push(listener);
      }),
    };
    api.storage.local.get = vi.fn(async () => ({
      [STORAGE_KEY]: {
        frameUrl: 'https://chat.example/frame',
        apiUrl: 'https://api.example/api/ai',
        clientSecret: 'secret',
        displayMode: 'pet',
        surfaces: { pageOverlay: true, autoPageOverlay: true },
      },
    }));

    createChromeExtensionPlatform(api).initializeBackground();
    const onUpdated = onUpdatedListeners[0];
    if (!onUpdated) {
      throw new Error('Expected tab update listener to be registered.');
    }

    onUpdated(42, { status: 'complete' }, { id: 42, url: 'https://site.test' });
    await new Promise((resolve) => window.setTimeout(resolve, 0));

    expect(api.tabs.sendMessage).toHaveBeenCalledWith(42, {
      type: OPEN_OVERLAY_MESSAGE,
    });
  });

  it('blocks overlay injection on restricted browser pages', async () => {
    const api = createChromeApi({
      tabs: {
        query: vi.fn(async () => [{ id: 42, url: 'chrome://extensions' }]),
        sendMessage: vi.fn(),
      },
    });

    await expect(
      createChromeExtensionPlatform(api).togglePageOverlayForActiveTab(),
    ).rejects.toThrow('HTTP(S) pages');
    expect(api.scripting.executeScript).not.toHaveBeenCalled();
  });

  it('routes host automation calls to the active tab content script', async () => {
    const api = createChromeApi();
    api.storage.local.get = vi.fn(async () => ({
      [STORAGE_KEY]: {
        frameUrl: 'https://chat.example/frame',
        apiUrl: 'https://api.example/api/ai',
        clientSecret: 'secret',
        hostAutomation: { enabled: true },
      },
    }));
    api.tabs.sendMessage = vi.fn(async () => ({
      ok: true,
      response: {
        tool_call_id: 'call-1',
        name: 'host_page_snapshot',
        status: 'success',
        content: '{}',
      },
    }));

    await expect(
      createChromeExtensionPlatform(api).runHostAutomationForActiveTab({
        name: 'host_page_snapshot',
        params: {},
        id: 'call-1',
      }),
    ).resolves.toMatchObject({
      tool_call_id: 'call-1',
      status: 'success',
    });

    expect(api.tabs.sendMessage).toHaveBeenCalledWith(42, {
      type: RUN_HOST_AUTOMATION_MESSAGE,
      call: {
        name: 'host_page_snapshot',
        params: {},
        id: 'call-1',
      },
    });
  });

  it('navigates restricted new tabs to HTTP(S) URLs through the tabs API', async () => {
    vi.useFakeTimers();
    const api = createChromeApi({
      tabs: {
        query: vi.fn(async () => [{ id: 42, url: 'chrome://newtab' }]),
        update: vi.fn(async (_tabId, updateProperties) => ({
          id: 42,
          url: updateProperties.url,
        })),
        sendMessage: vi.fn(),
      },
    });
    api.storage.local.get = vi.fn(async () => ({
      [STORAGE_KEY]: {
        frameUrl: 'https://chat.example/frame',
        apiUrl: 'https://api.example/api/ai',
        clientSecret: 'secret',
        hostAutomation: { enabled: true },
      },
    }));

    try {
      const responsePromise =
        createChromeExtensionPlatform(api).runHostAutomationForActiveTab({
          name: 'host_page_navigate',
          params: { url: 'https://github.com/xpert-ai/xpert/issues' },
          id: 'call-1',
        });

      await vi.advanceTimersByTimeAsync(1_000);
      await expect(responsePromise).resolves.toMatchObject({
        tool_call_id: 'call-1',
        name: 'host_page_navigate',
        status: 'success',
        content: expect.stringContaining(
          'https://github.com/xpert-ai/xpert/issues',
        ),
      });
    } finally {
      vi.useRealTimers();
    }

    expect(api.tabs.update).toHaveBeenCalledWith(42, {
      url: 'https://github.com/xpert-ai/xpert/issues',
    });
    expect(api.tabs.sendMessage).not.toHaveBeenCalled();
  });

  it('still blocks non-navigation host automation on restricted browser pages', async () => {
    const api = createChromeApi({
      tabs: {
        query: vi.fn(async () => [{ id: 42, url: 'chrome://newtab' }]),
        update: vi.fn(),
        sendMessage: vi.fn(),
      },
    });
    api.storage.local.get = vi.fn(async () => ({
      [STORAGE_KEY]: {
        frameUrl: 'https://chat.example/frame',
        apiUrl: 'https://api.example/api/ai',
        clientSecret: 'secret',
        hostAutomation: { enabled: true },
      },
    }));

    await expect(
      createChromeExtensionPlatform(api).runHostAutomationForActiveTab({
        name: 'host_page_snapshot',
        params: {},
        id: 'call-1',
      }),
    ).rejects.toThrow('HTTP(S) pages');
    expect(api.tabs.update).not.toHaveBeenCalled();
    expect(api.tabs.sendMessage).not.toHaveBeenCalled();
  });

  it('prefers CDP host automation when debugger permission is available', async () => {
    const api = createChromeApi({
      debugger: {
        attach: vi.fn(async () => undefined),
        detach: vi.fn(async () => undefined),
        sendCommand: vi.fn(async (_target, method) => {
          if (method === 'Runtime.evaluate') {
            return {
              result: {
                value: {
                  url: 'https://example.com',
                  elements: [],
                },
              },
            };
          }
          if (method === 'Accessibility.getFullAXTree') {
            return { nodes: [] };
          }
          if (method === 'DOMSnapshot.captureSnapshot') {
            return { documents: [] };
          }
          return {};
        }),
      },
    });
    api.storage.local.get = vi.fn(async () => ({
      [STORAGE_KEY]: {
        frameUrl: 'https://chat.example/frame',
        apiUrl: 'https://api.example/api/ai',
        clientSecret: 'secret',
        hostAutomation: { enabled: true },
      },
    }));

    await expect(
      createChromeExtensionPlatform(api).runHostAutomationForActiveTab({
        name: 'host_page_snapshot',
        params: {},
        id: 'call-1',
      }),
    ).resolves.toMatchObject({
      tool_call_id: 'call-1',
      status: 'success',
    });

    expect(api.debugger?.attach).toHaveBeenCalledWith({ tabId: 42 }, '1.3');
    expect(api.tabs.sendMessage).not.toHaveBeenCalled();
  });

  it('does not fall back to DOM content automation for accessibility refs', async () => {
    const api = createChromeApi({
      debugger: {
        attach: vi.fn(async () => undefined),
        detach: vi.fn(async () => undefined),
        sendCommand: vi.fn(async (_target, method) => {
          if (method === 'Accessibility.getFullAXTree') {
            return { nodes: [] };
          }
          return {};
        }),
      },
    });
    api.storage.local.get = vi.fn(async () => ({
      [STORAGE_KEY]: {
        frameUrl: 'https://chat.example/frame',
        apiUrl: 'https://api.example/api/ai',
        clientSecret: 'secret',
        hostAutomation: { enabled: true },
      },
    }));

    await expect(
      createChromeExtensionPlatform(api).runHostAutomationForActiveTab({
        name: 'host_page_click',
        params: { axRef: '255198' },
        id: 'call-1',
      }),
    ).resolves.toMatchObject({
      tool_call_id: 'call-1',
      status: 'error',
      content: expect.stringContaining('Unknown accessibility ref'),
    });
    expect(api.tabs.sendMessage).not.toHaveBeenCalled();
  });

  it('routes content-script automation requests through the background CDP adapter', async () => {
    const onMessageListeners: Array<
      Parameters<
        NonNullable<ChromeApi['runtime']['onMessage']>['addListener']
      >[0]
    > = [];
    const api = createChromeApi({
      runtime: {
        getURL: vi.fn((path: string) => `chrome-extension://extension/${path}`),
        openOptionsPage: vi.fn(async () => undefined),
        onMessage: {
          addListener: vi.fn((listener) => {
            onMessageListeners.push(listener);
          }),
        },
      },
      debugger: {
        attach: vi.fn(async () => undefined),
        detach: vi.fn(async () => undefined),
        sendCommand: vi.fn(async (_target, method) => {
          if (method === 'Runtime.evaluate') {
            return {
              result: {
                value: {
                  url: 'https://example.com',
                  elements: [],
                },
              },
            };
          }
          if (method === 'Accessibility.getFullAXTree') return { nodes: [] };
          if (method === 'DOMSnapshot.captureSnapshot') {
            return { documents: [] };
          }
          return {};
        }),
      },
    });
    api.storage.local.get = vi.fn(async () => ({
      [STORAGE_KEY]: {
        frameUrl: 'https://chat.example/frame',
        apiUrl: 'https://api.example/api/ai',
        clientSecret: 'secret',
        hostAutomation: { enabled: true },
      },
    }));

    createChromeExtensionPlatform(api).initializeBackground();
    const listener = onMessageListeners[0];
    if (!listener) {
      throw new Error('Expected runtime message listener.');
    }

    const response = await new Promise((resolve) => {
      const keepAlive = listener(
        {
          type: RUN_HOST_AUTOMATION_IN_TAB_MESSAGE,
          call: { name: 'host_page_snapshot', id: 'call-1', params: {} },
        },
        { tab: { id: 42, url: 'https://example.com' } },
        resolve,
      );
      expect(keepAlive).toBe(true);
    });

    expect(response).toMatchObject({
      ok: true,
      response: {
        tool_call_id: 'call-1',
        status: 'success',
      },
    });
    expect(api.debugger?.attach).toHaveBeenCalledWith({ tabId: 42 }, '1.3');
  });

  it('blocks host automation when disabled in extension config', async () => {
    const api = createChromeApi();
    api.storage.local.get = vi.fn(async () => ({
      [STORAGE_KEY]: {
        frameUrl: 'https://chat.example/frame',
        apiUrl: 'https://api.example/api/ai',
        clientSecret: 'secret',
        hostAutomation: { enabled: false },
      },
    }));

    await expect(
      createChromeExtensionPlatform(api).runHostAutomationForActiveTab({
        name: 'host_page_snapshot',
        params: {},
      }),
    ).rejects.toThrow('disabled');
    expect(api.tabs.sendMessage).not.toHaveBeenCalled();
  });

  it('restricts storage access when Chrome supports it', async () => {
    const api = createChromeApi();

    await createChromeExtensionPlatform(api).restrictStorageAccess();

    expect(api.storage.local.setAccessLevel).toHaveBeenCalledWith({
      accessLevel: 'TRUSTED_CONTEXTS',
    });
  });
});
