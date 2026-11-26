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
  const sessions =
    state.scope === scope && sideChatEnabled ? state.sessions : [];
  const current = React.useRef(sessions);
  current.current = sessions;
  const [revision, reload] = React.useReducer((n: number) => n + 1, 0);
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
          t('workbench.sideChat.title'),
          new Map(
            current.current.map((session) => [session.threadId, session.title]),
          ),
        );
        if (controller.signal.aborted) return;
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
                existing?.opened ?? saved.opened.includes(record.threadId),
              visited:
                existing?.visited ?? saved.opened.includes(record.threadId),
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
          records.some((r) => r.threadId === saved.active) &&
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
    );
  }, [scope, state.ready, sessions, activeViewKey]);

  const openSideChat = React.useCallback(
    async (id: string, reference?: ChatKitReference) => {
      if (
        !sideChatEnabled ||
        !current.current.some((session) => session.threadId === id)
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
      const title = reference
        ? (reference.type === 'thread'
            ? reference.label || reference.threadId
            : reference.text
          )
            .trim()
            .slice(0, 64)
        : t('workbench.sideChat.numberedTitle', {
            number: current.current.length + 1,
          });
      const request = attempt;
      request.pending = stream.client.threads
        .copy(source, {
          mode: 'latest-sealed-reply',
          requestId: request.requestId,
        })
        .then((thread) => {
          request.automaticTitle = thread.metadata?.titleSource === 'default';
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
              title,
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
