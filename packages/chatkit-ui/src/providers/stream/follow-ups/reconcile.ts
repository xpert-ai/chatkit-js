import type { ChatMessage, Client } from '@xpert-ai/xpert-sdk';
import {
  mapPersistedPendingFollowUp,
  type PendingFollowUp,
} from '../../../lib/follow-ups';
import type { PersistedChatMessage } from '../types';

/** Missing stream events are not evidence that the server rejected a follow-up. */
export function reconcileFollowUpReceipts(
  pending: PendingFollowUp[],
  messages: ChatMessage[],
) {
  const pendingById = new Map(
    pending
      .filter((item) => item.mode === 'steer')
      .flatMap((item) => [
        [item.id, item] as const,
        [item.clientMessageId, item] as const,
      ]),
  );
  const consumed: Array<{ id: string; visibleAt?: string | null }> = [];
  const canceled: string[] = [];
  const queued: string[] = [];
  const matched = new Set<string>();
  for (const stored of messages) {
    const message: PersistedChatMessage = { ...stored };
    if (message.role !== 'human') continue;
    const item = mapPersistedPendingFollowUp(message);
    const local = item && pendingById.get(item.clientMessageId);
    if (!local || matched.has(local.id)) continue;
    matched.add(local.id);
    if (message.followUpStatus === 'consumed') {
      consumed.push({ id: local.id, visibleAt: message.visibleAt });
    } else if (message.followUpStatus === 'canceled') {
      canceled.push(local.id);
    } else if (
      message.followUpStatus === 'pending' &&
      message.followUpMode === 'queue'
    ) {
      // The server can explicitly return an unconsumed input to its queue when
      // the target run ends. This is a receipt, not an inference from disconnect.
      queued.push(local.id);
    }
  }
  return { consumed, canceled, queued, matched: [...matched] };
}

/** Search this branch's inputs, paging until each tracked input is
 * found or the history ends. Never treat an absent receipt as rejection. */
export async function readFollowUpReceipts(
  conversations: Pick<Client['conversations'], 'searchMessages'>,
  conversationId: string,
  threadId: string,
  pending: PendingFollowUp[],
  signal: AbortSignal,
) {
  let remaining = pending.filter((item) => item.mode === 'steer');
  const consumed: Array<{ id: string; visibleAt?: string | null }> = [];
  const canceled: string[] = [];
  const queued: string[] = [];
  let offset = 0;
  while (remaining.length && !signal.aborted) {
    const page = await conversations.searchMessages(
      conversationId,
      {
        where: { role: 'human', threadId },
        order: { createdAt: 'DESC', id: 'DESC' },
        limit: 100,
        offset,
      },
      { signal },
    );
    if (signal.aborted) break;
    const result = reconcileFollowUpReceipts(remaining, page.items ?? []);
    consumed.push(...result.consumed);
    canceled.push(...result.canceled);
    queued.push(...result.queued);
    const matched = new Set(result.matched);
    remaining = remaining.filter((item) => !matched.has(item.id));
    offset += page.items?.length ?? 0;
    if (!page.items?.length || offset >= page.total) break;
  }
  return { consumed, canceled, queued };
}
