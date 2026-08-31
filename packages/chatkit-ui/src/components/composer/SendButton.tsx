import { ArrowUp, Square } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip';

export type SendButtonShortcut = {
  label: string;
  keys: string;
};

export type SendButtonProps = {
  disabled?: boolean;
  isLoading?: boolean;
  showStop?: boolean;
  onStop?: () => void;
  stopLabel?: string;
  sendLabel?: string;
  shortcuts?: SendButtonShortcut[];
};

export function SendButton({
  disabled = false,
  isLoading = false,
  showStop = isLoading,
  onStop,
  stopLabel = 'Stop',
  sendLabel = 'Send',
  shortcuts,
}: SendButtonProps) {
  if (showStop) {
    return (
      <button
        type="button"
        onClick={onStop}
        className={cn(
          'flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-full',
          'bg-foreground text-background',
          'transition-transform duration-150 ease-out',
          'hover:scale-105 active:scale-95',
        )}
        aria-label={stopLabel}
      >
        <Square
          size={14}
          fill="currentColor"
          stroke="currentColor"
          strokeWidth={0}
        />
      </button>
    );
  }

  const button = (
    <button
      type="submit"
      disabled={disabled}
      className={cn(
        'flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-full',
        'bg-foreground text-background',
        'transition-all duration-150 ease-out',
        'hover:scale-105 active:scale-95',
        'disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100',
      )}
      aria-label={sendLabel}
    >
      <ArrowUp size={17} strokeWidth={2.5} />
    </button>
  );

  if (!shortcuts?.length || disabled) {
    return button;
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>{button}</TooltipTrigger>
      <TooltipContent
        side="top"
        sideOffset={10}
        hideArrow
        className={cn(
          'min-w-36 border border-border/70 bg-background px-3 py-2 text-foreground shadow-lg',
          'rounded-lg',
        )}
      >
        <div className="space-y-1">
          {shortcuts.map((shortcut) => (
            <div
              key={`${shortcut.label}-${shortcut.keys}`}
              className="flex items-center justify-between gap-4 text-sm"
            >
              <span className="font-medium">{shortcut.label}</span>
              <kbd className="inline-flex min-w-16 items-center justify-center rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                {shortcut.keys}
              </kbd>
            </div>
          ))}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

export default SendButton;
