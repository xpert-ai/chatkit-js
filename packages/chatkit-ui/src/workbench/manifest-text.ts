export function resolveManifestText(
  value: string | { en_US: string; zh_Hans?: string } | undefined,
  fallback: string,
  locale: string,
) {
  if (typeof value === 'string') return value.trim() || fallback;
  if (!value) return fallback;
  const simplifiedChinese =
    locale === 'zh-CN' || locale === 'zh-Hans' || locale === 'zh';
  return (
    (simplifiedChinese ? value.zh_Hans : value.en_US)?.trim() ||
    value.en_US.trim() ||
    value.zh_Hans?.trim() ||
    fallback
  );
}
