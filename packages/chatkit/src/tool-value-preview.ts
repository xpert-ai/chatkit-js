import type { ToolOutputArtifactJsonValue } from './tool-output.js';
import type { ToolValuePresentation } from './tool-timeline.js';

export const TOOL_PREVIEW_BYTES = 2048;
export const TOOL_PREVIEW_LINES = 6;
export const TOOL_PREVIEW_ITEMS = 5;
export const TOOL_PREVIEW_DEPTH = 2;

const encoder = new TextEncoder();
const bytes = (text: string) => encoder.encode(text).length;

function isJsonValue(value: unknown): value is ToolOutputArtifactJsonValue {
  if (value === null || typeof value === 'string' || typeof value === 'boolean')
    return true;
  if (typeof value === 'number') return Number.isFinite(value);
  if (Array.isArray(value)) return value.every(isJsonValue);
  return typeof value === 'object' && Object.values(value).every(isJsonValue);
}

function structuredValue(
  value: ToolOutputArtifactJsonValue,
): ToolOutputArtifactJsonValue {
  if (typeof value !== 'string') return value;
  try {
    const parsed: unknown = JSON.parse(value);
    // Only a complete JSON object/array is structured data; scalar text stays text.
    if (parsed !== null && typeof parsed === 'object' && isJsonValue(parsed))
      return parsed;
  } catch {
    /* Partial logs and ordinary text retain the text preview. */
  }
  return value;
}

function textPreview(text: string, budget = TOOL_PREVIEW_BYTES) {
  let result = '';
  let used = 0;
  let lines = 1;
  for (const character of text) {
    const size = bytes(character);
    if (
      used + size > budget ||
      (character === '\n' && lines >= TOOL_PREVIEW_LINES)
    )
      break;
    result += character;
    used += size;
    if (character === '\n') lines++;
  }
  return result;
}

/** Deterministic presentation only; the caller authorizes the value before invoking this. */
export function previewToolValue(
  value: ToolOutputArtifactJsonValue,
  mode: 'preview' | 'summary' = 'preview',
) {
  const structured = structuredValue(value);
  const format = typeof structured === 'string' ? 'text' : 'json';
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  let truncated = mode === 'summary';
  function visit(
    entry: ToolOutputArtifactJsonValue,
    depth: number,
  ): ToolOutputArtifactJsonValue {
    if (typeof entry === 'string') {
      const preview = textPreview(entry);
      truncated ||= preview !== entry;
      return preview;
    }
    if (entry === null || typeof entry !== 'object') return entry;
    if (depth >= TOOL_PREVIEW_DEPTH) {
      truncated ||= Object.keys(entry).length > 0;
      return Array.isArray(entry) ? [] : {};
    }
    if (Array.isArray(entry)) {
      truncated ||= entry.length > TOOL_PREVIEW_ITEMS;
      return entry
        .slice(0, TOOL_PREVIEW_ITEMS)
        .map((item) => visit(item, depth + 1));
    }
    const entries = Object.entries(entry);
    truncated ||= entries.length > TOOL_PREVIEW_ITEMS;
    return Object.fromEntries(
      entries
        .slice(0, TOOL_PREVIEW_ITEMS)
        .map(([key, item]) => [key, visit(item, depth + 1)]),
    );
  }
  let preview = mode === 'summary' ? undefined : visit(structured, 0);
  if (
    preview !== undefined &&
    typeof preview !== 'string' &&
    bytes(JSON.stringify(preview)) > TOOL_PREVIEW_BYTES
  ) {
    // Keep valid JSON and honest truncation rather than slicing serialized syntax or keys.
    preview = Array.isArray(structured) ? [] : {};
    truncated = true;
  }
  const presentation: ToolValuePresentation = {
    state: 'available',
    format,
    byteLength: bytes(text),
    truncated,
    mode,
    ...(format === 'text'
      ? {
          lineCount:
            text.length === 0
              ? 0
              : (text.match(/\n/g)?.length ?? 0) + Number(!text.endsWith('\n')),
        }
      : {}),
    ...(structured !== null && typeof structured === 'object'
      ? { itemCount: Object.keys(structured).length }
      : {}),
  };
  return { preview, presentation, text };
}
