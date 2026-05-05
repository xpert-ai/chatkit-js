import { describe, expect, it, vi } from 'vitest';

import {
  createChromeExtensionPlatform,
  isInjectableTabUrl,
  shouldAutoOpenPagePet,
  type ChromeApi,
} from './api';
import { OPEN_OVERLAY_MESSAGE, TOGGLE_OVERLAY_MESSAGE } from '../../messages';
import { STORAGE_KEY, normalizeConfig } from '../../config';

function createChromeApi(overrides: Partial<ChromeApi> = {}): ChromeApi {
  return {
    runtime: {
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

    expect(api.scripting.executeScript).toHaveBeenCalledWith({
      target: { tabId: 42 },
      files: ['content-script.js'],
    });
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

  it('restricts storage access when Chrome supports it', async () => {
    const api = createChromeApi();

    await createChromeExtensionPlatform(api).restrictStorageAccess();

    expect(api.storage.local.setAccessLevel).toHaveBeenCalledWith({
      accessLevel: 'TRUSTED_CONTEXTS',
    });
  });
});
