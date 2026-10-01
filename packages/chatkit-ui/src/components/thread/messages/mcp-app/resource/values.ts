import type { TMessageComponentMcpAppData } from '@xpert-ai/chatkit-types';
import type { JsonObject } from '../types';

export function isRecord(value: unknown): value is JsonObject {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function readRecord(value: unknown): JsonObject | undefined {
  return isRecord(value) ? value : undefined;
}

export function readNonEmptyRecord(value: unknown): JsonObject | undefined {
  const record = readRecord(value);
  return record && Object.keys(record).length ? record : undefined;
}

export function readString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

export function readBoolean(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined;
}

export function readLocalizedText(
  value: unknown,
): TMessageComponentMcpAppData['title'] | undefined {
  if (typeof value === 'string') return value;
  if (isRecord(value)) return value as TMessageComponentMcpAppData['title'];
  return undefined;
}

export function readIconDefinition(
  value: unknown,
): TMessageComponentMcpAppData['icon'] | undefined {
  if (!isRecord(value)) return undefined;
  return typeof value.type === 'string' && typeof value.value === 'string'
    ? (value as TMessageComponentMcpAppData['icon'])
    : undefined;
}

export function readStringList(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const strings = value.filter(
    (item): item is string => typeof item === 'string',
  );
  return strings.length ? strings : undefined;
}
