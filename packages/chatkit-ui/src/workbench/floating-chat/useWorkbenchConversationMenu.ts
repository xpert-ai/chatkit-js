import * as React from 'react';
import type { ConversationActionContext } from '../../components/conversation/conversation-actions';
import type { ConversationMenuProps } from '../../components/conversation/ConversationMenu';

type Menu = Pick<ConversationMenuProps, 'context' | 'target'>;

/** Publish semantic changes to the shell without a render loop from action closures. */
export function useWorkbenchConversationMenu(menu?: Menu): Menu | undefined {
  const latest = React.useRef(menu);
  React.useLayoutEffect(() => {
    latest.current = menu;
  });
  const { context, target } = menu ?? {};
  const {
    client,
    scopeKey,
    ready,
    activeConversationId,
    activeThreadId,
    running,
    history,
    branchEnabled,
  } = context ?? {};
  const { showRename, showDelete } = history ?? {};
  const hasSideChat = !!context?.sideChat;
  const hasSidebar = !!context?.setSidebar;
  const pinned = target?.sidebar?.pinned;
  const archived = target?.sidebar?.archived;
  const { id, recordId, title, projectId, status } = target ?? {};
  return React.useMemo(() => {
    if (!client || scopeKey === undefined || !id || !recordId) return undefined;
    // Each published callback is bound to its original authorization scope. A stale
    // menu must never apply an action to a newly selected conversation.
    const current = () => {
      if (
        latest.current?.context.scopeKey !== scopeKey ||
        latest.current.context.client !== client ||
        !latest.current.context.ready ||
        latest.current.target.id !== id ||
        latest.current.target.recordId !== recordId
      )
        throw new Error('Conversation changed');
      return latest.current.context;
    };
    const actions: ConversationActionContext = {
      client,
      scopeKey,
      ready: !!ready,
      activeConversationId: activeConversationId ?? null,
      activeThreadId: activeThreadId ?? null,
      running: !!running,
      history: { showRename, showDelete },
      branchEnabled: !!branchEnabled,
      rename: (target, title) => current().rename(target, title),
      setSidebar: hasSidebar
        ? (target, patch) => {
            const update = current().setSidebar;
            if (!update) throw new Error('Action unavailable');
            return update(target, patch);
          }
        : undefined,
      delete: (target) => current().delete(target),
      navigate: (record) => current().navigate(record),
      sideChat: hasSideChat
        ? async () => {
            await current().sideChat?.();
          }
        : undefined,
    };
    return {
      context: actions,
      target: {
        id,
        recordId,
        title: title ?? '',
        projectId,
        status: status ?? 'idle',
        sidebar:
          pinned === undefined || archived === undefined
            ? undefined
            : { pinned, archived },
      },
    };
  }, [
    client,
    scopeKey,
    ready,
    activeConversationId,
    activeThreadId,
    running,
    showRename,
    showDelete,
    branchEnabled,
    hasSideChat,
    hasSidebar,
    pinned,
    archived,
    id,
    recordId,
    title,
    projectId,
    status,
  ]);
}
