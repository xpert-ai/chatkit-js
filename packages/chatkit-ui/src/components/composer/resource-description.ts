import type { LocalizedText, I18nObject } from '../../i18n/localized-text';
import { resolveLocalizedText } from '../../i18n/localized-text';

function isSerializedI18nObject(value: unknown): value is I18nObject {
  return (
    !!value &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    'en_US' in value &&
    typeof value.en_US === 'string' &&
    Object.values(value).every((translation) => typeof translation === 'string')
  );
}

// Older expert descriptions store the platform I18nObject as JSON in a text column.
// Only unwrap that explicit shape; ordinary text and other JSON stay literal.
export function normalizeResourceDescription(
  value?: LocalizedText,
): LocalizedText | undefined {
  if (typeof value !== 'string' || !value.trimStart().startsWith('{'))
    return value;
  try {
    const parsed: unknown = JSON.parse(value);
    return isSerializedI18nObject(parsed) ? parsed : value;
  } catch {
    return value;
  }
}

export function resourceDescription(
  value?: LocalizedText,
  language?: string,
): string | null {
  return resolveLocalizedText(normalizeResourceDescription(value), language);
}

export function resourceDescriptionSearchText(value?: LocalizedText): string {
  const normalized = normalizeResourceDescription(value);
  return typeof normalized === 'string'
    ? normalized
    : Object.values(normalized ?? {}).join(' ');
}
