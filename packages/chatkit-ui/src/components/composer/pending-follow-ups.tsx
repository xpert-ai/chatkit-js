import * as React from 'react';
import {
  CornerDownLeft,
  Ellipsis,
  Info,
  PencilLine,
  Trash2,
} from 'lucide-react';

import { getReferenceLabel, normalizeReferences } from '../../lib/references';
import { cn, getRoundedClass } from '../../lib/utils';
import { useTheme } from '../../providers/Theme';
import type { PendingFollowUp } from '../../lib/follow-ups';
import { useChatkitTranslation } from '../../i18n/useChatkitTranslation';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';

export type PendingFollowUpsProps = {
  items: PendingFollowUp[];
  isLoading: boolean;
  onPromoteToSteer: (id: string) => void | Promise<void>;
  canSendNow: (id: string) => boolean;
  onSendNow: (id: string) => void | Promise<void>;
  onEdit: (id: string) => void;
  onRemove: (id: string) => void;
  attachToComposer?: boolean;
  className?: string;
};

function getPendingFollowUpText(
  item: PendingFollowUp,
  referencedContentFallback: string,
): string {
  const text = item.request?.input?.input?.trim() ?? '';
  if (text) {
    return text;
  }

  const references = normalizeReferences(item.request?.input?.references);
  if (references.length === 0) {
    return referencedContentFallback;
  }

  const firstReferenceLabel = getReferenceLabel(references[0]);
  if (references.length === 1) {
    return firstReferenceLabel;
  }

  return `${firstReferenceLabel} +${references.length - 1}`;
}

function useRoundedClasses() {
  const { theme } = useTheme();

  return {
    top: theme.radius
      ? {
          pill: 'rounded-t-full',
          round: 'rounded-t-xl',
          soft: 'rounded-t-lg',
          sharp: 'rounded-t-none',
        }[theme.radius]
      : 'rounded-t-lg',
    panel: getRoundedClass(theme.radius, 'rounded-lg'),
    control: getRoundedClass(theme.radius, 'rounded-md'),
  };
}

export function PendingFollowUps({
  items,
  isLoading,
  onPromoteToSteer,
  canSendNow,
  onSendNow,
  onEdit,
  onRemove,
  attachToComposer = true,
  className,
}: PendingFollowUpsProps) {
  const { t } = useChatkitTranslation();
  const rounded = useRoundedClasses();
  const referencedContentFallback = t('chat.referencedContentOnly');

  const [openMenuId, setOpenMenuId] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (items.every((item) => item.id !== openMenuId)) {
      setOpenMenuId(null);
    }
  }, [items, openMenuId]);

  if (items.length === 0) {
    return null;
  }

  return (
    <div
      className={cn(
        'space-y-2 mx-2 p-2 border border-border',
        attachToComposer ? 'border-b-0' : null,
        attachToComposer ? rounded.top : rounded.panel,
        className,
      )}
    >
      <div className="space-y-1">
        <div className="flex items-center justify-between gap-3">
          <div className="text-xs font-medium text-foreground">
            {t('chat.followUps.pending')}
          </div>
        </div>

        {items.map((item) => {
          const canSendItemNow = item.mode === 'queue' && canSendNow(item.id);

          return (
            <div
              key={item.id}
              className={cn(
                'border border-border/50 bg-muted/15 px-2 py-1',
                rounded.panel,
              )}
            >
              <div className="flex items-start gap-2.5">
                <CornerDownLeft className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <div
                        className="truncate text-[13px] leading-5 text-foreground"
                        title={getPendingFollowUpText(
                          item,
                          referencedContentFallback,
                        )}
                      >
                        {getPendingFollowUpText(
                          item,
                          referencedContentFallback,
                        )}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      {item.mode === 'queue' &&
                        isLoading &&
                        !item.queuedFromSteer && (
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
                          onOpenChange={(open) =>
                            setOpenMenuId(open ? item.id : null)
                          }
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
                            className={cn(
                              'w-52 border-border/70 bg-background p-1.5',
                              rounded.panel,
                            )}
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
