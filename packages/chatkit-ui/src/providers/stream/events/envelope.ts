import {
  ChatMessageEventTypeEnum,
  type ChatEventEnvelope,
} from '@xpert-ai/chatkit-types';

export function parseEventData(raw: string): ChatEventEnvelope | null {
  if (typeof raw === 'string') {
    if (!raw || raw.startsWith(':')) return null;
    try {
      return JSON.parse(raw) as ChatEventEnvelope;
    } catch {
      return raw as unknown as ChatEventEnvelope;
    }
  }
  return raw as ChatEventEnvelope;
}

export function isStreamCompletionMarker(value: unknown): boolean {
  return (
    typeof value === 'object' &&
    value !== null &&
    'type' in value &&
    value.type === 'complete'
  );
}

export type StreamChunk = { id?: string; event: string; data: string };

export function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function stringifyUnknown(value: unknown): string | undefined {
  if (value == null) return undefined;
  if (typeof value === 'string') return value;
  if (value instanceof Error) return value.message;

  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

export function getStreamEventErrorMessage(
  eventType: ChatMessageEventTypeEnum,
  data: unknown,
): string | undefined {
  const record = isRecord(data) ? data : null;

  if (
    eventType === ChatMessageEventTypeEnum.ON_ERROR ||
    eventType === ChatMessageEventTypeEnum.ON_TOOL_ERROR ||
    eventType === ChatMessageEventTypeEnum.ON_RETRIEVER_ERROR
  ) {
    return (
      stringifyUnknown(record?.error) ??
      stringifyUnknown(record?.message) ??
      stringifyUnknown(data)
    )?.trim();
  }

  if (eventType !== ChatMessageEventTypeEnum.ON_CONVERSATION_END) {
    return undefined;
  }

  const status =
    typeof record?.status === 'string' ? record.status.toLowerCase() : '';
  if (status !== 'error' && record?.error == null) {
    return undefined;
  }

  return (
    stringifyUnknown(record?.error) ??
    stringifyUnknown(record?.message) ??
    stringifyUnknown(data)
  )?.trim();
}
