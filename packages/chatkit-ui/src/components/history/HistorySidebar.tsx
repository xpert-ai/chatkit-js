import * as React from 'react';
import {
  History,
  MessageSquare,
  PlusCircle,
  RefreshCw,
  Trash2,
  X,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { Button } from '../ui/button';
import { ScrollArea } from '../ui/scroll-area';
import { useChatkitTranslation } from '../../i18n/useChatkitTranslation';
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip';
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '../ui/sheet';
import type { ThreadItem } from '../../hooks/useThreads';

type ThreadTimeFormatters = {
  time: Intl.DateTimeFormat;
  date: Intl.DateTimeFormat;
  dateWithYear: Intl.DateTimeFormat;
  full: Intl.DateTimeFormat;
};

const formatThreadUpdatedAt = (
  value: Date,
  formatters: ThreadTimeFormatters,
  now: Date = new Date(),
) => {
  if (Number.isNaN(value.getTime())) return null;

  const isSameYear = value.getFullYear() === now.getFullYear();
  const isSameDay =
    isSameYear &&
    value.getMonth() === now.getMonth() &&
    value.getDate() === now.getDate();

  return {
    compact: isSameDay
      ? formatters.time.format(value)
      : isSameYear
        ? formatters.date.format(value)
        : formatters.dateWithYear.format(value),
    full: formatters.full.format(value),
  };
};

export type HistorySidebarProps = {
  threads?: ThreadItem[];
  currentThreadId?: string;
  onNewThread?: () => void;
  onRefresh?: () => void | Promise<void>;
  onSelectThread?: (id: string) => void;
  onDeleteThread?: (id: string) => void;
  isRefreshing?: boolean;
  showDelete?: boolean;
  disabled?: boolean;
};

export function HistorySidebar({
  threads = [],
  currentThreadId,
  onNewThread,
  onRefresh,
  onSelectThread,
  onDeleteThread,
  isRefreshing = false,
  showDelete = true,
  disabled = false,
}: HistorySidebarProps) {
  const { t, i18n } = useChatkitTranslation();
  const [open, setOpen] = React.useState(false);
  const language = i18n.resolvedLanguage ?? i18n.language;
  const threadTimeFormatters = React.useMemo<ThreadTimeFormatters>(
    () => ({
      time: new Intl.DateTimeFormat(language, {
        hour: '2-digit',
        minute: '2-digit',
      }),
      date: new Intl.DateTimeFormat(language, {
        month: 'numeric',
        day: 'numeric',
      }),
      dateWithYear: new Intl.DateTimeFormat(language, {
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
      }),
      full: new Intl.DateTimeFormat(language, {
        dateStyle: 'medium',
        timeStyle: 'short',
      }),
    }),
    [language],
  );

  const handleNewThread = () => {
    onNewThread?.();
    setOpen(false);
  };

  const handleSelectThread = (id: string) => {
    onSelectThread?.(id);
    setOpen(false);
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex h-8 w-8">
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                disabled={disabled}
                className="h-8 w-8 cursor-pointer"
                aria-label={t('history.threadHistory')}
              >
                <History size={16} />
                <span className="sr-only">{t('history.threadHistory')}</span>
              </Button>
            </SheetTrigger>
          </span>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          {t('history.threadHistory')}
        </TooltipContent>
      </Tooltip>
      <SheetContent
        side="right"
        className="w-80 p-0"
        showCloseButton={false}
        aria-describedby={undefined}
      >
        <SheetHeader className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center space-y-0 border-b px-3 py-4">
          <SheetTitle className="col-start-2 text-center">
            {t('history.title')}
          </SheetTitle>
          <div className="col-start-3 row-start-1 flex min-w-max items-center gap-1 justify-self-end">
            {onRefresh && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => void onRefresh()}
                    disabled={disabled || isRefreshing}
                    className="cursor-pointer text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                    aria-label={t('history.refresh')}
                    aria-busy={isRefreshing}
                  >
                    <RefreshCw
                      size={16}
                      className={cn(isRefreshing && 'animate-spin')}
                    />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  {t('history.refresh')}
                </TooltipContent>
              </Tooltip>
            )}
            <SheetClose asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="cursor-pointer text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                aria-label={t('sheet.close')}
              >
                <X size={16} />
              </Button>
            </SheetClose>
          </div>
        </SheetHeader>

        <div className="p-4">
          <Button
            onClick={handleNewThread}
            className="w-full justify-start gap-2"
            variant="secondary"
          >
            <PlusCircle size={16} />
            {t('history.newThread')}
          </Button>
        </div>

        <ScrollArea className="h-[calc(100vh-140px)]">
          <div className="px-4 pb-4">
            {threads.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                {t('history.empty')}
              </div>
            ) : (
              <div>
                {threads.map((thread) => {
                  const updatedAt = thread.lastMessageAt
                    ? formatThreadUpdatedAt(
                        thread.lastMessageAt,
                        threadTimeFormatters,
                      )
                    : null;

                  return (
                    <div
                      key={thread.id}
                      data-active={currentThreadId === thread.id}
                      className={cn(
                        'group flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors',
                        'cursor-pointer hover:bg-accent hover:text-accent-foreground',
                        'data-[active=true]:bg-accent data-[active=true]:text-accent-foreground',
                      )}
                      onClick={() => handleSelectThread(thread.id)}
                    >
                      <span className="shrink-0 text-muted-foreground transition-colors group-hover:text-accent-foreground group-data-[active=true]:text-accent-foreground">
                        <MessageSquare size={16} />
                      </span>
                      <span className="min-w-0 flex-1 truncate">
                        {thread.title}
                      </span>
                      {updatedAt && (
                        <time
                          dateTime={thread.lastMessageAt?.toISOString()}
                          title={updatedAt.full}
                          aria-label={t('history.updatedAt', {
                            time: updatedAt.full,
                          })}
                          className="hidden shrink-0 whitespace-nowrap text-xs text-muted-foreground transition-colors group-hover:inline group-hover:text-accent-foreground group-focus-within:inline group-data-[active=true]:text-accent-foreground"
                        >
                          {updatedAt.compact}
                        </time>
                      )}
                      {showDelete && onDeleteThread && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteThread(thread.id);
                          }}
                          className="shrink-0 rounded p-1 opacity-0 transition-all hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100 group-focus-within:opacity-100"
                          aria-label={t('history.deleteThread', {
                            title: thread.title,
                          })}
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}

export default HistorySidebar;
