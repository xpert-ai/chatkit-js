export type I18nObject = {
  en_US?: string;
  en?: string;
  'en-US'?: string;
  zh_Hans?: string;
  zh_CN?: string;
  zh?: string;
  'zh-Hans'?: string;
  'zh-CN'?: string;
  [locale: string]: string | undefined;
};

export type LocalizedText = string | I18nObject;

export function resolveLocalizedText(
  value: unknown,
  language = 'en-US',
): string | null {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed || null;
  }

  if (!value || typeof value !== 'object') return null;

  const localized = value as I18nObject;
  const normalizedLanguage = language.trim();
  const underscoredLanguage = normalizedLanguage.replace(/-/g, '_');
  const languagePrefix = normalizedLanguage.split(/[-_]/)[0];
  const preferredKeys = normalizedLanguage.toLowerCase().startsWith('zh')
    ? [
        normalizedLanguage,
        underscoredLanguage,
        'zh_Hans',
        'zh-Hans',
        'zh_CN',
        'zh-CN',
        'zh',
        'en_US',
        'en-US',
        'en',
      ]
    : [
        normalizedLanguage,
        underscoredLanguage,
        'en_US',
        'en-US',
        'en',
        languagePrefix,
        'zh_Hans',
        'zh-Hans',
        'zh_CN',
        'zh-CN',
        'zh',
      ];

  for (const key of preferredKeys) {
    const candidate = localized[key];
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate.trim();
    }
  }

  for (const candidate of Object.values(localized)) {
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate.trim();
    }
  }

  return null;
}
