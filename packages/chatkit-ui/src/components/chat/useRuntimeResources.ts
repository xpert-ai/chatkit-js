import * as React from 'react';
import type {
  Client,
  RuntimeResourceCatalogItem,
  RuntimeResourcesSelection,
} from '@xpert-ai/xpert-sdk';
import { findConversationByThreadId } from '../../lib/conversation-runtime-capabilities';
import { useChatkitTranslation } from '../../i18n/useChatkitTranslation';

const empty = (): RuntimeResourcesSelection => ({ revision: 0, resources: [] });
type ResourceSubmission = {
  assistantId: string;
  projectId?: string | null;
  threadId?: string;
  conversationId?: string | null;
  selection: RuntimeResourcesSelection;
  complete: boolean;
};

export function useRuntimeResources({
  client,
  enabled,
  assistantId,
  projectId,
  conversationId,
  threadId,
}: {
  client: Client<unknown> | null;
  enabled: boolean;
  assistantId?: string | null;
  projectId?: string | null;
  conversationId?: string | null;
  threadId?: string | null;
}) {
  const { t } = useChatkitTranslation();
  const conversationUnavailable = t(
    'composer.resources.conversationUnavailable',
  );
  const [selection, setSelection] = React.useState(empty);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [resolvedId, setResolvedId] = React.useState<string | null>(null);
  const [ready, setReady] = React.useState(!enabled);
  const [reload, setReload] = React.useState(0);
  const draft = React.useRef<{
    assistantId: string;
    selection: RuntimeResourcesSelection;
  } | null>(null);
  const generation = React.useRef(0);
  const mutation = React.useRef(false);
  const submission = React.useRef<ResourceSubmission | null>(null);
  // A failed history read must never turn an existing conversation into a draft.
  // Drafts may still remove resources after project validation fails.
  const canEdit = ready || (!conversationId && !threadId);
  React.useEffect(() => {
    const current = ++generation.current;
    const pending = submission.current;
    const isDraft = !conversationId && !threadId;
    const isHandoff =
      !!pending &&
      pending.assistantId === assistantId &&
      pending.projectId === projectId &&
      ((!!conversationId && conversationId === pending.conversationId) ||
        (!!threadId && threadId === pending.threadId));
    if (
      pending &&
      !isHandoff &&
      (!isDraft ||
        pending.complete ||
        pending.assistantId !== assistantId ||
        pending.projectId !== projectId)
    ) {
      submission.current = null;
      if (!isDraft || pending.complete) draft.current = null;
    }
    const local = isHandoff
      ? pending.selection
      : isDraft && draft.current && draft.current.assistantId === assistantId
        ? draft.current.selection
        : empty();
    if ((!isDraft && !isHandoff) || draft.current?.assistantId !== assistantId)
      draft.current = null;
    setSelection(local);
    setReady(!enabled);
    setResolvedId(null);
    setError(null);
    if (!enabled || !client || !assistantId) {
      setBusy(false);
      return;
    }
    setBusy(true);
    void (async () => {
      const id =
        conversationId ??
        (threadId
          ? (
              await findConversationByThreadId(client, threadId, {
                xpertId: assistantId,
                projectId,
              })
            )?.id
          : null);
      if (!isDraft && !id) throw new Error(conversationUnavailable);
      const value = id
        ? await client.conversations.getRuntimeResources(id)
        : local;
      if (!id && value.resources.length)
        await client.assistants.validateResources(
          assistantId,
          value,
          projectId ?? undefined,
        );
      if (generation.current === current) {
        if (isHandoff && submission.current === pending)
          pending.selection = value;
        setResolvedId(id ?? null);
        setSelection(value);
        setReady(true);
      }
    })()
      .catch((reason: unknown) => {
        if (generation.current === current)
          setError(reason instanceof Error ? reason.message : String(reason));
      })
      .finally(() => {
        if (generation.current === current) setBusy(false);
      });
    return () => {
      generation.current = current + 1;
    };
  }, [
    client,
    enabled,
    assistantId,
    projectId,
    conversationId,
    threadId,
    reload,
    conversationUnavailable,
  ]);

  const toggle = React.useCallback(
    async (item: Pick<RuntimeResourceCatalogItem, 'bindingId' | 'version'>) => {
      if (
        !client ||
        !assistantId ||
        !enabled ||
        !canEdit ||
        busy ||
        mutation.current
      )
        return;
      mutation.current = true;
      const current = generation.current;
      const selected = selection.resources.some(
        (resource) => resource.bindingId === item.bindingId,
      );
      const next = {
        ...selection,
        resources: selected
          ? selection.resources.filter(
              (resource) => resource.bindingId !== item.bindingId,
            )
          : [
              ...selection.resources,
              { bindingId: item.bindingId, version: item.version },
            ],
      };
      setBusy(true);
      setError(null);
      try {
        const saved = resolvedId
          ? await client.conversations.updateRuntimeResources(resolvedId, next)
          : await client.assistants.validateResources(
              assistantId,
              next,
              projectId ?? undefined,
            );
        if (current === generation.current) {
          setSelection(saved);
          setReady(true);
          if (!resolvedId) draft.current = { assistantId, selection: saved };
        }
      } catch (reason) {
        if (current === generation.current)
          setError(reason instanceof Error ? reason.message : String(reason));
        if (resolvedId) {
          const fresh = await client.conversations
            .getRuntimeResources(resolvedId)
            .catch(() => null);
          if (current === generation.current) {
            if (fresh) setSelection(fresh);
            else setReady(false);
          }
        }
      } finally {
        mutation.current = false;
        if (current === generation.current) setBusy(false);
      }
    },
    [
      client,
      enabled,
      canEdit,
      busy,
      selection,
      resolvedId,
      assistantId,
      projectId,
    ],
  );
  const beginSubmission = React.useCallback(() => {
    if (!enabled || !assistantId || conversationId || threadId) return;
    const pending: ResourceSubmission = {
      assistantId,
      projectId,
      selection,
      complete: false,
    };
    draft.current = { assistantId, selection };
    submission.current = pending;
    return {
      onThreadResolved: (id: string, recordId?: string | null) => {
        if (submission.current !== pending) return;
        pending.threadId = id;
        pending.conversationId = recordId;
      },
      onSettled: (success: boolean) => {
        if (submission.current !== pending) return;
        if (success) pending.complete = true;
        else submission.current = null;
      },
    };
  }, [enabled, assistantId, projectId, conversationId, threadId, selection]);
  return {
    selection,
    busy,
    ready,
    canEdit,
    error,
    toggle,
    beginSubmission,
    refresh: () => setReload((value) => value + 1),
  };
}
