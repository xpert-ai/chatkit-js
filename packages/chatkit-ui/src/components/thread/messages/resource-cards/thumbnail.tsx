import type { ReactNode, Ref } from 'react';

/** Shared file thumbnail surface, for both authorized covers and declared file icons. */
export function ResourceCardThumbnail({
  children,
  containerRef,
  reserveIconSpace = false,
  action,
}: {
  children: ReactNode;
  containerRef?: Ref<HTMLDivElement>;
  /** Preserve the existing row height of cards that have no cover image. */
  reserveIconSpace?: boolean;
  action?: {
    onClick: () => void;
    disabled: boolean;
    label: string;
    title: string;
  };
}) {
  const surface =
    'absolute -left-[8%] top-[10%] flex aspect-square w-full origin-top -rotate-6 items-center justify-center overflow-hidden rounded-chat-item border border-border bg-background p-1 shadow-sm';
  return (
    <div
      ref={containerRef}
      className={`relative shrink-0 w-[calc(clamp(2.75rem,calc(3.5rem*var(--density-spacing,1)),3.5rem)*1.45)] ${reserveIconSpace ? 'h-[max(2.75rem,calc(3rem*var(--density-spacing,1)))]' : 'h-[clamp(2.75rem,calc(3.5rem*var(--density-spacing,1)),3.5rem)]'}`}
    >
      {action ? (
        <button
          type="button"
          onClick={action.onClick}
          disabled={action.disabled}
          aria-label={action.label}
          title={action.title}
          className={`${surface} transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default`}
        >
          {children}
        </button>
      ) : (
        <div className={`${surface} text-muted-foreground`} aria-hidden="true">
          {children}
        </div>
      )}
    </div>
  );
}
