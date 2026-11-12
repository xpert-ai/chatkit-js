import type { ReactNode } from 'react';

/** Shared visual shell; resource protocols and authorization stay with their callers. */
export function ResourceCardLayout({
  title,
  icon,
  description,
  action,
  children,
}: {
  title: string;
  icon: ReactNode;
  description?: ReactNode;
  action: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div
      className="min-w-0 rounded-chat-panel border border-border bg-card text-card-foreground p-[var(--density-padding,1rem)]"
      data-testid="resource-card"
    >
      <div className="flex items-center gap-[var(--density-gap,0.5rem)]">
        <div className="shrink-0" aria-hidden="true">
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <div
            className="line-clamp-2 [overflow-wrap:anywhere] font-medium"
            title={title}
          >
            {title}
          </div>
          {description && (
            <div className="mt-1 whitespace-pre-line [overflow-wrap:anywhere] text-sm text-muted-foreground">
              {description}
            </div>
          )}
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}
