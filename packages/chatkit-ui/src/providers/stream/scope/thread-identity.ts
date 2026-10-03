import type { TXpertChatResumeRequest } from '@xpert-ai/chatkit-types';
import { isRecord } from '../events/envelope';
import type { StreamRunInput } from '../types';

export function normalizeThreadIdentifier(
  threadId?: string | null,
): string | null {
  const normalized = typeof threadId === 'string' ? threadId.trim() : '';
  return normalized ? normalized : null;
}

export function getConversationThreadId(conversation: unknown): string | null {
  if (!isRecord(conversation)) return null;

  const threadId = conversation.threadId ?? conversation.thread_id;
  return typeof threadId === 'string'
    ? normalizeThreadIdentifier(threadId)
    : null;
}

export function isResumeRunInput(
  input?: StreamRunInput | null,
): input is TXpertChatResumeRequest {
  return Boolean(
    input &&
    typeof input === 'object' &&
    'action' in input &&
    input.action === 'resume',
  );
}

export function shouldBroadcastThreadChange({
  threadId,
  hasObservedThreadSelection,
}: {
  threadId?: string | null;
  hasObservedThreadSelection: boolean;
}): boolean {
  const currentThreadId = normalizeThreadIdentifier(threadId);
  return hasObservedThreadSelection || currentThreadId !== null;
}
