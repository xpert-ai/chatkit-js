import { beforeEach, describe, expect, it, vi } from 'vitest';

import { STORAGE_KEY } from './config';
import { BROWSER_RUNNER_COMMAND_MESSAGE } from './messages';

function installChromeStorageMock(initialConfig: unknown) {
  const data: Record<string, unknown> = {
    [STORAGE_KEY]: initialConfig,
  };
  const get = vi.fn(async (keys?: string | string[] | null) => {
    if (typeof keys === 'string') {
      return { [keys]: data[keys] };
    }

    if (Array.isArray(keys)) {
      return Object.fromEntries(keys.map((key) => [key, data[key]]));
    }

    return { ...data };
  });
  const set = vi.fn(async (items: Record<string, unknown>) => {
    Object.assign(data, items);
  });
  const sendMessage = vi.fn(async (message: Record<string, unknown>) => ({
    requestId: 'runner-request-1',
    ok: true,
    status: {
      state: message.command === 'stop' ? 'stopped' : 'running',
      sessionId: 'runner-session-1',
    },
  }));

  (
    globalThis as typeof globalThis & {
      chrome: unknown;
    }
  ).chrome = {
    runtime: {
      getURL: (path: string) => path,
      openOptionsPage: vi.fn(),
      sendMessage,
    },
    storage: {
      local: { get, set },
      onChanged: { addListener: vi.fn() },
    },
    tabs: {
      query: vi.fn(async () => []),
      sendMessage: vi.fn(async () => undefined),
    },
    scripting: {
      executeScript: vi.fn(async () => undefined),
    },
  };

  return { get, set, sendMessage };
}

async function importOptionsPage() {
  vi.resetModules();
  await import('./options');
  await Promise.resolve();
  await Promise.resolve();
}

describe('extension options page', () => {
  beforeEach(() => {
    document.body.innerHTML = '<main id="app"></main>';
  });

  it('saves multiple assistant rows and migrates a legacy xpertId', async () => {
    const storage = installChromeStorageMock({
      frameUrl: 'https://chat.example/frame',
      apiUrl: 'https://api.example/api/ai',
      xpertId: 'legacy-assistant',
      clientSecret: 'secret',
    });

    await importOptionsPage();

    const firstAssistantId = document.querySelector<HTMLInputElement>(
      'input[name="assistantId"]',
    );
    expect(firstAssistantId?.value).toBe('legacy-assistant');
    const firstAssistantSecret = document.querySelector<HTMLInputElement>(
      'input[name="assistantClientSecret"]',
    );
    expect(firstAssistantSecret?.value).toBe('secret');

    document
      .querySelector<HTMLButtonElement>('[data-role="add-assistant"]')
      ?.click();

    const rows = Array.from(
      document.querySelectorAll<HTMLElement>('[data-role="assistant-row"]'),
    );
    const secondRow = rows[1];
    expect(secondRow).toBeDefined();
    secondRow!.querySelector<HTMLInputElement>(
      'input[name="assistantName"]',
    )!.value = 'Writer';
    secondRow!.querySelector<HTMLInputElement>(
      'input[name="assistantId"]',
    )!.value = 'assistant-2';
    secondRow!.querySelector<HTMLInputElement>(
      'input[name="assistantClientSecret"]',
    )!.value = 'secret-2';
    secondRow!
      .querySelector<HTMLInputElement>('input[name="activeAssistantRow"]')!
      .click();

    document
      .querySelector<HTMLFormElement>('form')
      ?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await Promise.resolve();
    await Promise.resolve();

    const saved = storage.set.mock.calls.at(-1)?.[0]?.[STORAGE_KEY];
    expect(saved).toMatchObject({
      assistants: [
        { id: 'legacy-assistant', clientSecret: 'secret' },
        { id: 'assistant-2', name: 'Writer', clientSecret: 'secret-2' },
      ],
      activeAssistantId: 'assistant-2',
    });
    expect(saved).not.toHaveProperty('clientSecret');
  });

  it('shows isolated browser status without manual runner controls', async () => {
    const { sendMessage } = installChromeStorageMock({});
    await importOptionsPage();

    expect(
      document.querySelector('input[name="browserRunnerStartUrl"]'),
    ).toBeNull();
    expect(
      document.querySelector('[data-role="start-browser-runner"]'),
    ).toBeNull();
    expect(
      document.querySelector('[data-role="stop-browser-runner"]'),
    ).toBeNull();

    const refreshButton = document.querySelector<HTMLButtonElement>(
      '[data-role="refresh-browser-runner"]',
    );
    expect(refreshButton).not.toBeNull();
    sendMessage.mockClear();
    refreshButton?.click();

    await vi.waitFor(() =>
      expect(sendMessage).toHaveBeenCalledWith({
        type: BROWSER_RUNNER_COMMAND_MESSAGE,
        command: 'status',
      }),
    );
    await vi.waitFor(() =>
      expect(
        document.querySelector('[data-role="browser-runner-status"]')
          ?.textContent,
      ).toContain('running'),
    );
  });
});
