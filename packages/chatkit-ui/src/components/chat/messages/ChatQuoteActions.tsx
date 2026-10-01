import { Loader2, MessageSquarePlus, Quote } from 'lucide-react';
import { Button } from '../../ui/button';
import type { useChatEnvironment } from '../session/useChatEnvironment';
import type { useChatQuotes } from './useChatQuotes';

type ChatQuoteActionsProps = Pick<
  ReturnType<typeof useChatQuotes>,
  | 'quoteSelection'
  | 'handleQuoteSelection'
  | 'isOpeningSideChat'
  | 'handleAskInSideChat'
  | 'sideChatError'
> &
  Pick<ReturnType<typeof useChatEnvironment>, 't' | 'workbench' | 'stream'>;

export function ChatQuoteActions({
  quoteSelection,
  handleQuoteSelection,
  t,
  workbench,
  isOpeningSideChat,
  stream,
  handleAskInSideChat,
  sideChatError,
}: ChatQuoteActionsProps) {
  return (
    quoteSelection && (
      <div
        className="pointer-events-none fixed z-50 flex flex-col items-center gap-1"
        style={{
          top: `${quoteSelection.top}px`,
          left: `${quoteSelection.left}px`,
          transform: 'translateX(-50%)',
        }}
      >
        <div className="pointer-events-auto flex overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-lg">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="rounded-none border-r"
            onMouseDown={(event) => event.preventDefault()}
            onClick={handleQuoteSelection}
            aria-label={t('composer.quoteSelection')}
            title={t('composer.quoteSelection')}
          >
            <Quote size={14} />
            {t('composer.quoteSelection')}
          </Button>
          {workbench.sideChatEnabled && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="rounded-none"
              disabled={
                isOpeningSideChat || stream.isLoading || !stream.threadId
              }
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => void handleAskInSideChat()}
              aria-label={t('composer.askInSideChat')}
              title={t('composer.askInSideChat')}
            >
              {isOpeningSideChat ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <MessageSquarePlus size={14} />
              )}
              {t('composer.askInSideChat')}
            </Button>
          )}
        </div>
        {sideChatError && (
          <div className="pointer-events-auto max-w-72 rounded-md bg-destructive px-2 py-1 text-xs text-destructive-foreground shadow">
            {sideChatError}
          </div>
        )}
      </div>
    )
  );
}
