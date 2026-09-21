import { Filter, FilterX } from 'lucide-react';
import { cn } from '../../lib/utils';

/** Keep filtering and clearing on the same fixed-size target, including keyboard focus. */
export function ProjectFilterButton({
  active,
  label,
  onClick,
  className,
  expanded,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
  className?: string;
  expanded?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-expanded={expanded}
      data-filter-active={active}
      className={cn(
        'group/filter relative inline-flex size-6 shrink-0 items-center justify-center rounded text-muted-foreground outline-none hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring',
        className,
      )}
      onClick={onClick}
    >
      <Filter
        aria-hidden="true"
        className={cn(
          'size-4',
          active &&
            'group-hover/filter:opacity-0 group-focus-visible/filter:opacity-0',
        )}
      />
      {active ? (
        <FilterX
          aria-hidden="true"
          className="absolute size-4 opacity-0 group-hover/filter:opacity-100 group-focus-visible/filter:opacity-100"
        />
      ) : null}
    </button>
  );
}
