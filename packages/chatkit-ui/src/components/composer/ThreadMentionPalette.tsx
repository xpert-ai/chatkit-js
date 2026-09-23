import * as React from 'react';
import { Loader2, MessageCircle } from 'lucide-react';
import type { ChatKitThreadReference } from '@xpert-ai/chatkit-types';
import type { ChatConversation, Client } from '@xpert-ai/xpert-sdk';
import { useChatkitTranslation } from '../../i18n/useChatkitTranslation';
import { cn } from '../../lib/utils';

export type ThreadMentionPaletteHandle = {
  moveActive: (direction: number) => void;
  selectActive: () => boolean;
};

export type ThreadMentionPaletteProps = {
  client: Client | null;
  assistantId: string | null;
  projectId: string | null;
  threadId?: string | null;
  query: string;
  selectedThreadIds: ReadonlySet<string>;
  onSelect: (reference: ChatKitThreadReference) => void;
};

export const ThreadMentionPalette = React.forwardRef<
  ThreadMentionPaletteHandle,
  ThreadMentionPaletteProps
>(function ThreadMentionPalette(
  {
    client,
    assistantId,
    projectId,
    threadId,
    query,
    selectedThreadIds,
    onSelect,
  },
  ref,
) {
  const { t } = useChatkitTranslation();
  const [items, setItems] = React.useState<ChatConversation[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState(false);
  const [activeIndex, setActiveIndex] = React.useState(0);
  const buttons = React.useRef<Array<HTMLButtonElement | null>>([]);
  React.useEffect(() => {
    const controller = new AbortController();
    setItems([]);
    setError(false);
    setActiveIndex(0);
    if (!client || !assistantId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const timer = setTimeout(() => {
      void client.conversations
        .search(
          {
            where: { xpertId: assistantId, projectId: projectId ?? null },
            search: query.trim(),
            limit: 30,
            order: { updatedAt: 'DESC', id: 'DESC' },
          },
          { signal: controller.signal },
        )
        .then((result) => {
          if (!controller.signal.aborted) setItems(result.items);
        })
        .catch(() => {
          if (!controller.signal.aborted) setError(true);
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    }, 150);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [client, assistantId, projectId, query]);
  const visible = items.filter(
    (item) =>
      item.threadId &&
      item.threadId !== threadId &&
      !selectedThreadIds.has(item.threadId),
  );
  const index = Math.min(activeIndex, Math.max(0, visible.length - 1));
  const select = (item: ChatConversation) =>
    onSelect({
      type: 'thread',
      conversationId: item.id,
      threadId: item.threadId,
      label: (item.title || t('composer.threadMentions.untitled')).slice(
        0,
        300,
      ),
    });
  React.useImperativeHandle(ref, () => ({
    moveActive: (direction) => {
      if (visible.length)
        setActiveIndex(
          (current) => (current + direction + visible.length) % visible.length,
        );
    },
    selectActive: () => {
      const item = visible[index];
      if (!item) return false;
      select(item);
      return true;
    },
  }));
  React.useEffect(() => {
    buttons.current[index]?.scrollIntoView?.({ block: 'nearest' });
  }, [index]);
  return (
    <div
      data-slot="thread-mention-palette"
      className="mb-2 overflow-hidden rounded-xl border bg-popover text-popover-foreground shadow-md"
    >
      <div className="border-b px-3 py-2 text-sm text-muted-foreground">
        {t('composer.threadMentions.title')}
      </div>
      <div
        role="listbox"
        aria-label={t('composer.threadMentions.title')}
        className="max-h-64 overflow-y-auto p-1"
      >
        {loading ? (
          <div role="status" className="flex items-center gap-2 p-3 text-sm">
            <Loader2 className="size-4 animate-spin" />
            {t('composer.threadMentions.loading')}
          </div>
        ) : error ? (
          <div role="alert" className="p-3 text-sm">
            {t('composer.threadMentions.error')}
          </div>
        ) : visible.length === 0 ? (
          <div className="p-3 text-sm text-muted-foreground">
            {t('composer.threadMentions.empty')}
          </div>
        ) : (
          visible.map((item, itemIndex) => (
            <button
              type="button"
              role="option"
              aria-selected={index === itemIndex}
              key={item.id}
              ref={(element) => {
                buttons.current[itemIndex] = element;
              }}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => select(item)}
              className={cn(
                'flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left',
                index === itemIndex && 'bg-accent',
              )}
            >
              <MessageCircle className="size-4 shrink-0" />
              <span className="min-w-0 flex-1 truncate">
                {item.title || t('composer.threadMentions.untitled')}
              </span>
              <span className="shrink-0 text-xs text-muted-foreground">
                {item.updatedAt
                  ? `${new Date(item.updatedAt).toLocaleDateString()} · `
                  : ''}
                {item.threadId.slice(0, 8)}
              </span>
            </button>
          ))
        )}
      </div>
    </div>
  );
});
