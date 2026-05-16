export function normalizeRequestLanguage(
  locale?: string | null,
): string | undefined {
  const normalized = locale?.trim();
  if (!normalized) {
    return undefined;
  }

  const lower = normalized.toLowerCase();
  if (lower === 'zh-hant' || lower === 'zh-tw' || lower === 'zh-hk') {
    return 'zh-Hant';
  }
  if (lower === 'zh' || lower === 'zh-cn' || lower === 'zh-hans') {
    return 'zh-Hans';
  }
  if (lower === 'en' || lower === 'en-us') {
    return 'en';
  }

  return normalized;
}
