import * as React from 'react';
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from '../../components/ui/tooltip';

export const ReviewIconButton = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & {
    label: string;
    className?: string;
  }
>(function ReviewIconButton(
  { label, children, className = '', ...props },
  ref,
) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          ref={ref}
          type="button"
          aria-label={label}
          className={`review-icon-button ${className}`}
          {...props}
        >
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom" sideOffset={8}>
        {label}
      </TooltipContent>
    </Tooltip>
  );
});
export function ReviewStats({
  added,
  removed,
}: {
  added: number;
  removed: number;
}) {
  return (
    <span className="chatkit-change-line-stats review-stats">
      <span data-lines-added={added}>+{added}</span>
      <span data-lines-removed={removed}>−{removed}</span>
    </span>
  );
}
