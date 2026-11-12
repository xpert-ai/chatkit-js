import * as React from 'react';
import {
  Bot,
  ChevronRight,
  Paperclip,
  Plug,
  Target,
  WandSparkles,
} from 'lucide-react';

import { useChatkitTranslation } from '../../i18n/useChatkitTranslation';
import { cn } from '../../lib/utils';
import { DropdownMenuItem, DropdownMenuSeparator } from '../ui/dropdown-menu';

export type ComposerPanel = 'targets' | 'experts' | 'skills' | 'connectors';
export type PanelActivation = 'hover' | 'select';

type PrimaryPanelProps = {
  activePanel: ComposerPanel | null;
  canPreview: boolean;
  onOpenPanel: (panel: ComposerPanel, activation: PanelActivation) => void;
  attachmentsEnabled: boolean;
  onAttachmentClick?: () => void;
  skillCount: number;
  expertCount: number;
  connectorCount: number;
  connectorsEnabled: boolean;
  unifiedResourcesEnabled: boolean;
};

export function ComposerMenuPrimaryPanel({
  activePanel,
  canPreview,
  onOpenPanel,
  attachmentsEnabled,
  onAttachmentClick,
  skillCount,
  expertCount,
  connectorCount,
  connectorsEnabled,
  unifiedResourcesEnabled,
}: PrimaryPanelProps) {
  const { t } = useChatkitTranslation();
  const previewTimer = React.useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const cancelPreview = React.useCallback(
    () => clearTimeout(previewTimer.current),
    [],
  );
  React.useLayoutEffect(
    () => cancelPreview,
    [canPreview, connectorsEnabled, unifiedResourcesEnabled, cancelPreview],
  );

  const categories = [
    {
      panel: 'targets',
      label: t('composer.workbuddy.targets'),
      Icon: Target,
      count: 0,
    },
    {
      panel: 'experts',
      label: t('composer.workbuddy.experts'),
      Icon: Bot,
      count: expertCount,
    },
    {
      panel: 'skills',
      label: t('composer.capabilities.skills'),
      Icon: WandSparkles,
      count: skillCount,
    },
    {
      panel: 'connectors',
      label: t('composer.workbuddy.connectors'),
      Icon: Plug,
      count: connectorCount,
    },
  ] as const;

  return (
    <div
      data-slot="composer-primary-panel"
      className={cn(
        'max-w-full shrink-0 overflow-hidden rounded-chat-panel bg-popover p-1 text-popover-foreground shadow-md ring-1 ring-foreground/10',
        canPreview ? 'w-44' : 'w-64',
      )}
    >
      <DropdownMenuItem
        disabled={!attachmentsEnabled}
        onSelect={onAttachmentClick}
        className="font-normal"
      >
        <Paperclip className="size-4 text-muted-foreground" />
        <span className="flex-1">{t('composer.addAttachment')}</span>
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      {categories.map(({ panel, label, Icon, count }) => {
        if (panel === 'connectors' && unifiedResourcesEnabled) return null;
        const disabled = panel === 'connectors' && !connectorsEnabled;
        const active = activePanel === panel;
        return (
          <DropdownMenuItem
            key={panel}
            disabled={disabled}
            aria-expanded={active}
            onPointerEnter={(event) => {
              if (
                event.pointerType !== 'mouse' ||
                !canPreview ||
                disabled ||
                active
              )
                return;
              // Allow the pointer to cross a neighboring row on its way into the panel.
              cancelPreview();
              previewTimer.current = setTimeout(
                () => onOpenPanel(panel, 'hover'),
                120,
              );
            }}
            onPointerLeave={cancelPreview}
            onSelect={(event) => {
              event.preventDefault();
              cancelPreview();
              onOpenPanel(panel, 'select');
            }}
            className={cn('font-normal', active && 'bg-muted')}
          >
            <Icon className="size-4 text-muted-foreground" />
            <span className="min-w-0 flex-1">{label}</span>
            {count > 0 && (
              <span className="rounded-chat-item bg-muted px-1.5 text-xs tabular-nums text-muted-foreground">
                {count}
              </span>
            )}
            <ChevronRight className="size-3.5 text-muted-foreground" />
          </DropdownMenuItem>
        );
      })}
    </div>
  );
}
