import { describe, expect, it } from 'vitest';

import {
  DEFAULT_EXTENSION_CONFIG,
  normalizeConfig,
  validateConfig,
} from './config';

describe('extension config', () => {
  it('returns stable defaults for empty input', () => {
    expect(normalizeConfig({})).toEqual(DEFAULT_EXTENSION_CONFIG);
  });

  it('trims strings and clamps overlay dimensions', () => {
    expect(
      normalizeConfig({
        frameUrl: ' https://chat.example/frame ',
        apiUrl: ' https://api.example/api/ai ',
        xpertId: ' assistant-1 ',
        clientSecret: ' secret ',
        locale: 'zh-Hans',
        displayMode: 'chat',
        theme: { colorScheme: 'dark' },
        surfaces: {
          sidePanel: false,
          pageOverlay: true,
          autoPageOverlay: true,
        },
        overlay: { width: 1200, height: 20, position: 'top-left' },
        pet: { scale: 1.8, boundsPadding: 140 },
        hostAutomation: { enabled: false, provider: 'isolated_runner' },
      }),
    ).toMatchObject({
      frameUrl: 'https://chat.example/frame',
      apiUrl: 'https://api.example/api/ai',
      assistants: [{ id: 'assistant-1', clientSecret: 'secret' }],
      activeAssistantId: 'assistant-1',
      locale: 'zh-Hans',
      displayMode: 'chat',
      theme: { colorScheme: 'dark' },
      surfaces: {
        sidePanel: false,
        pageOverlay: true,
        autoPageOverlay: true,
      },
      overlay: { width: 900, height: 360, position: 'top-left' },
      pet: { scale: 1.8, boundsPadding: 140 },
      hostAutomation: { enabled: false, provider: 'isolated_runner' },
    });
  });

  it('normalizes assistants and falls back to the first valid assistant', () => {
    expect(
      normalizeConfig({
        assistants: [
          {
            id: ' assistant-1 ',
            name: ' Researcher ',
            clientSecret: ' secret-1 ',
          },
          { id: 'assistant-2', name: ' ', clientSecret: ' secret-2 ' },
          { id: 'assistant-1', name: 'Duplicate' },
          { id: ' ' },
          null,
        ],
        activeAssistantId: 'missing',
      }),
    ).toMatchObject({
      assistants: [
        {
          id: 'assistant-1',
          name: 'Researcher',
          clientSecret: 'secret-1',
        },
        { id: 'assistant-2', clientSecret: 'secret-2' },
      ],
      activeAssistantId: 'assistant-1',
    });
  });

  it('migrates a legacy global client secret into assistant credentials', () => {
    expect(
      normalizeConfig({
        assistants: [
          { id: 'assistant-1', name: 'Researcher' },
          { id: 'assistant-2', clientSecret: ' secret-2 ' },
        ],
        clientSecret: ' legacy-secret ',
      }),
    ).toMatchObject({
      assistants: [
        {
          id: 'assistant-1',
          name: 'Researcher',
          clientSecret: 'legacy-secret',
        },
        { id: 'assistant-2', clientSecret: 'secret-2' },
      ],
      activeAssistantId: 'assistant-1',
    });
  });

  it('normalizes an empty assistant list', () => {
    expect(
      normalizeConfig({
        assistants: [],
        activeAssistantId: 'assistant-1',
      }),
    ).toMatchObject({
      assistants: [],
      activeAssistantId: undefined,
    });
  });

  it('falls back to pet launcher mode for invalid display modes', () => {
    expect(normalizeConfig({ displayMode: 'unknown' }).displayMode).toBe('pet');
  });

  it('normalizes supported extension locales to en and zh-Hans', () => {
    expect(normalizeConfig({ locale: 'en-US' }).locale).toBe('en');
    expect(normalizeConfig({ locale: 'zh-CN' }).locale).toBe('zh-Hans');
    expect(normalizeConfig({ locale: 'fr-FR' }).locale).toBeUndefined();
  });

  it('reports missing required manual credentials', () => {
    const validation = validateConfig(normalizeConfig({}));

    expect(validation.ok).toBe(false);
    expect(validation.issues.map((issue) => issue.field)).toEqual([
      'clientSecret',
    ]);
  });

  it('accepts a complete manual credential config', () => {
    const validation = validateConfig(
      normalizeConfig({
        frameUrl: 'https://chat.example/frame',
        apiUrl: 'https://api.example/api/ai',
        assistants: [{ id: 'assistant-1', clientSecret: 'secret' }],
      }),
    );

    expect(validation).toEqual({ ok: true, issues: [] });
  });
});
