import * as React from 'react';
import { Loader2, Plus } from 'lucide-react';
import type { useWorkbenchSideChat } from '../shell/side-chat/useWorkbenchSideChat';
import { useChatkitTranslation } from '../../i18n/useChatkitTranslation';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { SideChatSummaryRow } from './SideChatSummaryRow';

export function SideChatMenuList({
  chats,
  onOpened,
}: {
  chats: ReturnType<typeof useWorkbenchSideChat>;
  onOpened?: () => void;
}) {
  const { t } = useChatkitTranslation();
  const [editing, setEditing] = React.useState<string | null>(null);
  const [title, setTitle] = React.useState('');
  const [error, setError] = React.useState('');
  const [saving, setSaving] = React.useState(false);
  async function run(action: () => Promise<void>) {
    setError('');
    try {
      await action();
      onOpened?.();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  }
  return (
    <section
      aria-label={t('workbench.sideChat.list')}
      className="chatkit-summary-section"
    >
      <div className="group/side-chat-heading chatkit-summary-heading flex items-center justify-between text-muted-foreground">
        <h3 className="text-sm font-medium">{t('workbench.sideChat.list')}</h3>
        <Button
          size="icon"
          variant="ghost"
          className="size-[max(24px,calc(1.75rem*var(--chat-density-scale,1)))] rounded-chat-item opacity-0 transition-opacity group-hover/side-chat-heading:opacity-100 focus-visible:opacity-100 data-[creating=true]:opacity-100 [@media(hover:none)]:opacity-100"
          data-creating={chats.opening}
          disabled={chats.opening}
          aria-label={t('workbench.sideChat.create')}
          onClick={() => void run(chats.askInSideChat)}
        >
          {chats.opening ? (
            <Loader2 className="animate-spin" size={16} />
          ) : (
            <Plus size={16} />
          )}
        </Button>
      </div>
      <div className="chatkit-summary-items max-h-64 overflow-y-auto">
        {chats.sessions.map((session) => (
          <SideChatSummaryRow
            key={session.threadId}
            session={session}
            active={chats.activeId === session.threadId}
            creating={chats.opening}
            onOpen={() => void run(() => chats.openSideChat(session.threadId))}
            onClose={() => chats.closeSideChat(session.threadId)}
            onRename={() => {
              setEditing(session.threadId);
              setTitle(session.title);
            }}
            onCreate={() => void run(chats.askInSideChat)}
          />
        ))}
        {!chats.sessions.length && (
          <p className="px-2 py-2 text-xs text-muted-foreground">
            {t(chats.ready ? 'workbench.sideChat.empty' : 'workbench.loading')}
          </p>
        )}
      </div>
      {editing && (
        <form
          className="flex gap-2 p-2"
          onSubmit={(event) => {
            event.preventDefault();
            setSaving(true);
            setError('');
            void chats
              .renameSideChat(editing, title)
              .then(() => setEditing(null))
              .catch((cause: unknown) =>
                setError(
                  cause instanceof Error ? cause.message : String(cause),
                ),
              )
              .finally(() => setSaving(false));
          }}
        >
          <Input
            autoFocus
            aria-label={t('workbench.sideChat.name')}
            value={title}
            maxLength={200}
            onChange={(event) => setTitle(event.target.value)}
          />
          <Button type="submit" disabled={saving || !title.trim()}>
            {t('workbench.sideChat.save')}
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => setEditing(null)}
          >
            {t('workbench.sideChat.cancel')}
          </Button>
        </form>
      )}
      {(error || chats.error) && (
        <div role="alert" className="px-2 text-xs text-destructive">
          {error || chats.error}
          <button
            type="button"
            className="ml-2 underline"
            onClick={chats.reload}
          >
            {t('workbench.retry')}
          </button>
        </div>
      )}
    </section>
  );
}
