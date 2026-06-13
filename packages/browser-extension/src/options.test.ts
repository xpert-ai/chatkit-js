import { beforeEach, describe, expect, it, vi } from 'vitest';

import { STORAGE_KEY } from './config';

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

  (
    globalThis as typeof globalThis & {
      chrome: unknown;
    }
  ).chrome = {
    runtime: {
      getURL: (path: string) => path,
      openOptionsPage: vi.fn(),
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

  return { get, set };
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
        { id: 'legacy-assistant' },
        { id: 'assistant-2', name: 'Writer' },
      ],
      activeAssistantId: 'assistant-2',
    });
  });
});
