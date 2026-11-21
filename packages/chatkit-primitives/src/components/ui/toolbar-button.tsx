import { forwardRef, type ComponentProps } from 'react';
import { Button } from './button';
import { cn } from '../../lib/utils';

/** Keep floating toolbar controls proportional to the active chat density. */
export const ToolbarButton = forwardRef<
  HTMLButtonElement,
  ComponentProps<typeof Button> & { iconOnly?: boolean }
>(function ToolbarButton({ iconOnly = true, className, ...props }, ref) {
  return (
    <Button
      ref={ref}
      type="button"
      variant="ghost"
      size={iconOnly ? 'icon' : 'default'}
      {...props}
      className={cn(
        'h-[max(2rem,calc(2.25rem*var(--chat-density-scale,1)))] cursor-pointer rounded-chat-item text-muted-foreground hover:text-foreground',
        "gap-[calc(0.5rem*var(--chat-density-scale,1))] [&_svg:not([class*='size-'])]:size-[max(1rem,calc(1.25rem*var(--chat-density-scale,1)))]",
        'pointer-coarse:min-h-11 pointer-coarse:min-w-11',
        iconOnly
          ? 'w-[max(2rem,calc(2.25rem*var(--chat-density-scale,1)))] p-0'
          : 'px-[calc(0.75rem*var(--chat-density-scale,1))]',
        className,
      )}
    />
  );
});
