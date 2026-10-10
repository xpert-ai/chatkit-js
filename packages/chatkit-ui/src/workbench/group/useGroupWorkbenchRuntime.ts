import { useCallback, useEffect, useMemo, useState } from 'react';
import type {
  ChatGroupWorkbenchContext,
  ChatGroupMessage,
} from '@xpert-ai/xpert-sdk';
import type { useGroupChat } from '../../components/group/useGroupChat';
import type { ChatProps } from '../../components/chat/types';
import type { ChatKitAIMessage } from '../../providers/stream/types';
import { buildHumanMessageInputPayload } from '../../lib/references';
import { createMessageId } from '../../lib/utils';
import { useChatkitTranslation } from '../../i18n/useChatkitTranslation';
import type { WorkbenchRuntime } from '../WorkbenchRuntime';

export function useGroupWorkbenchRuntime(
  group: ReturnType<typeof useGroupChat>,
  props: ChatProps,
): WorkbenchRuntime {
  const { t } = useChatkitTranslation();
  const snapshot = group.state.snapshot;
  const id = props.options?.group?.id ?? '';
  const client = useMemo(
    () => group.client.forGroupWorkbench(id),
    [group.client, id],
  );
  const [scope, setScope] = useState<ChatGroupWorkbenchContext>();
  const [error, setError] = useState<unknown>();
  const assistantId = snapshot?.xpertId ?? '';
  const revision = snapshot?.revision;
  useEffect(() => {
    if (!assistantId) return;
    const controller = new AbortController();
    void group.client.groups
      .workbenchContext(id, { signal: controller.signal })
      .then((context) => {
        if (controller.signal.aborted) return;
        setScope(context);
        setError(undefined);
      })
      .catch((reason: unknown) => {
        if (controller.signal.aborted) return;
        setError(reason);
        group.setError(
          reason instanceof Error ? reason.message : String(reason),
        );
      });
    return () => controller.abort();
  }, [group.client, id, assistantId, revision, group.setError]);
  const mapMessage = useCallback(
    (message: ChatGroupMessage): ChatKitAIMessage => ({
      id: message.id,
      type:
        snapshot?.members.find(
          (member) => member.id === message.communication.senderId,
        )?.kind === 'assistant'
          ? 'ai'
          : 'human',
      content: message.text,
      createdAt: message.createdAt,
    }),
    [snapshot?.members],
  );
  const messages = useMemo(
    () => snapshot?.messages.map(mapMessage) ?? [],
    [snapshot?.messages, mapMessage],
  );
  const sendMessage = useCallback<
    NonNullable<WorkbenchRuntime['group']>['sendMessage']
  >(
    async (message) => {
      // The group transport currently supports text and capability selection.
      // Report unsupported input rather than silently losing View payload fields.
      if (
        message.newThread ||
        message.references.length > 0 ||
        message.files.length > 0 ||
        message.state ||
        message.planMode
      )
        return false;
      if (!scope) throw new Error(t('workbench.errors.sendFailed'));
      const input = buildHumanMessageInputPayload({
        content: message.text,
        references: message.references,
        referenceComposition: message.referenceComposition,
      });
      if (!input) throw new Error(t('workbench.errors.messageRequired'));
      await group.send({
        clientMessageId: message.clientMessageId ?? createMessageId(),
        text: input.input,
        composer: {
          participantId: scope.participantId,
          projectId: scope.projectId ?? undefined,
          runtimeCapabilities: message.runtimeCapabilities,
        },
      });
    },
    [group.send, scope, t],
  );
  return {
    client,
    apiUrl: props.options?.api.apiUrl ?? '',
    assistantId,
    authenticated: !!snapshot,
    projectId: scope?.projectId ?? undefined,
    conversationId: scope?.conversationId ?? null,
    threadId: snapshot?.threadId ?? null,
    runtimeScopeReady: !!scope && scope.assistantId === assistantId,
    messages,
    isLoading:
      snapshot?.runs.some(
        (run) => run.status === 'busy' || run.status === 'pausing',
      ) ?? false,
    historyLoad: {
      threadId: snapshot?.threadId ?? null,
      status: error ? 'error' : snapshot ? 'loaded' : 'loading',
      error,
    },
    historyMessagePagination: {
      conversationId: snapshot?.id ?? null,
      threadId: snapshot?.threadId ?? null,
      loadedCount: messages.length,
      total: messages.length,
      hasMore: snapshot?.hasMore ?? false,
      isLoadingMore: false,
    },
    loadMoreConversationMessages: async () =>
      (await group.loadMore()).map(mapMessage),
    group: { id, sendMessage },
  };
}
