/**
 * LangGraph Event to ChatKit Event Mapping
 * 
 * | LangGraph Event          | ChatKit Event               | log.name                | log.data                              |
 * | ------------------------ | --------------------------- | ----------------------- | ------------------------------------- |
 * | `ON_CONVERSATION_START`  | `chatkit.log`               | `lg.conversation.start` | `{runId, threadId, inputSummary}`     |
 * | `ON_CONVERSATION_END`    | `chatkit.log`               | `lg.conversation.end`   | `{runId, outputSummary, usage?}`      |
 * | `ON_AGENT_START/END`     | `chatkit.log`               | `lg.agent.start/end`    | `{agentId, node, ...}`                |
 * | `ON_TOOL_START/END`      | `chatkit.log`               | `lg.tool.start/end`     | `{toolName, argsPreview, durationMs}` |
 * | `ON_TOOL_ERROR`          | `chatkit.error` + `.log`    | `lg.tool.error`         | error stack、toolName                  |
 * | `ON_RETRIEVER_START/END` | `chatkit.log`               | `lg.retriever.start/end`| `{query, topK, hitsPreview}`          |
 * | `ON_RETRIEVER_ERROR`     | `chatkit.error` + `.log`    | `lg.retriever.error`    | error                                 |
 * | `ON_CHAT_EVENT`          | `chatkit.log`               | `lg.chat.event`         | `{type, title, message, status, ...}` |
 * | `ON_INTERRUPT`           | `chatkit.log` (`effect`)    | `lg.interrupt`          | `{reason, resumable: true}`           |
 * | `ON_ERROR`               | `chatkit.error` + `.log`    | `lg.run.error`          | error                                 |
 */

import { ChatMessageEventTypeEnum } from '@xpert-ai/chatkit-types';
import type { ParentMessenger } from './ParentMessenger';

type RecordLike = Record<string, unknown>;

export type LangGraphEventContext = {
  threadId?: string | null;
  input?: unknown;
};

export type LangGraphEventState = {
  responseRuns: Map<string, { started: boolean; ended: boolean }>;
  toolStartTimes: Map<string, number>;
};

export const createLangGraphEventState = (): LangGraphEventState => ({
  responseRuns: new Map(),
  toolStartTimes: new Map(),
});

type MapLangGraphEventArgs = {
  eventType: ChatMessageEventTypeEnum;
  data: unknown;
  tags?: string[];
  messageType?: string;
  executionId?: string;
  sendEvent: ParentMessenger['sendEvent'];
  state: LangGraphEventState;
  context?: LangGraphEventContext;
};

const RUN_KEY_FALLBACK = 'unknown-run';
const MAX_PREVIEW_LENGTH = 280;

const isRecord = (value: unknown): value is RecordLike =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const pickString = (
  record: RecordLike | null | undefined,
  keys: string[],
): string | undefined => {
  if (!record) return undefined;
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim().length > 0) {
      return value;
    }
  }
  return undefined;
};

const pickNumber = (
  record: RecordLike | null | undefined,
  keys: string[],
): number | undefined => {
  if (!record) return undefined;
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
  }
  return undefined;
};

const safeJsonStringify = (value: unknown): string | undefined => {
  try {
    return JSON.stringify(value);
  } catch {
    return undefined;
  }
};

const truncate = (value: string, maxLength: number): string => {
  if (value.length <= maxLength) return value;
  if (maxLength <= 3) return value.slice(0, maxLength);
  return `${value.slice(0, maxLength - 3)}...`;
};

const summarizeValue = (value: unknown, maxLength = MAX_PREVIEW_LENGTH): string | undefined => {
  if (value == null) return undefined;
  if (typeof value === 'string') return truncate(value, maxLength);
  const json = safeJsonStringify(value);
  if (json) return truncate(json, maxLength);
  return truncate(String(value), maxLength);
};

const isAssistantMessageType = (value?: string): boolean => {
  if (!value) return false;
  const normalized = value.toLowerCase();
  return normalized === 'ai' || normalized === 'assistant';
};

