import type { ReactNode } from 'react';
import { X } from 'lucide-react';
import { cn } from '../lib/utils';

export function WorkbenchTab({
  label,
  icon,
  selected,
  id,
  panelId,
  onSelect,
  close,
  children,
}: {
  label: string;
  icon: ReactNode;
  selected: boolean;
  id?: string;
  panelId?: string;
  onSelect: () => void;
  close?: { label: string; onClick: () => void };
  children?: ReactNode;
}) {
  return (
    <div
      data-slot="workbench-tab"
      className={cn(
        'flex h-9 max-w-64 shrink-0 items-center rounded-[var(--chat-item-radius)] transition-colors',
        selected
          ? 'bg-muted text-foreground'
          : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
      )}
    >
      <button
        type="button"
        role="tab"
        id={id}
        aria-controls={panelId}
        aria-selected={selected}
        title={label}
        onClick={onSelect}
        className="flex h-full min-w-0 items-center gap-2 rounded-[var(--chat-item-radius)] px-3 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
      >
        <span
          className="flex size-4 shrink-0 items-center justify-center"
          aria-hidden="true"
        >
          {icon}
        </span>
        <span className="truncate">{label}</span>
        {children}
      </button>
      {close && (
        <button
          type="button"
          onClick={close.onClick}
          aria-label={close.label}
          className="mr-1 flex size-6 shrink-0 items-center justify-center rounded-[var(--chat-item-radius)] text-muted-foreground transition-colors hover:bg-background/80 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
        >
          <X size={14} aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
