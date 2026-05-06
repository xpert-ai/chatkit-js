import { describe, expect, it } from 'vitest';

import { createI18n, formatConfigIssues, resolveExtensionLocale } from './i18n';

describe('extension i18n', () => {
  it('resolves English and Simplified Chinese locales', () => {
    expect(resolveExtensionLocale('en')).toBe('en');
    expect(resolveExtensionLocale('en-US')).toBe('en');
    expect(resolveExtensionLocale('zh-Hans')).toBe('zh-Hans');
    expect(resolveExtensionLocale('zh-CN')).toBe('zh-Hans');
  });

  it('falls back to English for unsupported locales', () => {
    expect(resolveExtensionLocale('fr-FR')).toBe('en');
  });

  it('translates validation issues', () => {
    const i18n = createI18n('zh-Hans');

    expect(
      formatConfigIssues(
        [
          {
            field: 'frameUrl',
            message: 'ChatKit frame URL is required.',
          },
          {
            field: 'clientSecret',
            message: 'Client Secret / API Key is required.',
          },
        ],
        i18n,
      ),
    ).toBe('请填写 ChatKit frame URL。 请填写 Client Secret / API Key。');
  });
});
