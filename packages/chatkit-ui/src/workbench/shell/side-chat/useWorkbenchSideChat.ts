// Creation identities belong to an intent, not a source thread. Retried requests
// reuse their identity; successful creation releases it for the next side chat.
import type { ChatKitReference } from '@xpert-ai/chatkit-types';
import * as React from 'react';
import { createMessageId } from '../../../lib/utils';
import type { useChatkitTranslation } from '../../../i18n/useChatkitTranslation';
import type { WorkbenchRuntime } from '../../WorkbenchRuntime';
import { sideChatViewKey, type SideChatSession } from '../../side-chat/types';
import {
  readSideChatLayout,
  sideChatRecords,
  sideChatSelection,
  writeSideChatLayout,
} from '../../side-chat/side-chat-records';

type Options = {
  sideChatEnabled: boolean;
  stream: WorkbenchRuntime;
  identity?: string;
  t: ReturnType<typeof useChatkitTranslation>['t'];
  activeViewKey: string | null;
  setActiveViewKey: React.Dispatch<React.SetStateAction<string | null>>;
  setOpen: (open: boolean) => void;
};
type State = {
  scope: string;
  sessions: SideChatSession[];
  ready: boolean;
  error: string | null;
};
type Attempt = {
  requestId: string;
  pending?: Promise<string>;
  automaticTitle?: boolean;
  inheritedMessagesEndId?: string;
  references: ChatKitReference[];
};

