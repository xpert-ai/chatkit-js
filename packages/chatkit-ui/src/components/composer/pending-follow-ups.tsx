import * as React from 'react';
import {
  CornerDownLeft,
  Ellipsis,
  Info,
  PencilLine,
  SlidersHorizontal,
  Trash2,
} from 'lucide-react';

import type { FollowUpBehavior } from '@xpert-ai/chatkit-types';

import { cn, getRoundedClass } from '../../lib/utils';
import { useTheme } from '../../providers/Theme';
import type { PendingFollowUp } from '../../lib/follow-ups';
import { useChatkitTranslation } from '../../i18n/useChatkitTranslation';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip';

export type PendingFollowUpsProps = {
  items: PendingFollowUp[];
  isLoading: boolean;
  followUpBehavior: FollowUpBehavior;
  onBehaviorChange: (behavior: FollowUpBehavior) => void;
  onPromoteToSteer: (id: string) => void | Promise<void>;
  canSendNow: (id: string) => boolean;
  onSendNow: (id: string) => void | Promise<void>;
  onEdit: (id: string) => void;
  onRemove: (id: string) => void;
  className?: string;
};

function getPendingFollowUpText(item: PendingFollowUp): string {
  return item.request?.input?.input?.trim() ?? '';
}

function useRoundedClasses() {
  const { theme } = useTheme();

  return {
    top: theme.radius ? ({
      pill: 'rounded-t-full',
      round: 'rounded-t-xl',
      soft: 'rounded-t-lg',
      sharp: 'rounded-t-none',
    })[theme.radius] : 'rounded-t-lg',
    panel: getRoundedClass(theme.radius, 'rounded-lg'),
    control: getRoundedClass(theme.radius, 'rounded-md'),
  };
}

