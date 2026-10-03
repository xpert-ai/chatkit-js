import {
  formatDisplayValue,
  isJsonObjectValue,
  parseJsonString,
  safeJson,
  toJsonValue,
  type DetectedJsonValue,
  type JsonValue,
} from '../json-tree-view';

/**
 * Redact legacy embedded image bytes in the display projection only. History and
 * model inputs remain untouched; preview authority comes from the attachment
 * protocol, never a URL found in arbitrary tool output.
 */
export function prepareToolOutputDisplay(
  value: unknown,
  imagePlaceholder: (mimeType: string) => string,
): { display: DetectedJsonValue; omittedImageCount: number } {
  const json =
    typeof value === 'string' ? parseJsonString(value) : toJsonValue(value);
  let omittedImageCount = 0;

  const redact = (item: JsonValue): JsonValue => {
    if (typeof item === 'string') {
      const image = /^\s*data:(image\/[a-z0-9.+-]+)(?:;[^,]*)?,/i.exec(item);
      if (!image) return item;
      omittedImageCount++;
      // The header is untrusted too: never echo an unbounded MIME label into
      // an otherwise compact summary. Do not decode or validate pixel bytes.
      const mimeType =
        image[1].length <= 128 ? image[1].toLowerCase() : 'image/*';
      return imagePlaceholder(mimeType);
    }
    if (Array.isArray(item)) return item.map(redact);
    if (isJsonObjectValue(item)) {
      return Object.fromEntries(
        Object.entries(item).map(([key, child]) => [key, redact(child)]),
      );
    }
    return item;
  };

  if (json === null || typeof json !== 'object') {
    const text = redact(formatDisplayValue(value));
    return {
      display: { kind: 'text', text: String(text) },
      omittedImageCount,
    };
  }
  // Serialize only after redaction, so large legacy images do not also produce
  // a second, pretty-printed copy of their bytes for the raw/copy view.
  const sanitized = redact(json);
  return {
    display: { kind: 'json', value: sanitized, raw: safeJson(sanitized) },
    omittedImageCount,
  };
}
