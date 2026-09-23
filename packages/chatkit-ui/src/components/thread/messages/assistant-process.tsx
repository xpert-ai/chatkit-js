import * as React from 'react';
import { ChevronRight, Loader2 } from 'lucide-react';
import { useChatkitTranslation } from '../../../i18n/useChatkitTranslation';
import { cn } from '../../../lib/utils';

export function AssistantProcess({
  process,
  children,
  running,
  forceExpanded,
  durationMs,
}: {
  process: React.ReactNode;
  children: React.ReactNode;
  running: boolean;
  forceExpanded: boolean;
  durationMs?: number;
}) {
  const { t } = useChatkitTranslation();
  const [userExpanded, setUserExpanded] = React.useState<boolean | null>(null);
  const expanded = forceExpanded || (userExpanded ?? running);
  const contentId = React.useId();
  const seconds =
    durationMs === undefined ? null : Math.floor(durationMs / 1000);
  const duration =
    seconds === null
      ? null
      : seconds >= 60
        ? t('message.process.minutesSeconds', {
            minutes: Math.floor(seconds / 60),
            seconds: seconds % 60,
          })
        : t('message.process.seconds', { seconds });
  return (
    <div className="space-y-3" data-assistant-presentation="final-answer">
      <div>
        <div className="border-b border-border/60 pb-2">
          <button
            type="button"
            className="group/process inline-flex max-w-full items-center gap-1 text-sm text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-expanded={expanded}
            aria-controls={contentId}
            aria-disabled={forceExpanded}
            onClick={() => {
              if (!forceExpanded) setUserExpanded(!expanded);
            }}
          >
            {running && (
              <Loader2
                aria-hidden="true"
                className="mr-1 h-3.5 w-3.5 animate-spin"
              />
            )}
            <span>
              {running
                ? t('message.process.running')
                : duration
                  ? t('message.process.duration', { duration })
                  : t('message.process.title')}
            </span>
            <ChevronRight
              aria-hidden="true"
              className={cn(
                'h-4 w-4 shrink-0 transition-transform',
                expanded && 'rotate-90',
              )}
            />
          </button>
        </div>
        <div id={contentId} hidden={!expanded} className="mt-3 space-y-3">
          {process}
        </div>
      </div>
      {children}
    </div>
  );
}
