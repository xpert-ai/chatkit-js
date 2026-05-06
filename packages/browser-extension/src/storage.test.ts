import { describe, expect, it } from 'vitest';

import { STORAGE_KEY, normalizeConfig } from './config';
import {
  readConfig,
  readConfigChange,
  readConfigFromResult,
  writeConfig,
  type StorageArea,
} from './storage';

class MemoryStorageArea implements StorageArea {
  private data: Record<string, unknown> = {};

  async get(keys?: string | string[] | null) {
    if (typeof keys === 'string') {
      return { [keys]: this.data[keys] };
    }

    if (Array.isArray(keys)) {
      return Object.fromEntries(keys.map((key) => [key, this.data[key]]));
    }

    return { ...this.data };
  }

  async set(items: Record<string, unknown>) {
    this.data = { ...this.data, ...items };
  }
}

describe('extension storage', () => {
  it('normalizes config from chrome storage results', () => {
    expect(
      readConfigFromResult({
        [STORAGE_KEY]: {
          frameUrl: ' https://chat.example/frame ',
          apiUrl: 'https://api.example/api/ai',
          clientSecret: ' secret ',
        },
      }),
    ).toMatchObject({
      frameUrl: 'https://chat.example/frame',
      clientSecret: 'secret',
    });
  });

  it('writes and reads config through a storage area', async () => {
    const storage = new MemoryStorageArea();
    const config = normalizeConfig({
      frameUrl: 'https://chat.example/frame',
      apiUrl: 'https://api.example/api/ai',
      clientSecret: 'secret',
    });

    await writeConfig(storage, config);
    await expect(readConfig(storage)).resolves.toEqual(config);
  });

  it('extracts config changes only for the ChatKit key', () => {
    expect(
      readConfigChange({
        [STORAGE_KEY]: {
          newValue: {
            frameUrl: 'https://chat.example/frame',
            apiUrl: 'https://api.example/api/ai',
            clientSecret: 'secret',
          },
        },
      }),
    ).toMatchObject({
      frameUrl: 'https://chat.example/frame',
    });

    expect(readConfigChange({ unrelated: { newValue: true } })).toBeNull();
  });
});
