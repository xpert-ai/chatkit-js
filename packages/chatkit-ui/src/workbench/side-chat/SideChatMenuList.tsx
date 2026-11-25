import * as React from 'react';
import { Loader2, MessageSquare, Plus, Pencil } from 'lucide-react';
import type { useWorkbenchSideChat } from '../shell/side-chat/useWorkbenchSideChat';
import { useChatkitTranslation } from '../../i18n/useChatkitTranslation';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';

export function SideChatMenuList({
  chats,
  onOpened,
}: {
  chats: ReturnType<typeof useWorkbenchSideChat>;
  onOpened: () => void;
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
      onOpened();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  }
  const item =
    'flex min-w-0 items-center gap-2 rounded-chat-item px-[calc(0.5rem*var(--chat-density-scale,1))] py-[calc(0.5rem*var(--chat-density-scale,1))] text-sm hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring';
  return (
    <section
      aria-label={t('workbench.sideChat.list')}
      className="border-b border-border/60 pb-2 mb-2"
    >
      <div className="flex items-center justify-between px-2 py-1 text-sm text-muted-foreground">
        <span>{t('workbench.sideChat.list')}</span>
        <Button
          size="icon"
          variant="ghost"
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
      <div className="max-h-64 overflow-y-auto">
        {chats.sessions.map((session) => (
          <div key={session.threadId} className="flex items-center">
            <button
              type="button"
              className={`${item} flex-1 ${chats.activeId === session.threadId ? 'bg-accent text-accent-foreground' : ''}`}
              aria-current={
                chats.activeId === session.threadId ? 'true' : undefined
              }
              title={session.title}
              onClick={() =>
                void run(() => chats.openSideChat(session.threadId))
              }
            >
              {session.status === 'busy' ? (
                <Loader2 size={16} className="shrink-0 animate-spin" />
              ) : (
                <MessageSquare size={16} className="shrink-0" />
              )}
              <span className="truncate flex-1 text-left">{session.title}</span>
              <span className="shrink-0 text-xs text-muted-foreground">
                {t(`workbench.sideChat.${session.status ?? 'idle'}`)}
              </span>
            </button>
            <button
              type="button"
              className={item}
              aria-label={t('workbench.sideChat.rename', {
                title: session.title,
              })}
              onClick={() => {
                setEditing(session.threadId);
                setTitle(session.title);
              }}
            >
              <Pencil size={14} />
            </button>
          </div>
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
