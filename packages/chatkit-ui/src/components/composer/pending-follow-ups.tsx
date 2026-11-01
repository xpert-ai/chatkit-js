import * as React from 'react';
import {
  CornerDownRight,
  FileText,
  ImageIcon,
  ListEnd,
  Ellipsis,
  PencilLine,
  Trash2,
} from 'lucide-react';

import { getReferenceLabel, normalizeReferences } from '../../lib/references';
import { cn } from '../../lib/utils';
import type { PendingFollowUp } from '../../lib/follow-ups';
import { useChatkitTranslation } from '../../i18n/useChatkitTranslation';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip';

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

const actionClassName =
  'inline-flex h-[max(1.75rem,calc(2rem*var(--chat-density-scale,1)))] shrink-0 items-center justify-center gap-1.5 rounded-chat-item text-sm text-muted-foreground transition-colors hover:bg-foreground/10 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 pointer-coarse:min-h-11 [&>svg]:size-4 [&>svg]:shrink-0';
const iconActionClassName = cn(
  actionClassName,
  'aspect-square p-0 pointer-coarse:min-w-11',
);

function PendingFollowUpPreview({ item }: { item: PendingFollowUp }) {
  const image = normalizeReferences(item.request.input.references).find(
    (reference) => reference.type === 'image',
  );
  const file = item.request.input.files?.[0];
  const fileName = file
    ? ('originalName' in file && file.originalName) || file.name
    : undefined;
  const label = image ? getReferenceLabel(image) : fileName;
  const fileMime = file && (('mimeType' in file && file.mimeType) || file.type);
  const thumbnail =
    image?.url ||
    (file &&
      (('thumbUrl' in file && file.thumbUrl) ||
        (fileMime?.startsWith('image/') &&
          (('fileUrl' in file && file.fileUrl) ||
            ('url' in file && file.url)))));
  const [failedUrl, setFailedUrl] = React.useState<string | null>(null);
  if (!image && !file) return null;

  return (
    <span
      className="flex size-[max(1.75rem,calc(2rem*var(--chat-density-scale,1)))] shrink-0 items-center justify-center overflow-hidden rounded-chat-item bg-muted text-muted-foreground"
      title={label}
    >
      {thumbnail && failedUrl !== thumbnail ? (
        <img
          src={thumbnail}
          alt={label ?? ''}
          className="size-full object-cover"
          onError={() => setFailedUrl(thumbnail)}
        />
      ) : image ? (
        <ImageIcon className="size-4" aria-hidden="true" />
      ) : (
        <FileText className="size-4" aria-hidden="true" />
      )}
    </span>
  );
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
      role="region"
      aria-label={t('chat.followUps.pending')}
      data-slot="pending-follow-ups"
      className={cn(
        'mx-[calc(0.75rem*var(--chat-density-scale,1))] min-w-0 rounded-chat-panel border border-border/70 bg-background px-[calc(0.75rem*var(--chat-density-scale,1))] py-[calc(0.375rem*var(--chat-density-scale,1))]',
        attachToComposer && 'rounded-b-none border-b-0',
        className,
      )}
    >
      <ul className="max-h-40 overflow-y-auto divide-y divide-border/50">
        {items.map((item) => {
          const canSendItemNow = item.mode === 'queue' && canSendNow(item.id);
          const text = getPendingFollowUpText(item, referencedContentFallback);
          const hint =
            item.mode === 'queue'
              ? canSendItemNow
                ? t('chat.followUps.manualQueueHint')
                : t('chat.followUps.queueHint')
              : t('chat.followUps.steerHint');

          return (
            <li
              key={item.id}
              className="flex min-w-0 items-center gap-[calc(0.5rem*var(--chat-density-scale,1))] py-[calc(0.25rem*var(--chat-density-scale,1))]"
            >
              <Tooltip>
                <TooltipTrigger asChild>
                  <span
                    tabIndex={0}
                    aria-label={hint}
                    className="flex size-5 shrink-0 items-center justify-center rounded-chat-item text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <ListEnd className="size-4" aria-hidden="true" />
                  </span>
                </TooltipTrigger>
                <TooltipContent side="top">{hint}</TooltipContent>
              </Tooltip>
              <PendingFollowUpPreview item={item} />
              <span
                className="min-w-0 flex-1 truncate text-sm text-foreground"
                title={text}
              >
                {text}
              </span>
              <div className="flex shrink-0 items-center gap-[calc(0.25rem*var(--chat-density-scale,1))]">
                {item.mode === 'queue' &&
                  isLoading &&
                  !item.queuedFromSteer && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          onClick={() => void onPromoteToSteer(item.id)}
                          className={cn(
                            actionClassName,
                            'bg-muted px-[calc(0.75rem*var(--chat-density-scale,1))]',
                          )}
                          aria-label={t('chat.followUps.steerAction')}
                        >
                          <CornerDownRight aria-hidden="true" />
                          {t('chat.followUps.steerAction')}
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="top">
                        {t('chat.followUps.steerActionHint')}
                      </TooltipContent>
                    </Tooltip>
                  )}
                {canSendItemNow && (
                  <button
                    type="button"
                    onClick={() => void onSendNow(item.id)}
                    className={cn(
                      actionClassName,
                      'bg-muted px-[calc(0.75rem*var(--chat-density-scale,1))]',
                    )}
                    aria-label={t('chat.followUps.sendNow')}
                    title={t('chat.followUps.sendNow')}
                  >
                    <CornerDownRight aria-hidden="true" />
                    {t('chat.followUps.sendNow')}
                  </button>
                )}
                {item.mode === 'queue' && (
                  <>
                    <button
                      type="button"
                      onClick={() => onRemove(item.id)}
                      className={iconActionClassName}
                      aria-label={t('chat.followUps.remove')}
                      title={t('chat.followUps.remove')}
                    >
                      <Trash2 aria-hidden="true" />
                    </button>
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
                            iconActionClassName,
                            'data-[state=open]:bg-muted data-[state=open]:text-foreground',
                          )}
                          aria-label={t('chat.followUps.more')}
                          title={t('chat.followUps.more')}
                        >
                          <Ellipsis aria-hidden="true" />
                        </button>
                      </PopoverTrigger>
                      <PopoverContent
                        align="end"
                        side="bottom"
                        className="w-56 max-w-[calc(100vw-2rem)] border-border/70 p-[calc(0.375rem*var(--chat-density-scale,1))]"
                      >
                        <button
                          type="button"
                          onClick={() => {
                            setOpenMenuId(null);
                            onEdit(item.id);
                          }}
                          className="flex w-full items-center gap-[calc(0.5rem*var(--chat-density-scale,1))] rounded-chat-item px-[calc(0.75rem*var(--chat-density-scale,1))] py-[calc(0.5rem*var(--chat-density-scale,1))] text-left text-sm transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          <PencilLine
                            className="size-4 shrink-0"
                            aria-hidden="true"
                          />
                          <span>{t('chat.followUps.edit')}</span>
                        </button>
                      </PopoverContent>
                    </Popover>
                  </>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
