import type { ReactNode, Ref } from 'react';

/** Shared file thumbnail surface, for both authorized covers and declared file icons. */
export function ResourceCardThumbnail({
  children,
  containerRef,
  action,
}: {
  children: ReactNode;
  containerRef?: Ref<HTMLDivElement>;
  action?: {
    onClick: () => void;
    disabled: boolean;
    label: string;
    title: string;
  };
}) {
  const surface =
    'absolute inset-0 flex size-full -rotate-6 items-center justify-center overflow-hidden rounded-chat-item border border-border bg-background p-1 shadow-sm';
  return (
    <div
      ref={containerRef}
      // Reserve the full thumbnail height; the card padding contains its rotation.
      className="relative aspect-square shrink-0 w-[calc(clamp(2.75rem,calc(3.5rem*var(--density-spacing,1)),3.5rem)*1.45)]"
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
