import type { ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';

import { cn } from '../../lib/utils';

/** Shared presentation for the activity panels above the composer. */
export function PendingActivityPanel({
  icon,
  summary,
  accessory,
  listId,
  isCollapsed,
  onToggle,
  attachToComposer,
  className,
  children,
}: {
  icon: ReactNode;
  summary: ReactNode;
  accessory?: ReactNode;
  listId: string;
  isCollapsed: boolean;
  onToggle: () => void;
  attachToComposer: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      aria-live="polite"
      data-slot="pending-activity-panel"
      data-attached={attachToComposer || undefined}
      className={cn(
        'min-w-0 rounded-chat-panel border border-border/60 bg-background text-foreground',
        className,
      )}
    >
      <button
        type="button"
        data-slot="pending-activity-toggle"
        className="flex w-full min-w-0 items-center justify-between rounded-chat-item text-left text-sm font-medium text-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-expanded={!isCollapsed}
        aria-controls={listId}
        onClick={onToggle}
      >
        <span className="flex min-w-0 items-center gap-[calc(0.5rem*var(--chat-density-scale,1))]">
          {icon}
          <span className="truncate">{summary}</span>
        </span>
        <span className="flex shrink-0 items-center gap-[calc(0.5rem*var(--chat-density-scale,1))] text-muted-foreground">
          {accessory}
          <ChevronDown
            className={cn('transition-transform', !isCollapsed && 'rotate-180')}
            aria-hidden="true"
          />
        </span>
      </button>
      {!isCollapsed && children}
    </div>
  );
}
