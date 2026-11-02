import type { CSSProperties, ReactNode, Ref } from 'react';
import { cn } from '../../../lib/utils';
import { SquarePen } from 'lucide-react';
import { ToolbarButton } from '../../ui/toolbar-button';
import { Tooltip, TooltipContent, TooltipTrigger } from '../../ui/tooltip';

export type ChatHeaderProps = {
  visible?: boolean;
  columnRef?: Ref<HTMLDivElement>;
  style?: CSSProperties;
  characterPresentation?: boolean;
  showIdentity?: boolean;
  avatar: ReactNode;
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
  newThread?: { label: string; disabled?: boolean; onClick: () => void };
};

export function ChatHeader({
  visible = true,
  columnRef,
  style,
  characterPresentation = false,
  showIdentity = false,
  avatar,
  title,
  subtitle,
  actions,
  newThread,
}: ChatHeaderProps) {
  return (
    visible && (
      <div
        data-slot="chatkit-chat-header-container"
        className={cn(
          'pointer-events-none @container/chat-header sticky top-0 z-10 w-full min-w-0 shrink-0',
          characterPresentation && 'col-start-1 row-start-1 self-start',
        )}
      >
        {/* Summary docking measures the transcript column, not the full-width toolbar. */}
        <div
          ref={columnRef}
          data-slot="chatkit-chat-column-anchor"
          aria-hidden="true"
          className="absolute inset-x-0 top-0 mx-auto h-0 w-full"
          style={style}
        />
        <div
          data-slot="chatkit-chat-header"
          className="mx-auto flex w-full min-w-0 items-center justify-between gap-[calc(0.5rem*var(--chat-density-scale,1))] px-[calc(0.75rem*var(--chat-density-scale,1))] py-[calc(0.5rem*var(--chat-density-scale,1))]"
        >
          <div className="flex min-w-0 flex-1 items-center gap-[calc(0.75rem*var(--chat-density-scale,1))]">
            {newThread && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <ToolbarButton
                    className="pointer-events-auto"
                    aria-label={newThread.label}
                    disabled={newThread.disabled}
                    onClick={newThread.onClick}
                  >
                    <SquarePen />
                  </ToolbarButton>
                </TooltipTrigger>
                <TooltipContent side="bottom">{newThread.label}</TooltipContent>
              </Tooltip>
            )}
            {showIdentity && !characterPresentation && (
              <div
                data-slot="chatkit-header-identity"
                className="pointer-events-auto flex min-w-0 items-center gap-3 overflow-hidden"
              >
                {avatar}
                <div className="min-w-0">
                  <h2 className="text-lg font-semibold truncate" title={title}>
                    {title}
                  </h2>
                  {subtitle}
                </div>
              </div>
            )}
          </div>
          <div
            data-slot="chatkit-header-actions"
            className="pointer-events-auto flex shrink-0 items-center gap-[calc(0.25rem*var(--chat-density-scale,1))] rounded-chat-panel bg-background px-[calc(0.5rem*var(--chat-density-scale,1))] py-[calc(0.25rem*var(--chat-density-scale,1))] empty:hidden"
          >
            {actions}
          </div>
        </div>
      </div>
    )
  );
}
