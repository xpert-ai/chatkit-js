import {
  CHAT_EVENT_TYPE_FOLLOW_UP_CONSUMED,
  type TFollowUpConsumedEvent,
} from '@xpert-ai/chatkit-types';

function normalizeString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized ? normalized : null;
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => normalizeString(item))
    .filter((item): item is string => Boolean(item));
}

export function parseFollowUpConsumedEvent(
  value: unknown,
): TFollowUpConsumedEvent | null {
  if (!value || typeof value !== 'object') return null;

  const raw = value as Record<string, unknown>;
  if (raw.type !== CHAT_EVENT_TYPE_FOLLOW_UP_CONSUMED) {
    return null;
  }

  const mode =
    raw.mode === 'queue' || raw.mode === 'steer' ? raw.mode : null;
  if (!mode) {
    return null;
  }

  const messageIds = normalizeStringArray(raw.messageIds);
  const clientMessageIds = normalizeStringArray(raw.clientMessageIds);
  if (messageIds.length === 0 && clientMessageIds.length === 0) {
    return null;
  }

  return {
    type: CHAT_EVENT_TYPE_FOLLOW_UP_CONSUMED,
    mode,
    messageIds,
    ...(clientMessageIds.length ? { clientMessageIds } : {}),
    ...(normalizeString(raw.executionId) ? { executionId: normalizeString(raw.executionId) } : {}),
    ...(normalizeString(raw.visibleAt) ? { visibleAt: normalizeString(raw.visibleAt) } : {}),
  };
}

export function resolveFollowUpConsumedIds(
  event: TFollowUpConsumedEvent | null | undefined,
): string[] {
  if (!event) return [];
  return event.clientMessageIds?.length ? event.clientMessageIds : event.messageIds;
}
