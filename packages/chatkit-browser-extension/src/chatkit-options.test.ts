import { describe, expect, it } from 'vitest';

import { createChatKitOptions } from './chatkit-options';
import { normalizeConfig } from './config';

describe('createChatKitOptions', () => {
  it('maps extension config into web component options', async () => {
    const options = createChatKitOptions(
      normalizeConfig({
        frameUrl: 'https://chat.example/frame',
        apiUrl: 'https://api.example/api/ai',
        xpertId: 'assistant-1',
        clientSecret: 'secret',
        locale: 'zh-Hans',
        displayMode: 'chat',
        theme: { colorScheme: 'dark' },
      }),
    );

    expect(options.frameUrl).toBe('https://chat.example/frame');
    expect(options.locale).toBe('zh-Hans');
    expect(options.displayMode).toBe('chat');
    expect(options.pet).toBeUndefined();
    expect(options.theme).toEqual({ colorScheme: 'dark' });
    expect(options.api).toMatchObject({
      apiUrl: 'https://api.example/api/ai',
      xpertId: 'assistant-1',
    });

    if (!('getClientSecret' in options.api)) {
      throw new Error('Expected hosted API config.');
    }

    await expect(options.api.getClientSecret(null)).resolves.toEqual({
      secret: 'secret',
    });
  });

  it('omits empty optional values', () => {
    const options = createChatKitOptions(
      normalizeConfig({
        frameUrl: 'https://chat.example/frame',
        apiUrl: 'https://api.example/api/ai',
        clientSecret: 'secret',
      }),
    );

    expect('xpertId' in options.api).toBe(false);
    expect(options.locale).toBeUndefined();
    expect(options.displayMode).toBe('pet');
    expect(options.pet).toBe(true);
  });

  it('can override display mode for a specific extension surface', () => {
    const options = createChatKitOptions(
      normalizeConfig({
        frameUrl: 'https://chat.example/frame',
        apiUrl: 'https://api.example/api/ai',
        clientSecret: 'secret',
        displayMode: 'pet',
      }),
      { displayMode: 'chat' },
    );

    expect(options.displayMode).toBe('chat');
    expect(options.pet).toBeUndefined();
  });
});
