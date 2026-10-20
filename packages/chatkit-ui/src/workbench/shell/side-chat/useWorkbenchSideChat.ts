// Invariants: entry points share one creation attempt per source scope, including failed-response retries.
// Source execution stays active; navigation only controls whether a result may update this view.
import type { ChatKitReference } from '@xpert-ai/chatkit-types';
import * as React from 'react';
import { createMessageId } from '../../../lib/utils';
import type { useChatkitTranslation } from '../../../i18n/useChatkitTranslation';
import type { WorkbenchRuntime } from '../../WorkbenchRuntime';
import { persistSideChatCloseConfirmationDisabled } from '../../side-chat/SideChatCloseDialog';
import type { useWorkbenchLayout } from '../../useWorkbenchLayout';
import {
  SIDE_CHAT_VIEW_KEY,
  type SideChatSession,
} from '../../side-chat/types';
import type { useWorkbenchShellTabs } from '../tabs/useWorkbenchShellTabs';

type WorkbenchSideChatOptions = Pick<
  ReturnType<typeof useWorkbenchShellTabs>,
  'adjacentTab'
> & {
  sideChatEnabled: boolean;
  stream: WorkbenchRuntime;
  t: ReturnType<typeof useChatkitTranslation>['t'];
  setActiveViewKey: React.Dispatch<React.SetStateAction<string | null>>;
  setOpen: ReturnType<typeof useWorkbenchLayout>['setOpen'];
  setSideChatOpening: React.Dispatch<React.SetStateAction<boolean>>;
  setSideChat: React.Dispatch<React.SetStateAction<SideChatSession | null>>;
  sideChat: SideChatSession | null;
  setSideChatCloseDialogOpen: React.Dispatch<React.SetStateAction<boolean>>;
  closeWorkbench: () => void;
  sideChatCloseConfirmationDisabled: boolean;
  setSideChatCloseConfirmationDisabled: React.Dispatch<
    React.SetStateAction<boolean>
  >;
};

export function useWorkbenchSideChat({
  sideChatEnabled,
  stream,
  t,
  setActiveViewKey,
  setOpen,
  setSideChatOpening,
  setSideChat,
  sideChat,
  setSideChatCloseDialogOpen,
  adjacentTab,
  closeWorkbench,
  sideChatCloseConfirmationDisabled,
  setSideChatCloseConfirmationDisabled,
}: WorkbenchSideChatOptions) {
  const requests = React.useRef(
    new Map<
      string,
      { requestId: string; threadId?: string; pending?: Promise<string> }
    >(),
  );
  const scope = JSON.stringify([
    stream.apiUrl,
    stream.organizationId,
    stream.assistantId,
    stream.projectId,
    stream.conversationId,
    stream.threadId,
  ]);
  const activeScope = React.useRef<string | null>(scope);
  activeScope.current = scope;
  React.useEffect(() => {
    activeScope.current = scope;
    setSideChatOpening(false);
    return () => {
      activeScope.current = null;
    };
  }, [scope, setSideChatOpening]);

  const askInSideChat = React.useCallback(
    async (reference?: ChatKitReference) => {
      if (!sideChatEnabled) return;
      const sourceThreadId = stream.threadId?.trim();
      if (!sourceThreadId) {
        throw new Error(t('workbench.sideChat.threadRequired'));
      }

      setActiveViewKey(SIDE_CHAT_VIEW_KEY);
      setOpen(true);
      setSideChatOpening(true);
      try {
        let request = requests.current.get(scope);
        if (!request) {
          request = { requestId: createMessageId() };
          requests.current.set(scope, request);
        }
        if (!request.threadId && !request.pending) {
          request.pending = stream.client.threads
            .copy(sourceThreadId, {
              mode: 'latest-sealed-reply',
              requestId: request.requestId,
            })
            .then((copiedThread) => copiedThread.thread_id);
        }
        const sideThreadId = request.threadId ?? (await request.pending!);
        request.threadId = sideThreadId;
        request.pending = undefined;
        if (activeScope.current !== scope) return;

        setSideChat((current) => ({
          sourceThreadId,
          threadId: sideThreadId,
          title:
            current?.sourceThreadId === sourceThreadId
              ? current.title
              : reference
                ? (reference.type === 'thread'
                    ? reference.label || reference.threadId
                    : reference.text
                  )
                    .trim()
                    .slice(0, 32) || t('workbench.sideChat.title')
                : t('workbench.sideChat.title'),
          referenceRequest: reference
            ? {
                id: `${Date.now()}-${(reference.type === 'thread' ? reference.threadId : reference.text).slice(0, 24)}`,
                reference,
              }
            : undefined,
        }));
      } catch (copyError) {
        // An unknown network outcome may already have created the child. Keep its key on retry.
        const request = requests.current.get(scope);
        if (request) request.pending = undefined;
        if (activeScope.current !== scope) return;
        throw sideChatError(copyError);
      } finally {
        if (activeScope.current === scope) setSideChatOpening(false);
      }
    },
    [
      sideChatEnabled,
      stream.client.threads,
      stream.threadId,
      scope,
      t,
      setOpen,
    ],
  );

  const closeSideChat = React.useCallback(() => {
    if (sideChat?.threadId) {
      // Explicit close ends this creation attempt; opening again must use a fresh key.
      for (const [key, request] of requests.current) {
        if (request.threadId === sideChat.threadId)
          requests.current.delete(key);
      }
    }
    setSideChat(null);
    setSideChatOpening(false);
    setSideChatCloseDialogOpen(false);
    const nextViewKey = adjacentTab(SIDE_CHAT_VIEW_KEY);
    setActiveViewKey(nextViewKey);
    if (!nextViewKey) closeWorkbench();
  }, [closeWorkbench, sideChat?.threadId, adjacentTab]);

  const requestCloseSideChat = React.useCallback(() => {
    if (!sideChat) return;
    if (sideChatCloseConfirmationDisabled) {
      closeSideChat();
      return;
    }
    setSideChatCloseDialogOpen(true);
  }, [closeSideChat, sideChat, sideChatCloseConfirmationDisabled]);

  const confirmCloseSideChat = React.useCallback(
    (dontAskAgain: boolean) => {
      if (dontAskAgain) {
        persistSideChatCloseConfirmationDisabled(true);
        setSideChatCloseConfirmationDisabled(true);
      }
      closeSideChat();
    },
    [closeSideChat],
  );
  return { askInSideChat, requestCloseSideChat, confirmCloseSideChat };
}

/** SDK HTTP errors retain the response body in text; show the server's localized explanation. */
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
      ) {
        return new Error(payload.message, { cause: error });
      }
    } catch {
      /* Keep the transport error when the response is not JSON. */
    }
  }
  return error;
}