const extractTaggedValue = (tags: string[] | undefined, prefixes: string[]): string | undefined => {
  if (!tags || tags.length === 0) return undefined;
  for (const tag of tags) {
    for (const prefix of prefixes) {
      if (tag.startsWith(prefix)) {
        return tag.slice(prefix.length);
      }
    }
  }
  return undefined;
};

const extractRunId = (
  data: RecordLike | null,
  tags: string[] | undefined,
  executionId?: string,
): string | undefined => {
  if (executionId) return executionId;
  const meta = isRecord(data?.metadata) ? data?.metadata : null;
  return (
    pickString(data, ['runId', 'run_id', 'executionId', 'execution_id', 'id']) ??
    pickString(meta, ['runId', 'run_id', 'executionId', 'execution_id']) ??
    extractTaggedValue(tags, ['run_id:', 'run_id=', 'runId:', 'runId='])
  );
};

const extractThreadId = (
  data: RecordLike | null,
  tags: string[] | undefined,
  context?: LangGraphEventContext,
): string | undefined => {
  if (context?.threadId) return context.threadId;
  const meta = isRecord(data?.metadata) ? data?.metadata : null;
  return (
    pickString(data, ['threadId', 'thread_id']) ??
    pickString(meta, ['threadId', 'thread_id']) ??
    extractTaggedValue(tags, ['thread_id:', 'thread_id=', 'threadId:', 'threadId='])
  );
};

const getRunKey = (runId?: string | null) => runId ?? RUN_KEY_FALLBACK;

const coerceError = (value: unknown): Error => {
  if (value instanceof Error) return value;
  if (typeof value === 'string') return new Error(value);
  if (isRecord(value)) {
    const message =
      (typeof value.message === 'string' && value.message) ||
      (typeof value.error === 'string' && value.error) ||
      safeJsonStringify(value) ||
      'Unknown error';
    const error = new Error(message);
    if (typeof value.stack === 'string') {
      error.stack = value.stack;
    }
    return error;
  }
  return new Error('Unknown error');
};

const serializeError = (error: Error) => ({
  message: error.message,
  name: error.name,
  stack: error.stack,
});

const createLogPayload = (name: string, data?: Record<string, unknown>) => ({
  name,
  ...(data ? { data } : {}),
});

const emitLog = (
  sendEvent: ParentMessenger['sendEvent'],
  name: string,
  data?: Record<string, unknown>,
) => {
  sendEvent('public_event', ['log', createLogPayload(name, data)]);
};

const emitError = (
  sendEvent: ParentMessenger['sendEvent'],
  error: Error,
) => {
  sendEvent('public_event', ['error', { error }]);
};

const extractToolName = (data: RecordLike | null): string | undefined => {
  const tool = isRecord(data?.tool) ? data?.tool : null;
  return (
    pickString(data, ['toolName', 'tool_name', 'name']) ??
    pickString(tool, ['toolName', 'tool_name', 'name'])
  );
};

const extractToolArgs = (data: RecordLike | null): unknown => {
  if (!data) return undefined;
  return (
    data.args ??
    data.input ??
    data.toolInput ??
    data.tool_input ??
    data.toolArgs ??
    data.tool_args
  );
};

const extractAgentId = (data: RecordLike | null): string | undefined =>
  pickString(data, ['agentId', 'agent_id', 'id', 'name']);

const extractAgentNode = (data: RecordLike | null): string | undefined => {
  const meta = isRecord(data?.metadata) ? data?.metadata : null;
  return pickString(data, ['node']) ?? pickString(meta, ['node']);
};

const extractRetrieverQuery = (data: RecordLike | null): unknown =>
  data?.query ?? data?.input ?? data?.search ?? data?.prompt;

const extractRetrieverTopK = (data: RecordLike | null): number | undefined =>
  pickNumber(data, ['topK', 'top_k', 'k']);

const extractRetrieverHits = (data: RecordLike | null): unknown =>
  data?.hits ?? data?.documents ?? data?.docs ?? data?.results;

