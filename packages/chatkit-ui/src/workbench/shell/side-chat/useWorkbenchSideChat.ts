import type { ChatKitReference } from '@xpert-ai/chatkit-types';
import * as React from 'react';
import type { useChatkitTranslation } from '../../../i18n/useChatkitTranslation';
import type { useStreamContext } from '../../../providers/Stream';
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
  stream: ReturnType<typeof useStreamContext>;
  t: ReturnType<typeof useChatkitTranslation>['t'];
  setActiveViewKey: React.Dispatch<React.SetStateAction<string | null>>;
  setOpen: ReturnType<typeof useWorkbenchLayout>['setOpen'];
  setSideChatOpening: React.Dispatch<React.SetStateAction<boolean>>;
  sideThreadBySourceRef: React.RefObject<Map<string, string | Promise<string>>>;
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
  sideThreadBySourceRef,
  setSideChat,
  sideChat,
  setSideChatCloseDialogOpen,
  adjacentTab,
  closeWorkbench,
  sideChatCloseConfirmationDisabled,
  setSideChatCloseConfirmationDisabled,
}: WorkbenchSideChatOptions) {
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
        let cachedThread = sideThreadBySourceRef.current.get(sourceThreadId);
        if (!cachedThread) {
          cachedThread = stream.client.threads
            .copy(sourceThreadId)
            .then((copiedThread) => copiedThread.thread_id);
          sideThreadBySourceRef.current.set(sourceThreadId, cachedThread);
        }
        const sideThreadId = await cachedThread;
        sideThreadBySourceRef.current.set(sourceThreadId, sideThreadId);

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
        sideThreadBySourceRef.current.delete(sourceThreadId);
        throw copyError;
      } finally {
        setSideChatOpening(false);
      }
    },
    [sideChatEnabled, stream.client.threads, stream.threadId, t, setOpen],
  );

  const closeSideChat = React.useCallback(() => {
    if (sideChat?.sourceThreadId) {
      sideThreadBySourceRef.current.delete(sideChat.sourceThreadId);
    }
    setSideChat(null);
    setSideChatOpening(false);
    setSideChatCloseDialogOpen(false);
    const nextViewKey = adjacentTab(SIDE_CHAT_VIEW_KEY);
    setActiveViewKey(nextViewKey);
    if (!nextViewKey) closeWorkbench();
  }, [closeWorkbench, sideChat?.sourceThreadId, adjacentTab]);

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
