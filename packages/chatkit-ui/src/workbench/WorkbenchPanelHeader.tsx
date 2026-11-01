import type { ReactNode } from 'react';
import { Maximize2, Minimize2, PanelRight, Plus } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '../components/ui/tooltip';
import { useChatkitTranslation } from '../i18n/useChatkitTranslation';
import { cn } from '../lib/utils';
import { ToolbarButton } from '../components/ui/toolbar-button';

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
            <ToolbarButton
              type="button"
              onClick={onNewTab}
              aria-label={t('workbench.newTab')}
            >
              <Plus aria-hidden="true" />
            </ToolbarButton>
          </TooltipTrigger>
          <TooltipContent side="bottom">{t('workbench.newTab')}</TooltipContent>
        </Tooltip>
      )}
      <div className="ml-auto flex shrink-0 items-center gap-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <ToolbarButton
              type="button"
              onClick={onToggleExpanded}
              className={cn(expanded && 'bg-muted text-foreground')}
              aria-label={
                expanded
                  ? t('workbench.restorePanel')
                  : t('workbench.expandPanel')
              }
              aria-pressed={expanded}
            >
              {expanded ? <Minimize2 /> : <Maximize2 />}
            </ToolbarButton>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            {expanded
              ? t('workbench.restorePanel')
              : t('workbench.expandPanel')}
          </TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <ToolbarButton
              type="button"
              onClick={onClose}
              className="bg-muted text-foreground hover:bg-muted/80"
              aria-label={t('workbench.toggleSidebar')}
              aria-pressed={true}
            >
              <PanelRight />
            </ToolbarButton>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            {t('workbench.toggleSidebar')}
          </TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}
