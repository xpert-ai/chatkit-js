import type { ReactNode } from 'react';
import { Maximize2, Minimize2, PanelRight, Plus } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '../components/ui/tooltip';
import { useChatkitTranslation } from '../i18n/useChatkitTranslation';
import { cn } from '../lib/utils';

export function WorkbenchPanelHeader({
  children,
  expanded,
  onToggleExpanded,
  onClose,
  onNewTab,
}: {
  children: ReactNode;
  expanded: boolean;
  onToggleExpanded: () => void;
  onClose: () => void;
  onNewTab?: () => void;
}) {
  const { t } = useChatkitTranslation();
  return (
    <div
      data-slot="chatkit-workbench-header"
      className="flex min-h-14 shrink-0 items-center gap-2 px-2.5 py-2"
    >
      {children}
      {onNewTab && (
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={onNewTab}
              aria-label={t('workbench.newTab')}
              className="flex size-8 shrink-0 items-center justify-center rounded-[var(--chat-item-radius)] text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Plus size={18} aria-hidden="true" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom">{t('workbench.newTab')}</TooltipContent>
        </Tooltip>
      )}
      <div className="ml-auto flex shrink-0 items-center gap-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={onToggleExpanded}
              className={cn(
                'flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors',
                'hover:bg-muted hover:text-foreground',
                expanded && 'bg-muted text-foreground',
              )}
              aria-label={
                expanded
                  ? t('workbench.restorePanel')
                  : t('workbench.expandPanel')
              }
              aria-pressed={expanded}
            >
              {expanded ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            {expanded
              ? t('workbench.restorePanel')
              : t('workbench.expandPanel')}
          </TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted text-foreground transition-colors hover:bg-muted/80"
              aria-label={t('workbench.toggleSidebar')}
              aria-pressed={true}
            >
              <PanelRight size={17} />
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            {t('workbench.toggleSidebar')}
          </TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}
