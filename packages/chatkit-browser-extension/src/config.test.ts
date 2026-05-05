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
        surfaces: { sidePanel: false, pageOverlay: true },
        overlay: { width: 1200, height: 20, position: 'top-left' },
      }),
    ).toMatchObject({
      frameUrl: 'https://chat.example/frame',
      apiUrl: 'https://api.example/api/ai',
      xpertId: 'assistant-1',
      clientSecret: 'secret',
      locale: 'zh-Hans',
      displayMode: 'chat',
      theme: { colorScheme: 'dark' },
      surfaces: { sidePanel: false, pageOverlay: true },
      overlay: { width: 900, height: 360, position: 'top-left' },
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

  it('reports missing required ChatKit connection fields', () => {
    const validation = validateConfig(normalizeConfig({}));

    expect(validation.ok).toBe(false);
    expect(validation.issues.map((issue) => issue.field)).toEqual([
      'frameUrl',
      'apiUrl',
      'clientSecret',
    ]);
  });

  it('accepts a complete manual credential config', () => {
    const validation = validateConfig(
      normalizeConfig({
        frameUrl: 'https://chat.example/frame',
        apiUrl: 'https://api.example/api/ai',
        clientSecret: 'secret',
      }),
    );

    expect(validation).toEqual({ ok: true, issues: [] });
  });
});
