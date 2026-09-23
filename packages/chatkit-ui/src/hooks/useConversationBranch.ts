import { useEffect, useRef, useState } from 'react';
import type { ChatConversation, Client } from '@xpert-ai/xpert-sdk';

type BranchRequest = {
  conversationId: string;
  sourceThreadId: string;
  messageId: string;
  requestId: string;
  epoch: number;
  expectedThreadId?: string;
  target?: ChatConversation;
};

export function useConversationBranch({
  client,
  conversationId,
  threadId,
  navigate,
  onReady,
  refresh,
}: {
  client: Pick<Client, 'conversations'>;
  conversationId: string | null;
  threadId: string | null;
  navigate: (threadId: string) => Promise<void>;
  onReady: () => void;
  refresh: () => Promise<void>;
}) {
  const request = useRef<BranchRequest | null>(null);
  const inFlight = useRef<BranchRequest | null>(null);
  const mounted = useRef(true);
  const selection = useRef({ threadId, epoch: 0 });
  if (selection.current.threadId !== threadId) {
    selection.current = { threadId, epoch: selection.current.epoch + 1 };
    if (request.current?.expectedThreadId === threadId) {
      request.current.epoch = selection.current.epoch;
      request.current.expectedThreadId = undefined;
    }
  }
  const [pending, setPending] = useState<BranchRequest | null>(null);
  const [error, setError] = useState<{
    threadId: string;
    message: string;
  } | null>(null);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const branch = async (messageId: string) => {
    if (
      !conversationId ||
      !threadId ||
      inFlight.current?.epoch === selection.current.epoch
    )
      return;
    const previous = request.current;
    const current: BranchRequest =
      previous?.conversationId === conversationId &&
      previous.sourceThreadId === threadId &&
      previous.messageId === messageId &&
      previous.epoch === selection.current.epoch
        ? previous
        : {
            conversationId,
            sourceThreadId: threadId,
            messageId,
            requestId: crypto.randomUUID(),
            epoch: selection.current.epoch,
          };
    request.current = current;
    inFlight.current = current;
    setPending(current);
    setError(null);
    const isCurrent = () =>
      mounted.current &&
      request.current === current &&
      current.epoch === selection.current.epoch;
    let navigating = false;
    try {
      current.target ??= await client.conversations.branch(conversationId, {
        sourceThreadId: threadId,
        afterMessageId: messageId,
        requestId: current.requestId,
      });
      if (!isCurrent()) return;
      current.expectedThreadId = current.target.threadId;
      navigating = true;
      await navigate(current.target.threadId);
      if (!isCurrent()) return;
      onReady();
      request.current = null;
      // A sidebar refresh failure must not roll back an already loaded conversation.
      void refresh().catch(() => undefined);
    } catch (cause) {
      if (!isCurrent()) return;
      if (navigating) {
        current.expectedThreadId = threadId;
        try {
          await navigate(threadId);
        } catch {
          /* The source history supplies its own retry UI. */
        }
      }
      if (isCurrent())
        setError({
          threadId,
          message: cause instanceof Error ? cause.message : String(cause),
        });
    } finally {
      if (inFlight.current === current) {
        inFlight.current = null;
        if (mounted.current) setPending(null);
      }
    }
  };

  return {
    branch,
    pendingMessageId:
      pending?.epoch === selection.current.epoch ? pending.messageId : null,
    error: error?.threadId === threadId ? error.message : null,
  };
}
