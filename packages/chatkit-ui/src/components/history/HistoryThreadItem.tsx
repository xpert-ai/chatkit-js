import { Loader2, Trash2 } from 'lucide-react';
import type { ThreadHistoryProject, ThreadItem } from '../../hooks/useThreads';
import { useChatkitTranslation } from '../../i18n/useChatkitTranslation';
import { cn } from '../../lib/utils';

export function HistoryThreadItem({
  thread,
  active,
  disabled,
  deleting,
  project,
  projectSelected,
  updatedLabel,
  updatedTitle,
  onSelect,
  onFilterProject,
  onDelete,
}: {
  thread: ThreadItem;
  active: boolean;
  disabled: boolean;
  deleting: boolean;
  project?: ThreadHistoryProject;
  projectSelected: boolean;
  updatedLabel?: string;
  updatedTitle?: string;
  onSelect: () => void;
  onFilterProject?: (project: ThreadHistoryProject) => void;
  onDelete?: () => void;
}) {
  const { t } = useChatkitTranslation();
  return (
    <li
      data-active={active}
      className={cn(
        'group relative flex min-h-[max(1.75rem,calc(2rem*var(--chat-density-scale,1)))] min-w-0 items-center gap-[calc(0.5rem*var(--chat-density-scale,1))] rounded-chat-item px-[calc(0.75rem*var(--chat-density-scale,1))] transition-colors',
        active
          ? 'bg-accent text-accent-foreground'
          : 'hover:bg-muted hover:text-foreground focus-within:bg-muted focus-within:text-foreground',
      )}
    >
      <div className="flex min-w-0 flex-1 items-center gap-[calc(0.5rem*var(--chat-density-scale,1))]">
        <button
          type="button"
          onClick={onSelect}
          disabled={disabled}
          aria-current={active ? 'true' : undefined}
          aria-label={thread.title}
          title={thread.title}
          className="min-w-0 truncate py-[calc(0.25rem*var(--chat-density-scale,1))] text-left text-sm font-medium after:absolute after:inset-0 after:rounded-chat-item focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-inset focus-visible:after:ring-ring disabled:opacity-50"
        >
          {thread.title}
          {active && <span className="sr-only">{t('history.current')}</span>}
        </button>
        {project && (
          <button
            type="button"
            onClick={() => onFilterProject?.(project)}
            disabled={disabled || !onFilterProject}
            aria-label={t('history.filterProject', { name: project.name })}
            aria-pressed={projectSelected}
            title={project.name}
            className="relative max-w-[min(40%,14rem)] shrink-0 truncate rounded-chat-item border border-border bg-background/80 px-[calc(0.5rem*var(--chat-density-scale,1))] py-[calc(0.125rem*var(--chat-density-scale,1))] text-xs text-foreground hover:bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
          >
            {project.name}
          </button>
        )}
      </div>
      {updatedLabel && thread.lastMessageAt && (
        <time
          dateTime={thread.lastMessageAt.toISOString()}
          title={updatedTitle}
          aria-label={t('history.updatedAt', { time: updatedTitle })}
          className="pointer-events-none shrink-0 whitespace-nowrap text-xs opacity-0 transition-opacity group-hover:opacity-70 group-focus-within:opacity-70 [@media(hover:none)]:opacity-70"
        >
          {updatedLabel}
        </time>
      )}
      {onDelete && (
        <button
          type="button"
          onClick={onDelete}
          disabled={disabled}
          aria-label={t('history.deleteThread', { title: thread.title })}
          className="relative shrink-0 rounded-chat-item px-[calc(0.5rem*var(--chat-density-scale,1))] py-[calc(0.25rem*var(--chat-density-scale,1))] opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 group-hover:opacity-100 group-focus-within:opacity-100 [@media(hover:none)]:opacity-100"
        >
          {deleting ? (
            <Loader2 size={15} className="animate-spin" />
          ) : (
            <Trash2 size={15} />
          )}
        </button>
      )}
    </li>
  );
}