export function useWorkbenchSideChat({
  sideChatEnabled,
  stream,
  identity,
  t,
  activeViewKey,
  setActiveViewKey,
  setOpen,
}: Options) {
  const scope = JSON.stringify([
    stream.apiUrl,
    stream.organizationId,
    identity,
    stream.assistantId,
    stream.projectId,
    stream.conversationId,
  ]);
  const generation = React.useRef({ scope, source: stream.threadId });
  if (
    generation.current.scope !== scope ||
    generation.current.source !== stream.threadId
  )
    generation.current = { scope, source: stream.threadId };
  const alive = React.useRef(true);
  React.useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const [state, setState] = React.useState<State>({
    scope,
    sessions: [],
    ready: false,
    error: null,
  });
  const [openingContext, setOpeningContext] = React.useState<
    typeof generation.current | null
  >(null);
  const attempts = React.useRef(new Map<string, Attempt>());
  const mutationVersion = React.useRef(0);
  const pendingMutations = React.useRef(new Set<string>());
  const [mutatingIds, setMutatingIds] = React.useState<string[]>([]);
  const sessions =
    state.scope === scope && sideChatEnabled ? state.sessions : [];
  const current = React.useRef(sessions);
  current.current = sessions;
  const [revision, reload] = React.useReducer((n: number) => n + 1, 0);
  const defaultTitle = React.useCallback(
    (number: number) =>
      t('workbench.sideChat.numberedTitle', {
        title:
          stream.conversation?.title?.trim() || t('workbench.sideChat.title'),
        number,
      }),
    [stream.conversation?.title, t],
  );
  const update = React.useCallback(
    (change: (sessions: SideChatSession[]) => SideChatSession[]) => {
      setState((old) =>
        old.scope === scope ? { ...old, sessions: change(old.sessions) } : old,
      );
    },
    [scope],
  );

  React.useEffect(() => {
    if (
      !sideChatEnabled ||
      !stream.conversationId ||
      stream.runtimeScopeReady === false
    )
      return;
    const controller = new AbortController();
    const conversationId = stream.conversationId;
    const saved = readSideChatLayout(scope);
    setState((old) =>
      old.scope === scope
        ? old
        : { scope, sessions: [], ready: false, error: null },
    );
    let refreshing = false;
    async function refresh() {
      if (refreshing) return;
      refreshing = true;
      const version = mutationVersion.current;
      const requestedIds = new Set(
        current.current.map((session) => session.threadId),
      );
      try {
        const threads = await stream.client.conversations.listThreads(
          conversationId,
          { signal: controller.signal },
        );
        const records = sideChatRecords(
          threads,
          defaultTitle,
          new Map([
            ...Object.entries(saved.titles),
            ...current.current.map((session): [string, string] => [
              session.threadId,
              session.title,
            ]),
          ]),
          new Map([
            ...Object.entries(saved.sequences),
            ...current.current.flatMap((session): [string, number][] =>
              session.sequence ? [[session.threadId, session.sequence]] : [],
            ),
          ]),
        );
        if (controller.signal.aborted || version !== mutationVersion.current)
          return;
        setState((old) => {
          const previous = old.scope === scope ? old.sessions : [];
          const byId = new Map(
            previous.map((session) => [session.threadId, session]),
          );
          const merged: SideChatSession[] = records.map((record) => {
            const existing = byId.get(record.threadId);
            return {
              ...existing,
              ...record,
              selectedThreadId: sideChatSelection(
                threads,
                record.threadId,
                existing?.selectedThreadId ?? saved.selected[record.threadId],
              ),
              opened:
                !record.archived &&
                (existing?.opened ?? saved.opened.includes(record.threadId)),
              visited:
                !record.archived &&
                (existing?.visited ?? saved.opened.includes(record.threadId)),
            };
          });
          // A creation may finish after this list request started.
          for (const session of previous)
            if (
              !records.some((r) => r.threadId === session.threadId) &&
              !requestedIds.has(session.threadId)
            )
              merged.push(session);
          if (!previous.length)
            merged.sort((a, b) => {
              const order = (id: string) => {
                const index = saved.opened.indexOf(id);
                return index < 0 ? saved.opened.length : index;
              };
              return order(a.threadId) - order(b.threadId);
            });
          return { scope, sessions: merged, ready: true, error: null };
        });
        if (
          saved.active &&
          records.some((r) => r.threadId === saved.active && !r.archived) &&
          !current.current.length
        )
          setActiveViewKey((key) => key ?? sideChatViewKey(saved.active!));
      } catch (error) {
        if (!controller.signal.aborted)
          setState((old) =>
            old.scope === scope
              ? {
                  ...old,
                  sessions: isAccessDenied(error) ? [] : old.sessions,
                  ready: true,
                  error:
                    error instanceof Error
                      ? error.message
                      : t('workbench.loadFailed'),
                }
              : old,
          );
      } finally {
        refreshing = false;
      }
    }
    void refresh();
    const timer = window.setInterval(() => {
      if (document.visibilityState !== 'hidden') void refresh();
    }, 15000);
    return () => {
      controller.abort();
      window.clearInterval(timer);
    };
  }, [
    scope,
    sideChatEnabled,
    stream.runtimeScopeReady,
    stream.client,
    stream.conversationId,
    revision,
    defaultTitle,
    t,
  ]);

  React.useEffect(() => {
    if (state.scope !== scope || !state.ready) return;
    writeSideChatLayout(
      scope,
      sessions.filter((s) => s.opened).map((s) => s.threadId),
      sessions.find((s) => sideChatViewKey(s.threadId) === activeViewKey)
        ?.threadId ?? null,
      Object.fromEntries(
        sessions
          .filter((s) => s.selectedThreadId)
          .map((s) => [s.threadId, s.selectedThreadId!]),
      ),
      Object.fromEntries(sessions.map((s) => [s.threadId, s.title])),
      {
        ...readSideChatLayout(scope).sequences,
        ...Object.fromEntries(
          sessions.flatMap((s) =>
            s.sequence ? [[s.threadId, s.sequence]] : [],
          ),
        ),
      },
    );
  }, [scope, state.ready, sessions, activeViewKey]);

  const openSideChat = React.useCallback(
    async (id: string, reference?: ChatKitReference) => {
      if (
        !sideChatEnabled ||
        !current.current.some(
          (session) => session.threadId === id && !session.archived,
        )
      )
        return;
      update((list) =>
        list.map((s) =>
          s.threadId === id
            ? {
                ...s,
                opened: true,
                visited: true,
                referenceRequest: reference
                  ? { id: createMessageId(), reference }
                  : s.referenceRequest,
              }
            : s,
        ),
      );
      setActiveViewKey(sideChatViewKey(id));
      setOpen(true);
    },
    [sideChatEnabled, update, setOpen],
  );

  const askInSideChat = React.useCallback(
    async (
      reference?: ChatKitReference,
      onCreated?: (id: string) => void,
    ): Promise<void> => {
      if (!sideChatEnabled) return;
      const source = stream.threadId?.trim();
      if (!source || !stream.conversationId)
        throw new Error(t('workbench.sideChat.threadRequired'));
      const context = generation.current;
      const intentKey = JSON.stringify([scope, source]);
      let attempt = attempts.current.get(intentKey);
      if (!attempt) {
        attempt = { requestId: createMessageId(), references: [] };
        attempts.current.set(intentKey, attempt);
      }
      if (
        reference &&
        !attempt.references.some(
          (r) => JSON.stringify(r) === JSON.stringify(reference),
        )
      )
        attempt.references.push(reference);
      if (attempt.pending) {
        await attempt.pending;
        return;
      }
      setOpeningContext(context);
      const sequence =
        Math.max(
          0,
          ...Object.values(readSideChatLayout(scope).sequences),
          ...current.current.map((s) => s.sequence ?? 0),
        ) + 1;
      const title = defaultTitle(sequence);
      const request = attempt;
      request.pending = stream.client.threads
        .copy(source, {
          mode: 'latest-sealed-reply',
          requestId: request.requestId,
        })
        .then((thread) => {
          request.automaticTitle = thread.metadata?.titleSource === 'default';
          request.inheritedMessagesEndId = sideChatRecords(
            [thread],
            title,
          )[0]?.inheritedMessagesEndId;
          return thread.thread_id;
        });
      try {
        const id = await request.pending;
        attempts.current.delete(intentKey);
        // Older servers have no automatic-title ownership; retain their existing label behavior.
        if (!request.automaticTitle)
          void stream.client.threads
            .update(id, { metadata: { title } })
            .catch((error: unknown) => {
              if (alive.current && generation.current === context)
                setState((old) =>
                  old.scope === scope
                    ? {
                        ...old,
                        error:
                          error instanceof Error
                            ? error.message
                            : t('workbench.loadFailed'),
                      }
                    : old,
                );
            });
        if (!alive.current || generation.current !== context) return;
        setState((old) => ({
          scope,
          ready: true,
          error: old.scope === scope ? old.error : null,
          sessions: [
            ...(old.scope === scope
              ? old.sessions.filter((s) => s.threadId !== id)
              : []),
            {
              sourceThreadId: source,
              threadId: id,
              inheritedMessagesEndId: request.inheritedMessagesEndId,
              title,
              sequence,
              status: 'idle',
              opened: true,
              visited: true,
              referenceRequest: request.references[0]
                ? {
                    id: createMessageId(),
                    reference: request.references[0],
                    references: request.references,
                  }
                : undefined,
            },
          ],
        }));
        onCreated?.(id);
        setActiveViewKey(sideChatViewKey(id));
        setOpen(true);
      } catch (error) {
        request.pending = undefined;
        if (alive.current && generation.current === context)
          throw sideChatError(error);
      } finally {
        if (alive.current && generation.current === context)
          setOpeningContext(null);
      }
    },
    [
      scope,
      stream.client,
      stream.threadId,
      stream.conversationId,
      defaultTitle,
      sideChatEnabled,
      setOpen,
      t,
    ],
  );

  const closeSideChat = React.useCallback(
    (id: string) => {
      update((list) =>
        list.map((s) => (s.threadId === id ? { ...s, opened: false } : s)),
      );
    },
    [update],
  );
  const renameSideChat = React.useCallback(
    async (id: string, title: string) => {
      if (!title.trim() || !current.current.some((s) => s.threadId === id))
        return;
      const context = generation.current;
      await stream.client.threads.update(id, {
        metadata: { title: title.trim() },
      });
      if (alive.current && generation.current === context)
        update((list) =>
          list.map((s) =>
            s.threadId === id ? { ...s, title: title.trim() } : s,
          ),
        );
    },
    [stream.client, update],
  );
  const updateStatus = React.useCallback(
    (
      id: string,
      status: SideChatSession['status'],
      selectedThreadId?: string | null,
    ) => {
      const previous = current.current.find((s) => s.threadId === id)?.status;
      if (status === 'idle' && previous && previous !== 'idle') reload();
      update((list) =>
        list.map((s) =>
          s.threadId === id && s.status !== status ? { ...s, status } : s,
        ),
      );
    },
    [update],
  );
  const mutateSideChat = React.useCallback(
    async (id: string, archived?: boolean) => {
      if (!current.current.some((session) => session.threadId === id)) return;
      const context = generation.current;
      const key = JSON.stringify([scope, id]);
      if (pendingMutations.current.has(key))
        throw new Error(t('workbench.sideChat.actionPending'));
      pendingMutations.current.add(key);
      setMutatingIds((ids) => [...ids, id]);
      mutationVersion.current++;
      try {
        if (archived === undefined) await stream.client.threads.delete(id);
        else await stream.client.threads.update(id, { metadata: { archived } });
        if (!alive.current || generation.current !== context) return;
        mutationVersion.current++;
        update((list) =>
          archived === undefined
            ? list.filter((session) => session.threadId !== id)
            : list.map((session) =>
                session.threadId === id
                  ? {
                      ...session,
                      archived,
                      opened: !archived,
                      visited: !archived,
                    }
                  : session,
              ),
        );
        if (archived === false) {
          setActiveViewKey(sideChatViewKey(id));
          setOpen(true);
        }
        reload();
      } catch (error) {
        throw sideChatError(error);
      } finally {
        pendingMutations.current.delete(key);
        if (alive.current)
          setMutatingIds((ids) => ids.filter((item) => item !== id));
      }
    },
    [scope, stream.client, update, setActiveViewKey, setOpen, t],
  );
  const archiveSideChat = React.useCallback(
    (id: string, archived = true) => mutateSideChat(id, archived),
    [mutateSideChat],
  );
  const deleteSideChat = React.useCallback(
    (id: string) => mutateSideChat(id),
    [mutateSideChat],
  );
  return {
    sessions,
    opening: openingContext === generation.current,
    activeId: sessions.find(
      (s) => sideChatViewKey(s.threadId) === activeViewKey,
    )?.threadId,
    error: state.scope === scope ? state.error : null,
    ready: state.scope === scope && state.ready,
    askInSideChat,
    openSideChat,
    closeSideChat,
    renameSideChat,
    archiveSideChat,
    deleteSideChat,
    mutatingIds,
    updateStatus,
    reload,
  };
}

function sideChatError(error: unknown): unknown {
  if (
    error instanceof Error &&
    'text' in error &&
    typeof error.text === 'string'
  ) {
    try {
      const payload: unknown = JSON.parse(error.text);
      if (
        payload &&
        typeof payload === 'object' &&
        'message' in payload &&
        typeof payload.message === 'string' &&
        payload.message.trim()
      )
        return new Error(payload.message, { cause: error });
    } catch {
      /* Preserve a non-JSON transport error. */
    }
  }
  return error;
}

function isAccessDenied(error: unknown): boolean {
  return (
    error instanceof Error &&
    'status' in error &&
    (error.status === 401 || error.status === 403 || error.status === 404)
  );
}
