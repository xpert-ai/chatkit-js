// Hydration is a state replacement, never an event replay: no host effects, client tools or execution commands.
import type { TMessageContentReasoning } from '@xpert-ai/chatkit-types';
import type { LangGraphEventState } from '../../langGraphEventMapper';
import { createMessageFromData } from '../messages/metadata';
import type { ChatKitAIMessage, StateType } from '../types';

/** Wire counterpart of TRunDisplaySnapshotPayload in the platform contracts. */
export interface DisplaySnapshot {
  threadId: string;
  runId: string;
  segmentId: string;
  revision: number;
  cursor: string;
  activeMessageId: string;
  messages: ChatKitAIMessage[];
  continuous: boolean;
}

export function parseDisplaySnapshot(payload: unknown): DisplaySnapshot | null {
  if (
    !payload ||
    typeof payload !== 'object' ||
    !('type' in payload) ||
    payload.type !== 'stream_snapshot' ||
    !('snapshot' in payload) ||
    !('continuous' in payload) ||
    typeof payload.continuous !== 'boolean'
  )
    return null;
  const value = payload.snapshot;
  if (
    !value ||
    typeof value !== 'object' ||
    !('version' in value) ||
    value.version !== 1 ||
    !('threadId' in value) ||
    typeof value.threadId !== 'string' ||
    !('runId' in value) ||
    typeof value.runId !== 'string' ||
    !('segmentId' in value) ||
    typeof value.segmentId !== 'string' ||
    !('revision' in value) ||
    !Number.isSafeInteger(value.revision) ||
    typeof value.revision !== 'number' ||
    value.revision < 0 ||
    !('cursor' in value) ||
    typeof value.cursor !== 'string' ||
    !/^\d+-\d+$/.test(value.cursor) ||
    !('activeMessageId' in value) ||
    typeof value.activeMessageId !== 'string' ||
    !('messages' in value) ||
    !Array.isArray(value.messages)
  )
    return null;
  const messages: ChatKitAIMessage[] = [];
  const candidates: unknown[] = value.messages;
  for (const raw of candidates) {
    if (
      !raw ||
      typeof raw !== 'object' ||
      !('id' in raw) ||
      typeof raw.id !== 'string' ||
      !('role' in raw) ||
      raw.role !== 'ai' ||
      !('executionId' in raw) ||
      raw.executionId !== value.runId
    )
      return null;
    // Select display fields instead of accepting tool calls, command metadata or execution context.
    const message = createMessageFromData({
      id: raw.id,
      role: 'ai',
      executionId: raw.executionId,
      content: 'content' in raw ? raw.content : '',
      status: 'status' in raw ? raw.status : undefined,
      agentRuns: 'agentRuns' in raw ? raw.agentRuns : undefined,
    });
    if (!message) return null;
    if ('reasoning' in raw && Array.isArray(raw.reasoning)) {
      const reasoning: TMessageContentReasoning[] = [];
      const parts: unknown[] = raw.reasoning;
      for (const part of parts) {
        if (
          !part ||
          typeof part !== 'object' ||
          !('type' in part) ||
          part.type !== 'reasoning' ||
          !('text' in part) ||
          typeof part.text !== 'string'
        )
          return null;
        reasoning.push({
          type: 'reasoning',
          text: part.text,
          ...('id' in part && typeof part.id === 'string'
            ? { id: part.id }
            : {}),
          ...('executionId' in part && typeof part.executionId === 'string'
            ? { executionId: part.executionId }
            : {}),
          ...('parentExecutionId' in part &&
          typeof part.parentExecutionId === 'string'
            ? { parentExecutionId: part.parentExecutionId }
            : {}),
          ...('agentKey' in part && typeof part.agentKey === 'string'
            ? { agentKey: part.agentKey }
            : {}),
          ...('xpertName' in part && typeof part.xpertName === 'string'
            ? { xpertName: part.xpertName }
            : {}),
          ...('runId' in part && typeof part.runId === 'string'
            ? { runId: part.runId }
            : {}),
        });
      }
      Object.assign(message, { reasoning });
    }
    messages.push(message);
  }
  if (
    !messages.some((message) => message.id === value.activeMessageId) ||
    new Set(messages.map((m) => m.id)).size !== messages.length
  )
    return null;
  return {
    threadId: value.threadId,
    runId: value.runId,
    segmentId: value.segmentId,
    revision: value.revision,
    cursor: value.cursor,
    activeMessageId: value.activeMessageId,
    continuous: payload.continuous,
    messages,
  };
}

export function hydrateDisplaySnapshot(
  value: StateType,
  snapshot: DisplaySnapshot,
): StateType {
  const replacements = new Map(
    snapshot.messages.map((message) => [message.id, message]),
  );
  const messages = value.messages.map((message) => {
    const replacement = replacements.get(message.id);
    if (!replacement) return message;
    replacements.delete(message.id);
    return replacement;
  });
  return { ...value, messages: [...messages, ...replacements.values()] };
}

export function restoreDisplayEventState(
  state: LangGraphEventState & { activeMessageId?: string },
  snapshot: DisplaySnapshot,
) {
  state.activeMessageId = snapshot.activeMessageId;
  state.responseRuns.clear();
  state.toolStartTimes.clear();
  for (const message of snapshot.messages) {
    for (const run of message.agentRuns ?? []) {
      state.responseRuns.set(run.id, {
        started: true,
        ended: ['success', 'error', 'interrupted'].includes(run.status ?? ''),
      });
    }
  }
}

export function compareDisplayCursors(left: string, right: string): number {
  const [lm, ls] = left.split('-').map(BigInt);
  const [rm, rs] = right.split('-').map(BigInt);
  return lm < rm || (lm === rm && ls < rs)
    ? -1
    : lm === rm && ls === rs
      ? 0
      : 1;
}
