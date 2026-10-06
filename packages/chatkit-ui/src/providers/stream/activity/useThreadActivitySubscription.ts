import { useEffect, useRef } from 'react';
import type { Client, ThreadActivitySnapshot } from '@xpert-ai/xpert-sdk';
import { parseResourceCardContent } from '@xpert-ai/chatkit-types';
import { applyResourceCard } from '../../../lib/stream-resource-card';
import { normalizeConversationMessagesPage } from '../history/pagination';
import { waitForAbortableDelay } from '../history/reconciliation';
import { upsertMessages } from '../messages/reducer';
import type { useStreamMessages } from '../messages/useStreamMessages';
import type { useStreamRunState } from '../runs/useStreamRunState';
import type { useStreamTransport } from '../transport/useStreamTransport';
import type { StateType } from '../types';

type Options = Pick<
  ReturnType<typeof useStreamMessages>,
  'valuesRef' | 'setValues'
> &
  Pick<
    ReturnType<typeof useStreamRunState>,
    'isLoadingRef' | 'pauseRequestedRef'
  > &
  Pick<ReturnType<typeof useStreamTransport>, 'runStream'> & {
    client: Client<StateType>;
    threadId: string | null;
    conversationId: string | null;
    enabled: boolean;
    scopeKey: string;
  };

/** Discovery outlives individual answers. Its cancellation never cancels a server run. */
export function useThreadActivitySubscription(options: Options) {
  const current = useRef(options);
  current.current = options;
  const { client, threadId, conversationId, enabled, scopeKey } = options;
  useEffect(() => {
    if (!enabled || !threadId || !conversationId) return;
    const controller = new AbortController();
    const { signal } = controller;
    const observed = new Map<string, string>();
    let snapshot: ThreadActivitySnapshot | null = null;
    let initialized = false;
    const isCurrent = () =>
      !signal.aborted &&
      current.current.threadId === threadId &&
      current.current.conversationId === conversationId &&
      current.current.scopeKey === scopeKey;
    const key = (run: ThreadActivitySnapshot['runs'][number]) =>
      `${run.status}:${run.updatedAt}:${run.messageRevision}`;
    const live = (status: string) =>
      status === 'pending' || status === 'running';

    const receive = async () => {
      let failures = 0;
      while (isCurrent()) {
        try {
          for await (const next of client.threads.watchActivity(threadId, {
            signal,
          })) {
            if (!isCurrent()) return;
            if (!initialized) {
              // Keep older paginated history lazy, but recover answers committed during history loading.
              const visibleRuns = new Set(
                current.current.valuesRef.current.messages
                  .map((message) => message.executionId)
                  .filter(Boolean),
              );
              const firstVisible = next.runs.findIndex((run) =>
                visibleRuns.has(run.id),
              );
              for (const [index, run] of next.runs.entries()) {
                if (index < firstVisible && !live(run.status))
                  observed.set(run.id, key(run));
              }
              initialized = true;
            }
            snapshot = next;
            failures = 0;
          }
        } catch {
          if (!isCurrent()) return;
          failures += 1;
        }
        await waitForAbortableDelay(
          signal,
          Math.min(30_000, 1000 * 2 ** Math.min(failures, 5)),
        );
      }
    };
    // A live answer may stream for minutes; card state must not wait for it.
    const projectCards = async () => {
      while (isCurrent()) {
        const value = snapshot;
        if (value) {
          // Card projections only replace existing cards by their bound message/resource identity.
          current.current.setValues((previous) => {
            if (!isCurrent()) return previous;
            let messages = previous.messages;
            for (const item of value.cards) {
              const card = parseResourceCardContent(item);
              if (card) messages = applyResourceCard(messages, card);
            }
            return messages === previous.messages
              ? previous
              : { ...previous, messages };
          });
        }
        await waitForAbortableDelay(signal, 1000);
      }
    };
    const reconcile = async () => {
      while (isCurrent()) {
        const value = snapshot;
        if (value) {
          for (const run of value.runs) {
            if (!isCurrent()) return;
            if (
              current.current.isLoadingRef.current ||
              current.current.pauseRequestedRef.current
            )
              break;
            if (observed.get(run.id) === key(run)) continue;
            try {
              if (live(run.status)) {
                await current.current.runStream(
                  threadId,
                  null,
                  { joinExistingThread: true },
                  run.id,
                );
              } else {
                // Final DB messages are authoritative. Never replay deltas over a committed snapshot.
                let offset = 0;
                const messages: StateType['messages'] = [];
                while (isCurrent()) {
                  const page = await client.conversations.searchMessages(
                    conversationId,
                    {
                      where: { threadId, role: 'ai', executionId: run.id },
                      order: { createdAt: 'ASC' },
                      limit: 100,
                      offset,
                    },
                  );
                  messages.push(
                    ...normalizeConversationMessagesPage(page).messages,
                  );
                  offset += page.items?.length ?? 0;
                  if (!page.items?.length || offset >= page.total) break;
                }
                if (!isCurrent()) return;
                if (current.current.isLoadingRef.current) break;
                current.current.setValues((previous) =>
                  isCurrent()
                    ? {
                        ...previous,
                        messages: upsertMessages(previous.messages, messages),
                      }
                    : previous,
                );
                observed.set(run.id, key(run));
              }
            } catch {
              // Discovery/reconciliation retry reads only; never resend the user's input.
              if (!isCurrent()) return;
            }
          }
        }
        await waitForAbortableDelay(signal, 1000);
      }
    };
    void receive();
    void projectCards();
    void reconcile();
    return () => controller.abort();
  }, [client, threadId, conversationId, enabled, scopeKey]);
}
