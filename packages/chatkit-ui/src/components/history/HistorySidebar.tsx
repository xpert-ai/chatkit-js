import * as React from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import {
  ChevronDown,
  ChevronRight,
  Clock3,
  Folder,
  History,
  Loader2,
  MessageSquare,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { ScrollArea } from '../ui/scroll-area';
import { useChatkitTranslation } from '../../i18n/useChatkitTranslation';
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip';
import type { ThreadHistoryScope, ThreadItem } from '../../hooks/useThreads';

export type HistorySidebarProps = {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  showTrigger?: boolean;
  onCloseAutoFocus?: React.ComponentProps<
    typeof Dialog.Content
  >['onCloseAutoFocus'];
  threads?: ThreadItem[];
  total?: number;
  currentThreadId?: string;
  onNewThread?: () => void;
  newThreadLabel?: string;
  onRefresh?: () => void | Promise<void>;
  onSelectThread?: (thread: ThreadItem) => void;
  onDeleteThread?: (thread: ThreadItem) => void | Promise<void>;
  isRefreshing?: boolean;
  isLoadingMore?: boolean;
  error?: boolean;
  loadMoreError?: boolean;
  hasMore?: boolean;
  onLoadMore?: () => void;
  query?: string;
  onQueryChange?: (query: string) => void;
  showDelete?: boolean;
  disabled?: boolean;
  scope?: ThreadHistoryScope;
  onScopeChange?: (scope: ThreadHistoryScope) => void;
  hasCurrentProject?: boolean;
};

export function HistorySidebar({
  open: controlledOpen,
  onOpenChange,
  showTrigger = true,
  onCloseAutoFocus,
  threads = [],
  total = threads.length,
  currentThreadId,
  onNewThread,
  newThreadLabel,
  onRefresh,
  onSelectThread,
  onDeleteThread,
  isRefreshing = false,
  isLoadingMore = false,
  error = false,
  loadMoreError = false,
  hasMore = false,
  onLoadMore,
  query = '',
  onQueryChange,
  showDelete = true,
  disabled = false,
  scope = 'all',
  onScopeChange,
  hasCurrentProject = false,
}: HistorySidebarProps) {
  const { t, i18n } = useChatkitTranslation();
  const [internalOpen, setInternalOpen] = React.useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = (value: boolean) => {
    setInternalOpen(value);
    onOpenChange?.(value);
  };
  const [view, setView] = React.useState<'recent' | 'project'>('project');
  const [collapsed, setCollapsed] = React.useState<Set<string>>(new Set());
  const [deletingId, setDeletingId] = React.useState<string | null>(null);
  const [deleteError, setDeleteError] = React.useState(false);
  const searchRef = React.useRef<HTMLInputElement>(null);
  const groupId = React.useId();
  const language = i18n.resolvedLanguage ?? i18n.language;
  const dateFormat = React.useMemo(
    () => ({
      compact: new Intl.DateTimeFormat(language, {
        month: 'short',
        day: 'numeric',
      }),
      time: new Intl.DateTimeFormat(language, {
        hour: '2-digit',
        minute: '2-digit',
      }),
      full: new Intl.DateTimeFormat(language, {
        dateStyle: 'medium',
        timeStyle: 'short',
      }),
    }),
    [language],
  );
  React.useEffect(() => {
    setCollapsed(new Set());
    setDeleteError(false);
  }, [query, scope, open]);

  const projectLabel = (thread: ThreadItem) =>
    thread.projectId
      ? thread.projectName ||
        t('history.projectFallback', { id: thread.projectId.slice(0, 8) })
      : t('history.scope.noProject');
  const groups = new Map<string, { name: string; threads: ThreadItem[] }>();
  for (const thread of threads) {
    const key =
      view === 'recent' ? 'recent' : (thread.projectId ?? 'no-project');
    const group = groups.get(key) ?? {
      name: projectLabel(thread),
      threads: [],
    };
    group.threads.push(thread);
    groups.set(key, group);
  }
  const deleteThread = async (thread: ThreadItem) => {
    if (!onDeleteThread || deletingId) return;
    setDeletingId(thread.recordId);
    setDeleteError(false);
    try {
      await onDeleteThread(thread);
    } catch {
      setDeleteError(true);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      {showTrigger && (
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-flex h-8 w-8">
              <Dialog.Trigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  disabled={disabled}
                  className="h-8 w-8 cursor-pointer"
                  aria-label={t('history.threadHistory')}
                >
                  <History size={16} />
                </Button>
              </Dialog.Trigger>
            </span>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            {t('history.threadHistory')}
          </TooltipContent>
        </Tooltip>
      )}
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <Dialog.Content
          data-slot="message-history-dialog"
          onCloseAutoFocus={onCloseAutoFocus}
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            searchRef.current?.focus();
          }}
          className="fixed left-1/2 top-1/2 z-50 flex h-[min(40rem,calc(100dvh-2rem))] w-[min(48rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl border border-border bg-background text-foreground shadow-xl outline-none data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95"
        >
          <div className="flex items-start justify-between gap-4 px-5 pb-4 pt-5 sm:px-6">
            <div className="min-w-0">
              <Dialog.Title className="flex items-center gap-2 text-lg font-semibold">
                <History size={20} className="text-muted-foreground" />
                {t('history.title')}
              </Dialog.Title>
              <Dialog.Description className="mt-1 text-sm text-muted-foreground">
                {t('history.description')}
              </Dialog.Description>
            </div>
            <div className="flex shrink-0 gap-1">
              {onRefresh && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => void onRefresh()}
                  disabled={disabled || isRefreshing || isLoadingMore}
                  className="cursor-pointer text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  aria-label={t('history.refresh')}
                  title={t('history.refresh')}
                  aria-busy={isRefreshing}
                >
                  <RefreshCw
                    size={16}
                    className={cn(isRefreshing && 'animate-spin')}
                  />
                </Button>
              )}
              <Dialog.Close asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="cursor-pointer text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  aria-label={t('sheet.close')}
                >
                  <X size={16} />
                </Button>
              </Dialog.Close>
            </div>
          </div>

          <div className="space-y-3 border-b px-5 pb-4 sm:px-6">
            <div className="relative">
              <Search
                size={17}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                ref={searchRef}
                type="search"
                value={query}
                onChange={(event) => onQueryChange?.(event.target.value)}
                aria-label={t('history.search')}
                placeholder={t('history.searchPlaceholder')}
                className="rounded-lg pl-9"
              />
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              {onScopeChange && (
                <select
                  aria-label={t('history.scope.label')}
                  value={scope}
                  className="h-8 max-w-full rounded-md border border-input bg-background px-2 text-sm"
                  onChange={(event) => {
                    const value = event.target.value;
                    if (
                      value === 'all' ||
                      value === 'current-project' ||
                      value === 'no-project'
                    )
                      onScopeChange(value);
                  }}
                >
                  <option value="all">{t('history.scope.all')}</option>
                  <option value="current-project" disabled={!hasCurrentProject}>
                    {t('history.scope.currentProject')}
                  </option>
                  <option value="no-project">
                    {t('history.scope.noProject')}
                  </option>
                </select>
              )}
              <div
                role="group"
                aria-label={t('history.grouping')}
                className="flex rounded-lg bg-muted p-0.5"
              >
                {(['recent', 'project'] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    aria-pressed={view === mode}
                    onClick={() => setView(mode)}
                    className={cn(
                      'flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      view === mode
                        ? 'bg-background text-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground',
                    )}
                  >
                    {mode === 'recent' ? (
                      <Clock3 size={14} />
                    ) : (
                      <Folder size={14} />
                    )}
                    {t(`history.${mode}`)}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {(error || deleteError) && (
            <div
              role="alert"
              className="mx-5 mt-3 flex items-center justify-between gap-3 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive sm:mx-6"
            >
              <span>
                {t(deleteError ? 'history.deleteFailed' : 'history.loadFailed')}
              </span>
              {error && (
                <button
                  type="button"
                  onClick={() => void onRefresh?.()}
                  className="shrink-0 underline"
                >
                  {t('history.retry')}
                </button>
              )}
            </div>
          )}
          <ScrollArea
            className="min-h-0 flex-1"
            aria-busy={isRefreshing || isLoadingMore}
          >
            <div className="px-3 py-3 sm:px-4">
              {threads.length === 0 ? (
                <div
                  role="status"
                  className="flex flex-col items-center gap-3 px-4 py-16 text-center text-sm text-muted-foreground"
                >
                  {isRefreshing ? (
                    <Loader2 className="size-6 animate-spin" />
                  ) : (
                    <MessageSquare className="size-8 opacity-50" />
                  )}
                  {t(
                    isRefreshing
                      ? 'history.loading'
                      : error
                        ? 'history.loadFailed'
                        : query.trim()
                          ? 'history.noResults'
                          : 'history.empty',
                  )}
                </div>
              ) : (
                Array.from(groups, ([key, group], index) => (
                  <section key={key} className="mb-3 last:mb-0">
                    {view === 'project' && (
                      <button
                        type="button"
                        aria-expanded={!collapsed.has(key)}
                        aria-controls={`${groupId}-${index}`}
                        onClick={() =>
                          setCollapsed((current) => {
                            const next = new Set(current);
                            if (next.has(key)) next.delete(key);
                            else next.add(key);
                            return next;
                          })
                        }
                        className="mb-1 flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-xs font-medium text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        {collapsed.has(key) ? (
                          <ChevronRight size={14} />
                        ) : (
                          <ChevronDown size={14} />
                        )}
                        <Folder size={14} className="shrink-0" />
                        <span
                          className="min-w-0 flex-1 truncate"
                          title={group.name}
                        >
                          {group.name}
                        </span>
                        <span>{group.threads.length}</span>
                      </button>
                    )}
                    <ul
                      id={`${groupId}-${index}`}
                      hidden={view === 'project' && collapsed.has(key)}
                    >
                      {group.threads.map((thread) => {
                        const updatedAt = thread.lastMessageAt;
                        const validDate =
                          updatedAt && !Number.isNaN(updatedAt.getTime());
                        const active = currentThreadId === thread.id;
                        return (
                          <li
                            key={thread.recordId}
                            data-active={active}
                            className="group flex min-w-0 items-center gap-1 rounded-xl pr-2 transition-colors hover:bg-accent hover:text-accent-foreground data-[active=true]:bg-accent data-[active=true]:text-accent-foreground"
                          >
                            <button
                              type="button"
                              onClick={() => {
                                onSelectThread?.(thread);
                                setOpen(false);
                              }}
                              disabled={disabled || Boolean(deletingId)}
                              aria-current={active ? 'true' : undefined}
                              aria-label={thread.title}
                              className="flex min-w-0 flex-1 items-center gap-3 rounded-xl px-3 py-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset disabled:opacity-50"
                            >
                              <MessageSquare
                                size={17}
                                className="shrink-0 text-muted-foreground"
                              />
                              <span className="min-w-0 flex-1">
                                <span
                                  className="block truncate text-sm font-medium"
                                  title={thread.title}
                                >
                                  {thread.title}
                                </span>
                                <span className="mt-1 flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
                                  {view === 'recent' && (
                                    <span className="truncate">
                                      {projectLabel(thread)}
                                    </span>
                                  )}
                                  {validDate && (
                                    <time
                                      dateTime={updatedAt.toISOString()}
                                      title={dateFormat.full.format(updatedAt)}
                                    >
                                      {updatedAt.toDateString() ===
                                      new Date().toDateString()
                                        ? dateFormat.time.format(updatedAt)
                                        : dateFormat.compact.format(updatedAt)}
                                    </time>
                                  )}
                                  {active && (
                                    <span className="shrink-0">
                                      {t('history.current')}
                                    </span>
                                  )}
                                </span>
                              </span>
                            </button>
                            {showDelete && onDeleteThread && (
                              <button
                                type="button"
                                onClick={() => void deleteThread(thread)}
                                disabled={disabled || Boolean(deletingId)}
                                aria-label={t('history.deleteThread', {
                                  title: thread.title,
                                })}
                                className="shrink-0 rounded-md p-2 text-muted-foreground transition-opacity hover:bg-destructive/10 hover:text-destructive focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100"
                              >
                                {deletingId === thread.recordId ? (
                                  <Loader2 size={15} className="animate-spin" />
                                ) : (
                                  <Trash2 size={15} />
                                )}
                              </button>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  </section>
                ))
              )}
              {hasMore && onLoadMore && (
                <div className="px-2 pb-2 pt-3 text-center">
                  {loadMoreError && (
                    <p role="alert" className="mb-2 text-xs text-destructive">
                      {t('history.loadMoreFailed')}
                    </p>
                  )}
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={onLoadMore}
                    disabled={isRefreshing || isLoadingMore}
                  >
                    {isLoadingMore && (
                      <Loader2 className="mr-2 size-4 animate-spin" />
                    )}
                    {t(loadMoreError ? 'history.retry' : 'history.loadMore')}
                  </Button>
                </div>
              )}
            </div>
          </ScrollArea>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t px-5 py-3 sm:px-6">
            <span role="status" className="text-xs text-muted-foreground">
              {isRefreshing
                ? t('history.loading')
                : t('history.count', { count: threads.length, total })}
            </span>
            {onNewThread && (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => {
                  onNewThread();
                  setOpen(false);
                }}
                disabled={disabled}
              >
                <Plus size={15} />
                {newThreadLabel ?? t('history.newThread')}
              </Button>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export default HistorySidebar;
