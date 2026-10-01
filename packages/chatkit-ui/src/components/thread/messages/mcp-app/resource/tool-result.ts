import type { JsonObject, McpCallToolResult, McpContentBlock } from '../types';
import { isRecord, readBoolean, readRecord } from './values';

export function stringifyToolResult(value: unknown) {
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value ?? null);
  } catch {
    return String(value);
  }
}

export function createTextContentBlock(text: string): McpContentBlock {
  return {
    type: 'text',
    text,
  };
}

export function normalizeContentBlocks(value: unknown): McpContentBlock[] {
  if (!Array.isArray(value)) return [];

  return value.filter(
    (item): item is McpContentBlock =>
      isRecord(item) && typeof item.type === 'string',
  );
}

export function extractLegacyArtifactMeta(
  value: JsonObject,
): JsonObject | undefined {
  const meta = readRecord(value._meta);
  if (meta) return meta;

  const entries = Object.entries(value).filter(
    ([key]) => key !== 'structuredContent' && key !== 'isError',
  );
  return entries.length ? Object.fromEntries(entries) : undefined;
}

export function normalizeToolArtifact(
  value: unknown,
): Partial<McpCallToolResult> {
  if (isRecord(value)) {
    return {
      ...(readRecord(value.structuredContent)
        ? { structuredContent: readRecord(value.structuredContent) }
        : {}),
      ...(readBoolean(value.isError) !== undefined
        ? { isError: readBoolean(value.isError) }
        : {}),
      ...(extractLegacyArtifactMeta(value)
        ? { _meta: extractLegacyArtifactMeta(value) }
        : {}),
    };
  }

  if (!Array.isArray(value)) return {};

  return value.reduce<Partial<McpCallToolResult>>((result, item) => {
    const normalized = normalizeToolArtifact(item);
    return {
      ...result,
      ...normalized,
      _meta: result._meta ?? normalized._meta,
      structuredContent:
        result.structuredContent ?? normalized.structuredContent,
      isError: result.isError ?? normalized.isError,
    };
  }, {});
}

export function normalizeCallToolResult(value: unknown): McpCallToolResult {
  if (value === undefined) {
    return {
      content: [],
    };
  }

  if (isRecord(value)) {
    if (value.toolResult !== undefined && !Array.isArray(value.content)) {
      return normalizeCallToolResult(value.toolResult);
    }

    const content = normalizeContentBlocks(value.content);
    const result: McpCallToolResult = {
      content: content.length ? content : [],
    };
    const structuredContent = readRecord(value.structuredContent);
    const isError = readBoolean(value.isError);
    const meta = readRecord(value._meta);

    if (structuredContent) result.structuredContent = structuredContent;
    if (isError !== undefined) result.isError = isError;
    if (meta) result._meta = meta;

    return result;
  }

  if (Array.isArray(value) && value.length >= 2) {
    const [content, artifact] = value;
    const artifactFields = normalizeToolArtifact(artifact);

    return {
      content: [
        createTextContentBlock(
          typeof content === 'string' ? content : stringifyToolResult(content),
        ),
      ],
      ...artifactFields,
    };
  }

  return {
    content: [createTextContentBlock(stringifyToolResult(value))],
  };
}
