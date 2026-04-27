import * as React from 'react';
import { History, MessageSquare, PlusCircle, Trash2 } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Button } from '../ui/button';
import { ScrollArea } from '../ui/scroll-area';
import { useChatkitTranslation } from '../../i18n/useChatkitTranslation';
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '../ui/sheet';
import type { ThreadItem } from '../../hooks/useThreads';



export type HistorySidebarProps = {
  threads?: ThreadItem[];
  currentThreadId?: string;
  onNewThread?: () => void;
  onSelectThread?: (id: string) => void;
  onDeleteThread?: (id: string) => void;
  showDelete?: boolean;
  disabled?: boolean;
};

export function HistorySidebar({
  threads = [],
  currentThreadId,
  onNewThread,
  onSelectThread,
  onDeleteThread,
  showDelete = true,
  disabled = false,
}: HistorySidebarProps) {
  const { t } = useChatkitTranslation();
  const [open, setOpen] = React.useState(false);

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
        <TooltipContent side="bottom">{t('history.threadHistory')}</TooltipContent>
      </Tooltip>
      <SheetContent side="right" className="w-80 p-0">
        <SheetHeader className="border-b p-4">
          <SheetTitle>{t('history.title')}</SheetTitle>
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
              <div className="space-y-1">
                {threads.map((thread) => (
                  <div
                    key={thread.id}
                    className={cn(
                      'group flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors',
                      'hover:bg-muted cursor-pointer',
                      currentThreadId === thread.id && 'bg-muted'
                    )}
                    onClick={() => handleSelectThread(thread.id)}
                  >
                    <span className="text-muted-foreground">
                      <MessageSquare size={16} />
                    </span>
                    <span className="flex-1 truncate">{thread.title}</span>
                    {showDelete && onDeleteThread && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteThread(thread.id);
                        }}
                        className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-destructive/10 hover:text-destructive transition-all"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}

export default HistorySidebar;