export function PendingFollowUps({
  items,
  isLoading,
  followUpBehavior,
  onBehaviorChange,
  onPromoteToSteer,
  canSendNow,
  onSendNow,
  onEdit,
  onRemove,
  className,
}: PendingFollowUpsProps) {
  const { t } = useChatkitTranslation();
  const rounded = useRoundedClasses();

  const [isSettingsOpen, setIsSettingsOpen] = React.useState(false);
  const [openMenuId, setOpenMenuId] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (items.length === 0 && isSettingsOpen) {
      setIsSettingsOpen(false);
    }
    if (items.every((item) => item.id !== openMenuId)) {
      setOpenMenuId(null);
    }
  }, [isSettingsOpen, items, openMenuId]);

  if (items.length === 0) {
    return null;
  }

  return (
    <div className={cn('space-y-2 mx-2 p-2 border border-border border-b-0', rounded.top, className)}>
      <div className="space-y-1">
        <div className="flex items-center justify-between gap-3">
          <div className="text-xs font-medium text-foreground">
            {t('chat.followUps.pending')}
          </div>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() => setIsSettingsOpen((prev) => !prev)}
                className={cn(
                  'inline-flex h-6 w-6 items-center justify-center transition-colors',
                  isSettingsOpen
                    ? 'bg-muted text-foreground'
                    : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
                  rounded.control,
                )}
                aria-label={t('chat.followUps.settings')}
                aria-expanded={isSettingsOpen}
                aria-controls="follow-ups-settings-panel"
              >
                <SlidersHorizontal className="h-3.5 w-3.5" />
                <span className="sr-only">{t('chat.followUps.settings')}</span>
              </button>
            </TooltipTrigger>
            <TooltipContent side="top">{t('chat.followUps.settings')}</TooltipContent>
          </Tooltip>
        </div>

        {isSettingsOpen && (
          <div id="follow-ups-settings-panel" className={cn('border border-border/70 bg-muted/20 px-3 py-2', rounded.panel)}>
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-xs font-medium text-foreground">
                  {t('chat.followUps.label')}
                </div>
                <div className="text-[11px] text-muted-foreground">
                  {isLoading
                    ? t('chat.followUps.activeHint')
                    : t('chat.followUps.idleHint')}
                </div>
              </div>
              <div className={cn('inline-flex shrink-0 border border-border bg-background p-1', rounded.control)}>
                {(['queue', 'steer'] as FollowUpBehavior[]).map((behavior) => (
                  <Tooltip key={behavior}>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        onClick={() => {
                          onBehaviorChange(behavior);
                          setIsSettingsOpen(false);
                        }}
                        className={cn(
                          'px-3 py-1 text-xs font-medium transition-colors',
                          rounded.control,
                          followUpBehavior === behavior
                            ? 'bg-primary text-background'
                            : 'text-muted-foreground hover:text-foreground',
                        )}
                      >
                        {behavior === 'queue'
                          ? t('chat.followUps.queue')
                          : t('chat.followUps.steer')}
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="top">
                      {behavior === 'queue'
                        ? t('chat.followUps.queueHint')
                        : t('chat.followUps.steerHint')}
                    </TooltipContent>
                  </Tooltip>
                ))}
              </div>
            </div>
          </div>
        )}

        {items.map((item) => {
          const canSendItemNow = item.mode === 'queue' && canSendNow(item.id);

          return (
            <div
              key={item.id}
              className={cn('border border-border/50 bg-muted/15 px-2 py-1', rounded.panel)}
            >
              <div className="flex items-start gap-2.5">
                <CornerDownLeft className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13px] leading-5 text-foreground" title={getPendingFollowUpText(item)}>
                        {getPendingFollowUpText(item)}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      {item.mode === 'queue' && isLoading && (
                        <button
                          type="button"
                          onClick={() => void onPromoteToSteer(item.id)}
                          className={cn(
                            'inline-flex h-6 items-center border border-primary/20 bg-primary/5 px-2 text-[11px] font-medium text-primary transition-colors hover:bg-primary/10',
                            rounded.control,
                          )}
                          aria-label={t('chat.followUps.steerAction')}
                          title={t('chat.followUps.steerAction')}
                        >
                          {t('chat.followUps.steerAction')}
                        </button>
                      )}
                      {canSendItemNow && (
                        <button
                          type="button"
                          onClick={() => void onSendNow(item.id)}
                          className={cn(
                            'inline-flex h-6 items-center border border-primary/20 bg-primary/5 px-2 text-[11px] font-medium text-primary transition-colors hover:bg-primary/10',
                            rounded.control,
                          )}
                          aria-label={t('chat.followUps.sendNow')}
                          title={t('chat.followUps.sendNow')}
                        >
                          {t('chat.followUps.sendNow')}
                        </button>
                      )}
                      {item.mode === 'queue' && (
                        <button
                          type="button"
                          onClick={() => onRemove(item.id)}
                          className={cn(
                            'inline-flex h-6 w-6 shrink-0 items-center justify-center text-muted-foreground transition-colors hover:bg-muted hover:text-foreground',
                            rounded.control,
                          )}
                          aria-label={t('chat.followUps.remove')}
                          title={t('chat.followUps.remove')}
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                      {item.mode === 'queue' && (
                        <Popover
                          open={openMenuId === item.id}
                          onOpenChange={(open) => setOpenMenuId(open ? item.id : null)}
                        >
                          <PopoverTrigger asChild>
                            <button
                              type="button"
                              className={cn(
                                'inline-flex h-6 w-6 shrink-0 items-center justify-center text-muted-foreground transition-colors hover:bg-muted hover:text-foreground',
                                rounded.control,
                              )}
                              aria-label={t('chat.followUps.more')}
                              title={t('chat.followUps.more')}
                            >
                              <Ellipsis size={13} />
                            </button>
                          </PopoverTrigger>
                          <PopoverContent
                            align="end"
                            side="bottom"
                            className={cn('w-52 border-border/70 bg-background p-1.5', rounded.panel)}
                          >
                            <div className="flex flex-col gap-1">
                              <button
                                type="button"
                                onClick={() => {
                                  setOpenMenuId(null);
                                  onEdit(item.id);
                                }}
                                className={cn(
                                  'flex items-center gap-2 px-2 py-1.5 text-left text-sm text-foreground transition-colors hover:bg-muted',
                                  rounded.control,
                                )}
                              >
                                <PencilLine className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                                <span>{t('chat.followUps.edit')}</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setOpenMenuId(null);
                                  onBehaviorChange('steer');
                                }}
                                className={cn(
                                  'flex items-center gap-2 px-2 py-1.5 text-left text-sm text-foreground transition-colors hover:bg-muted',
                                  rounded.control,
                                )}
                              >
                                <CornerDownLeft className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                                <span>{t('chat.followUps.turnOffQueueing')}</span>
                              </button>
                            </div>
                          </PopoverContent>
                        </Popover>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 text-[10px] leading-4 text-muted-foreground">
                    <Info className="h-3 w-3 shrink-0" />
                    <span className="truncate">
                      {item.mode === 'queue'
                        ? canSendItemNow
                          ? t('chat.followUps.manualQueueHint')
                          : t('chat.followUps.queueHint')
                        : t('chat.followUps.steerHint')}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