const extractChatEventPayload = (data: RecordLike | null): Record<string, unknown> | undefined => {
  if (!data) return undefined;
  return data;
  // const eventRecord = isRecord(data.event) ? data.event : data;
  // const payload: Record<string, unknown> = {};
  // const type = pickString(eventRecord, ['type']);
  // const title = pickString(eventRecord, ['title']);
  // const message = pickString(eventRecord, ['message']);
  // const status = pickString(eventRecord, ['status']);
  // const error = pickString(eventRecord, ['error']);
  // const createdDate = pickString(eventRecord, ['created_date', 'createdDate']);
  // const endDate = pickString(eventRecord, ['end_date', 'endDate']);
  // if (type) payload.type = type;
  // if (title) payload.title = title;
  // if (message) payload.message = message;
  // if (status) payload.status = status;
  // if (error) payload.error = error;
  // if (createdDate) payload.created_date = createdDate;
  // if (endDate) payload.end_date = endDate;
  // return Object.keys(payload).length > 0 ? payload : undefined;
};

const extractToolKey = (runKey: string, data: RecordLike | null, toolName?: string): string => {
  const toolCallId = pickString(data, ['tool_call_id', 'toolCallId', 'id', 'call_id']);
  const identity = toolCallId ?? toolName ?? 'unknown';
  return `${runKey}:${identity}`;
};

const buildBaseLogData = (
  runId: string | undefined,
  threadId: string | undefined,
): Record<string, unknown> => {
  const data: Record<string, unknown> = {};
  if (runId) data.runId = runId;
  if (threadId) data.threadId = threadId;
  return data;
};

