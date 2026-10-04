import type * as React from 'react';
import { ArrowLeftRight } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '../components/ui/tooltip';
import { useChatkitTranslation } from '../i18n/useChatkitTranslation';
import { useTheme } from '../providers/Theme';
import { getSurfaceThemeStyle } from '../lib/theme-surfaces';
import type { WorkbenchLayout } from './layout-storage';
import {
  CHAT_MIN_WIDTH,
  WORKBENCH_MIN_WIDTH,
  clampPanelWidth,
} from './split-resize';

export function WorkbenchDivider({
  containerWidth,
  panelWidth,
  workbenchSide,
  resizing,
  onResizeStart,
  onPanelWidthChange,
  onExpand,
  onSwap,
}: {
  containerWidth: number;
  panelWidth: number;
  workbenchSide: WorkbenchLayout['workbenchSide'];
  resizing: boolean;
  onResizeStart: React.PointerEventHandler<HTMLDivElement>;
  onPanelWidthChange: (width: number) => void;
  onExpand: () => void;
  onSwap: () => void;
}) {
  const { t } = useChatkitTranslation();
  const { theme } = useTheme();
  return (
    <div className="group/divider relative z-20 w-[1px] shrink-0">
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label={t('workbench.resize')}
        tabIndex={0}
        aria-valuemin={CHAT_MIN_WIDTH}
        aria-valuemax={Math.max(
          CHAT_MIN_WIDTH,
          containerWidth - WORKBENCH_MIN_WIDTH,
        )}
        aria-valuenow={Math.round(containerWidth - panelWidth)}
        onPointerDown={onResizeStart}
        onKeyDown={(event) => {
          if (
            !['ArrowLeft', 'ArrowRight', 'Home', 'End', 'Enter'].includes(
              event.key,
            )
          )
            return;
          event.preventDefault();
          if (event.key === 'Enter') {
            onExpand();
            return;
          }
          const width =
            event.key === 'Home'
              ? containerWidth - CHAT_MIN_WIDTH
              : event.key === 'End'
                ? WORKBENCH_MIN_WIDTH
                : panelWidth +
                  (event.key === 'ArrowLeft' ? 16 : -16) *
                    (workbenchSide === 'left' ? -1 : 1);
          onPanelWidthChange(clampPanelWidth(width, containerWidth));
        }}
        className="absolute inset-0 cursor-col-resize touch-none bg-border outline-none transition-colors hover:bg-primary/50 focus-visible:bg-primary"
      >
        <div className="absolute inset-y-0 -left-1 -right-1" />
      </div>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label={t('workbench.swapPanes')}
            disabled={resizing}
            onClick={onSwap}
            style={getSurfaceThemeStyle(theme)}
            className="pointer-events-none absolute left-1/2 top-1/2 flex size-8 -translate-x-1/2 -translate-y-1/2 cursor-pointer items-center justify-center rounded-[var(--chat-item-radius,var(--radius))] border border-border bg-muted text-muted-foreground opacity-0 shadow-sm transition-[color,background-color,opacity] group-hover/divider:pointer-events-auto group-hover/divider:opacity-100 group-has-[:focus-visible]/divider:pointer-events-auto group-has-[:focus-visible]/divider:opacity-100 hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none"
          >
            <ArrowLeftRight size={16} aria-hidden="true" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" sideOffset={8}>
          {t('workbench.swapPanes')}
        </TooltipContent>
      </Tooltip>
    </div>
  );
}
