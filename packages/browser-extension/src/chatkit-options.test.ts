import { describe, expect, it } from 'vitest';

import { createChatKitOptions } from './chatkit-options';
import { normalizeConfig } from './config';

describe('createChatKitOptions', () => {
  it('maps extension config into web component options', async () => {
    const options = createChatKitOptions(
      normalizeConfig({
        frameUrl: 'https://chat.example/frame',
        apiUrl: 'https://api.example/api/ai',
        assistants: [
          {
            id: 'assistant-1',
            name: 'Researcher',
            clientSecret: 'secret-1',
          },
          { id: 'assistant-2', name: 'Writer', clientSecret: 'secret-2' },
        ],
        activeAssistantId: 'assistant-2',
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
      xpertId: 'assistant-2',
    });

    if (!('getClientSecret' in options.api)) {
      throw new Error('Expected hosted API config.');
    }

    await expect(options.api.getClientSecret(null)).resolves.toEqual({
      secret: 'secret-2',
    });
  });

  it('omits empty optional values', () => {
    const options = createChatKitOptions(
      normalizeConfig({
        frameUrl: 'https://chat.example/frame',
        apiUrl: 'https://api.example/api/ai',
      }),
    );

    expect('xpertId' in options.api).toBe(false);
    expect(options.locale).toBeUndefined();
    expect(options.displayMode).toBe('pet');
    expect(options.pet).toEqual({
      position: {
        scale: 1,
        boundsPadding: 50,
      },
    });
  });

  it('updates xpertId and client secret when the active assistant changes', async () => {
    const firstOptions = createChatKitOptions(
      normalizeConfig({
        frameUrl: 'https://chat.example/frame',
        apiUrl: 'https://api.example/api/ai',
        assistants: [
          { id: 'assistant-1', clientSecret: 'secret-1' },
          { id: 'assistant-2', clientSecret: 'secret-2' },
        ],
        activeAssistantId: 'assistant-1',
      }),
    );
    const secondOptions = createChatKitOptions(
      normalizeConfig({
        frameUrl: 'https://chat.example/frame',
        apiUrl: 'https://api.example/api/ai',
        assistants: [
          { id: 'assistant-1', clientSecret: 'secret-1' },
          { id: 'assistant-2', clientSecret: 'secret-2' },
        ],
        activeAssistantId: 'assistant-2',
      }),
    );

    expect(firstOptions.api).toMatchObject({ xpertId: 'assistant-1' });
    expect(secondOptions.api).toMatchObject({ xpertId: 'assistant-2' });
    if (
      !('getClientSecret' in firstOptions.api) ||
      !('getClientSecret' in secondOptions.api)
    ) {
      throw new Error('Expected hosted API config.');
    }
    await expect(firstOptions.api.getClientSecret(null)).resolves.toEqual({
      secret: 'secret-1',
    });
    await expect(secondOptions.api.getClientSecret(null)).resolves.toEqual({
      secret: 'secret-2',
    });
  });

  it('can override display mode for a specific extension surface', () => {
    const options = createChatKitOptions(
      normalizeConfig({
        frameUrl: 'https://chat.example/frame',
        apiUrl: 'https://api.example/api/ai',
        assistants: [{ id: 'assistant-1', clientSecret: 'secret' }],
        displayMode: 'pet',
      }),
      { displayMode: 'chat' },
    );

    expect(options.displayMode).toBe('chat');
    expect(options.pet).toBeUndefined();
  });

  it('passes the host automation client tool handler when enabled', () => {
    const onClientTool = async () => ({ content: '{}' });
    const options = createChatKitOptions(
      normalizeConfig({
        frameUrl: 'https://chat.example/frame',
        apiUrl: 'https://api.example/api/ai',
        assistants: [{ id: 'assistant-1', clientSecret: 'secret' }],
      }),
      { onClientTool },
    );

    expect(options.onClientTool).toBe(onClientTool);
  });

  it('omits the host automation client tool handler when disabled', () => {
    const onClientTool = async () => ({ content: '{}' });
    const options = createChatKitOptions(
      normalizeConfig({
        frameUrl: 'https://chat.example/frame',
        apiUrl: 'https://api.example/api/ai',
        assistants: [{ id: 'assistant-1', clientSecret: 'secret' }],
        hostAutomation: { enabled: false },
      }),
      { onClientTool },
    );

    expect(options.onClientTool).toBeUndefined();
  });
});