export const mapLangGraphEventToChatKit = ({
  eventType,
  data,
  tags,
  messageType,
  executionId,
  sendEvent,
  state,
  context,
}: MapLangGraphEventArgs) => {
  const record = isRecord(data) ? data : null;
  const runId = extractRunId(record, tags, executionId);
  const threadId = extractThreadId(record, tags, context);
  const runKey = getRunKey(runId);

  switch (eventType) {
    case ChatMessageEventTypeEnum.ON_MESSAGE_START: {
      if (!isAssistantMessageType(messageType)) return;
      const current = state.responseRuns.get(runKey);
      if (current?.started) return;
      state.responseRuns.set(runKey, { started: true, ended: false });
      sendEvent('public_event', ['response.start', undefined]);
      return;
    }
    case ChatMessageEventTypeEnum.ON_MESSAGE_END: {
      if (!isAssistantMessageType(messageType)) return;
      const current = state.responseRuns.get(runKey);
      if (!current?.started || current.ended) return;
      state.responseRuns.set(runKey, { ...current, ended: true });
      sendEvent('public_event', ['response.end', undefined]);
      return;
    }
    case ChatMessageEventTypeEnum.ON_CONVERSATION_START: {
      const inputSummary = summarizeValue(
        record?.input ?? record?.inputs ?? record?.message ?? record?.messages ?? context?.input,
      );
      emitLog(sendEvent, 'lg.conversation.start', {
        ...buildBaseLogData(runId, threadId),
        ...(inputSummary ? { inputSummary } : {}),
      });
      return;
    }
    case ChatMessageEventTypeEnum.ON_CONVERSATION_END: {
      const outputSummary = summarizeValue(
        record?.output ?? record?.outputs ?? record?.result ?? record?.finalOutput,
      );
      const usage = isRecord(record?.usage) ? record?.usage : undefined;
      emitLog(sendEvent, 'lg.conversation.end', {
        ...buildBaseLogData(runId, threadId),
        ...(outputSummary ? { outputSummary } : {}),
        ...(usage ? { usage } : {}),
      });
      return;
    }
    case ChatMessageEventTypeEnum.ON_AGENT_START:
    case ChatMessageEventTypeEnum.ON_AGENT_END: {
      const agentId = extractAgentId(record);
      const node = extractAgentNode(record);
      emitLog(
        sendEvent,
        eventType === ChatMessageEventTypeEnum.ON_AGENT_START
          ? 'lg.agent.start'
          : 'lg.agent.end',
        {
          ...buildBaseLogData(runId, threadId),
          ...(agentId ? { agentId } : {}),
          ...(node ? { node } : {}),
        },
      );
      return;
    }
    case ChatMessageEventTypeEnum.ON_TOOL_START:
    case ChatMessageEventTypeEnum.ON_TOOL_END: {
      const toolName = extractToolName(record);
      const toolCallId = pickString(record, [
        'tool_call_id',
        'toolCallId',
        'id',
        'call_id',
      ]);
      const argsPreview = summarizeValue(extractToolArgs(record));
      const outputSummary =
        eventType === ChatMessageEventTypeEnum.ON_TOOL_END
          ? summarizeValue(
              record?.output ??
                record?.outputs ??
                record?.result ??
                record?.data,
            )
          : undefined;
      const toolKey = extractToolKey(runKey, record, toolName);
      if (eventType === ChatMessageEventTypeEnum.ON_TOOL_START) {
        state.toolStartTimes.set(toolKey, Date.now());
      }
      let durationMs: number | undefined;
      if (eventType === ChatMessageEventTypeEnum.ON_TOOL_END) {
        const startedAt = state.toolStartTimes.get(toolKey);
        if (typeof startedAt === 'number') {
          durationMs = Date.now() - startedAt;
          state.toolStartTimes.delete(toolKey);
        }
      }
      emitLog(
        sendEvent,
        eventType === ChatMessageEventTypeEnum.ON_TOOL_START
          ? 'lg.tool.start'
          : 'lg.tool.end',
        {
          ...buildBaseLogData(runId, threadId),
          ...(toolName ? { toolName } : {}),
          ...(toolCallId ? { toolCallId } : {}),
          ...(argsPreview ? { argsPreview } : {}),
          ...(outputSummary ? { outputSummary } : {}),
          ...(durationMs != null ? { durationMs } : {}),
        },
      );
      return;
    }
    case ChatMessageEventTypeEnum.ON_TOOL_ERROR: {
      const toolName = extractToolName(record);
      const error = coerceError(record?.error ?? record?.message ?? data);
      emitError(sendEvent, error);
      emitLog(sendEvent, 'lg.tool.error', {
        ...buildBaseLogData(runId, threadId),
        ...(toolName ? { toolName } : {}),
        error: serializeError(error),
      });
      return;
    }
    case ChatMessageEventTypeEnum.ON_RETRIEVER_START:
    case ChatMessageEventTypeEnum.ON_RETRIEVER_END: {
      const query = summarizeValue(extractRetrieverQuery(record));
      const topK = extractRetrieverTopK(record);
      const hitsPreview = summarizeValue(extractRetrieverHits(record));
      emitLog(
        sendEvent,
        eventType === ChatMessageEventTypeEnum.ON_RETRIEVER_START
          ? 'lg.retriever.start'
          : 'lg.retriever.end',
        {
          ...buildBaseLogData(runId, threadId),
          ...(query ? { query } : {}),
          ...(topK != null ? { topK } : {}),
          ...(hitsPreview ? { hitsPreview } : {}),
        },
      );
      return;
    }
    case ChatMessageEventTypeEnum.ON_RETRIEVER_ERROR: {
      const error = coerceError(record?.error ?? record?.message ?? data);
      emitError(sendEvent, error);
      emitLog(sendEvent, 'lg.retriever.error', {
        ...buildBaseLogData(runId, threadId),
        error: serializeError(error),
      });
      return;
    }
    case ChatMessageEventTypeEnum.ON_CHAT_EVENT: {
      const eventPayload = extractChatEventPayload(record);
      emitLog(sendEvent, 'lg.chat.event', {
        ...buildBaseLogData(runId, threadId),
        ...(eventPayload ?? {}),
      });
      return;
    }
    case ChatMessageEventTypeEnum.ON_INTERRUPT: {
      const reason = summarizeValue(record?.reason ?? record?.message ?? data);
      const resumable =
        typeof record?.resumable === 'boolean' ? record?.resumable : true;
      emitLog(sendEvent, 'lg.interrupt', {
        ...buildBaseLogData(runId, threadId),
        ...(reason ? { reason } : {}),
        resumable,
      });
      return;
    }
    case ChatMessageEventTypeEnum.ON_ERROR: {
      const error = coerceError(record?.error ?? record?.message ?? data);
      emitError(sendEvent, error);
      emitLog(sendEvent, 'lg.run.error', {
        ...buildBaseLogData(runId, threadId),
        error: serializeError(error),
      });
      return;
    }
    default:
      return;
  }
};
