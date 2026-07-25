import {
  ASSISTANT_CITATION_OPEN_EVENT,
  KNOWLEDGEBASE_OPEN_CITATION_EFFECT,
  type XpertRemoteViewHostEventMessage,
  type XpertViewHostEventSubscription,
} from '@xpert-ai/xpert-sdk';
import {
  CHATKIT_INTERNAL_PARENT_EVENT,
  type ChatKitInternalParentEventDetail,
} from '../providers/ParentMessenger';

export { CHATKIT_INTERNAL_PARENT_EVENT };

export function normalizeChatKitHostEvent(
  event: Event,
  threadId?: string | null,
): XpertRemoteViewHostEventMessage | null {
  if (!(event instanceof CustomEvent)) return null;
  const detail = event.detail;
  if (!isInternalEventDetail(detail)) return null;
  if (detail.event !== 'public_event' || !Array.isArray(detail.data)) {
    return null;
  }

  const [eventType, payload] = detail.data;
  if (eventType === 'log') {
    return normalizeLog(payload, threadId);
  }
  if (eventType === 'effect') {
    return normalizeEffect(payload, threadId);
  }
  return null;
}

export function matchesHostEventSubscription(
  event: XpertRemoteViewHostEventMessage,
  subscription: XpertViewHostEventSubscription,
): boolean {
  if (event.type !== subscription.event) return false;
  const filter = subscription.filter;
  if (!filter) return true;
  return (
    includesIfPresent(filter.sources, event.source) &&
    includesIfPresent(filter.toolNames, event.toolName) &&
    includesIfPresent(filter.viewKeys, event.visualization?.viewKey) &&
    includesIfPresent(filter.visualizationTypes, event.visualization?.type)
  );
}

function normalizeLog(
  payload: unknown,
  threadId?: string | null,
): XpertRemoteViewHostEventMessage | null {
  if (!isObject(payload)) return null;
  const name = readString(payload, 'name');
  const data = Reflect.get(payload, 'data');

  if (name === 'lg.tool.end' && isObject(data)) {
    const toolName = readString(data, 'toolName');
    if (!toolName) return null;
    const toolCallId =
      readString(data, 'toolCallId') ?? readString(data, 'tool_call_id');
    const runId = readString(data, 'runId');
    const durationMs = readFiniteNumber(data, 'durationMs');
    const receivedAt = new Date().toISOString();
    return {
      id: createEventId('assistant.tool.completed', toolCallId ?? runId),
      type: 'assistant.tool.completed',
      source: 'chatkit',
      receivedAt,
      toolName,
      ...(toolCallId ? { toolCallId } : {}),
      ...(runId ? { runId } : {}),
      ...(threadId ? { threadId } : {}),
      ...(durationMs !== undefined ? { durationMs } : {}),
      data: sanitizeEventData(data),
    };
  }

  if (name === 'component' && isObject(data)) {
    const toolName = readString(data, 'tool') ?? readString(data, 'name');
    if (!toolName) return null;
    const toolCallId = readString(payload, 'id');
    const receivedAt = new Date().toISOString();
    return {
      id: createEventId('assistant.tool.completed', toolCallId ?? toolName),
      type: 'assistant.tool.completed',
      source: 'chatkit',
      receivedAt,
      toolName,
      ...(toolCallId ? { toolCallId } : {}),
      ...(threadId ? { threadId } : {}),
      data: sanitizeEventData(data),
    };
  }

  return null;
}

function normalizeEffect(
  payload: unknown,
  threadId?: string | null,
): XpertRemoteViewHostEventMessage | null {
  if (!isObject(payload)) return null;
  const name = readString(payload, 'name');
  if (name !== KNOWLEDGEBASE_OPEN_CITATION_EFFECT) return null;
  const data = Reflect.get(payload, 'data');
  const receivedAt = new Date().toISOString();
  return {
    id: createEventId(ASSISTANT_CITATION_OPEN_EVENT),
    type: ASSISTANT_CITATION_OPEN_EVENT,
    source: 'chatkit',
    receivedAt,
    ...(threadId ? { threadId } : {}),
    ...(isObject(data) ? { data: sanitizeEventData(data) } : {}),
  };
}

function isInternalEventDetail(
  value: unknown,
): value is ChatKitInternalParentEventDetail {
  if (!isObject(value)) return false;
  const event = Reflect.get(value, 'event');
  return (
    (event === 'public_event' ||
      event === 'chat_minimize_change' ||
      event === 'pet_options_change' ||
      event === 'pet_state_change') &&
    Reflect.has(value, 'data')
  );
}

function isObject(value: unknown): value is object {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function readString(value: object, key: string): string | undefined {
  const field = Reflect.get(value, key);
  return typeof field === 'string' && field.trim() ? field.trim() : undefined;
}

function readFiniteNumber(value: object, key: string): number | undefined {
  const field = Reflect.get(value, key);
  return typeof field === 'number' && Number.isFinite(field)
    ? field
    : undefined;
}

function sanitizeEventData(value: object): Record<string, unknown> {
  const data: Record<string, unknown> = {};
  for (const [key, field] of Object.entries(value)) {
    if (key === '_meta' || key === 'artifact') continue;
    data[key] = field;
  }
  return data;
}

function includesIfPresent(
  values: string[] | undefined,
  candidate: string | undefined,
): boolean {
  return !values?.length || Boolean(candidate && values.includes(candidate));
}

function createEventId(type: string, suffix?: string): string {
  const nonce =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return [type, suffix, nonce].filter(Boolean).join(':');
}
