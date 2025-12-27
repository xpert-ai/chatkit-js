import * as React from 'react';
import { cn } from '../../lib/utils';
import { Button } from '../ui/button';
import { ScrollArea } from '../ui/scroll-area';
import { useChatkitTranslation } from '../../i18n/useChatkitTranslation';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '../ui/sheet';

export type Conversation = {
  id: string;
  title: string;
  lastMessageAt?: Date;
  threadId?: string | null;
};

export type HistorySidebarProps = {
  conversations?: Conversation[];
  currentConversationId?: string;
  onNewConversation?: () => void;
  onSelectConversation?: (id: string) => void;
  onDeleteConversation?: (id: string) => void;
  disabled?: boolean;
};

// History icon
function HistoryIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
      <path d="M12 7v5l4 2" />
    </svg>
  );
}

// Plus icon for new chat
function PlusCircleIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M8 12h8M12 8v8" />
    </svg>
  );
}

// Message icon for conversation
function MessageIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

// Trash icon for delete
function TrashIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 6h18" />
      <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
      <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
    </svg>
  );
}

export function HistorySidebar({
  conversations = [],
  currentConversationId,
  onNewConversation,
  onSelectConversation,
  onDeleteConversation,
  disabled = false,
}: HistorySidebarProps) {
  const { t } = useChatkitTranslation();
  const [open, setOpen] = React.useState(false);

  const handleNewConversation = () => {
    onNewConversation?.();
    setOpen(false);
  };

  const handleSelectConversation = (id: string) => {
    onSelectConversation?.(id);
    setOpen(false);
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          disabled={disabled}
          className="h-8 w-8"
        >
          <HistoryIcon />
          <span className="sr-only">{t('history.conversationHistory')}</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-80 p-0">
        <SheetHeader className="border-b p-4">
          <SheetTitle>{t('history.title')}</SheetTitle>
        </SheetHeader>

        <div className="p-4">
          <Button
            onClick={handleNewConversation}
            className="w-full justify-start gap-2"
            variant="secondary"
          >
            <PlusCircleIcon />
            {t('history.newChat')}
          </Button>
        </div>

        <ScrollArea className="h-[calc(100vh-140px)]">
          <div className="px-4 pb-4">
            {conversations.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                {t('history.empty')}
              </div>
            ) : (
              <div className="space-y-1">
                {conversations.map((conversation) => (
                  <div
                    key={conversation.id}
                    className={cn(
                      'group flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors',
                      'hover:bg-muted cursor-pointer',
                      currentConversationId === conversation.id && 'bg-muted'
                    )}
                    onClick={() => handleSelectConversation(conversation.id)}
                  >
                    <span className="text-muted-foreground">
                      <MessageIcon />
                    </span>
                    <span className="flex-1 truncate">{conversation.title}</span>
                    {onDeleteConversation && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteConversation(conversation.id);
                        }}
                        className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-destructive/10 hover:text-destructive transition-all"
                      >
                        <TrashIcon />
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
