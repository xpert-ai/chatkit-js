import * as React from 'react';
import { Archive, ArchiveRestore, Trash2 } from 'lucide-react';
import type { TabMenuAction } from '../WorkbenchTabMenu';
import type { useWorkbenchSideChat } from '../shell/side-chat/useWorkbenchSideChat';
import type { SideChatSession } from './types';
import { useChatkitTranslation } from '../../i18n/useChatkitTranslation';
import { SideChatDeleteDialog } from './SideChatDeleteDialog';

export function useSideChatLifecycleActions(
  chats: ReturnType<typeof useWorkbenchSideChat>,
  onError: (message: string) => void,
) {
  const { t } = useChatkitTranslation();
  const [deleting, setDeleting] = React.useState<SideChatSession | null>(null);
  const actions = (session: SideChatSession): TabMenuAction[] => {
    const pending = chats.mutatingIds?.includes(session.threadId);
    return [
      {
        id: 'archive',
        label: t(
          session.archived
            ? 'workbench.sideChat.restore'
            : 'workbench.sideChat.archive',
        ),
        icon: session.archived ? (
          <ArchiveRestore size={16} />
        ) : (
          <Archive size={16} />
        ),
        disabled: pending,
        run: () => {
          void chats
            .archiveSideChat(session.threadId, !session.archived)
            .catch((error: unknown) =>
              onError(
                error instanceof Error
                  ? error.message
                  : t('workbench.loadFailed'),
              ),
            );
        },
      },
      {
        id: 'delete',
        label: t('workbench.sideChat.delete'),
        icon: <Trash2 size={16} />,
        variant: 'destructive',
        disabled:
          pending || session.status === 'busy' || session.status === 'pausing',
        run: () => setDeleting(session),
      },
    ];
  };
  return {
    actions,
    dialog:
      deleting &&
      chats.sessions.some(
        (session) => session.threadId === deleting.threadId,
      ) ? (
        <SideChatDeleteDialog
          key={deleting.threadId}
          title={deleting.title}
          onDelete={() => chats.deleteSideChat(deleting.threadId)}
          onClose={() => setDeleting(null)}
        />
      ) : null,
  };
}
