import type { ReactNode } from 'react';
import { ResourceCardThumbnail } from './thumbnail';

/** Shared visual shell; resource protocols and authorization stay with their callers. */
export function ResourceCardLayout({
  title,
  icon,
  description,
  action,
  children,
  compact = false,
  preview,
}: {
  title: string;
  icon: ReactNode;
  description?: ReactNode;
  action: ReactNode;
  children?: ReactNode;
  /** A single delivered file keeps its navigation and download in the header. */
  compact?: boolean;
  preview?: ReactNode;
}) {
  return (
    <div
      className="@container/resource-card min-w-0 rounded-chat-panel border border-border bg-card p-[var(--density-padding,1rem)] text-card-foreground"
      data-testid="resource-card"
    >
      <div className="flex items-center gap-[var(--density-gap,0.5rem)]">
        {preview ??
          (compact ? (
            <ResourceCardThumbnail>{icon}</ResourceCardThumbnail>
          ) : (
            <div className="shrink-0" aria-hidden="true">
              {icon}
            </div>
          ))}
        <div className="min-w-0 flex-1">
          <div
            className={
              compact
                ? 'truncate font-medium'
                : 'line-clamp-2 [overflow-wrap:anywhere] font-medium'
            }
            title={title}
          >
            {title}
          </div>
          {description && (
            <div
              className={
                compact
                  ? 'mt-1 truncate text-sm text-muted-foreground'
                  : 'mt-1 whitespace-pre-line [overflow-wrap:anywhere] text-sm text-muted-foreground'
              }
            >
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
