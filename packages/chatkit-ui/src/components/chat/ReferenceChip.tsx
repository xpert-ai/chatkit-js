import type { ChatKitReference } from '@xpert-ai/chatkit-types';
import { FileText, ImageIcon, Quote, X } from 'lucide-react';
import { cn } from '../../lib/utils';
import {
  getReferenceLabel,
  getReferenceMetaLine,
  getReferenceTitle,
} from '../../lib/references';

export function ReferenceChip({
  reference,
  variant,
  onRemove,
  removeLabel,
}: {
  reference: ChatKitReference;
  variant: 'composer' | 'message';
  onRemove?: () => void;
  removeLabel?: string;
}) {
  const metaLine = getReferenceMetaLine(reference);
  const isComposer = variant === 'composer';
  const Icon =
    reference.type === 'quote'
      ? Quote
      : reference.type === 'image'
        ? ImageIcon
        : FileText;

  return (
    <div
      className={cn(
        'flex items-start gap-2 rounded-md px-2 py-1',
        isComposer ? 'bg-muted text-foreground' : 'bg-primary-foreground/20',
      )}
      title={getReferenceTitle(reference)}
    >
      <Icon
        size={isComposer ? 14 : 12}
        className={cn(
          'mt-0.5 shrink-0',
          isComposer ? 'text-muted-foreground' : 'text-primary-foreground/80',
        )}
      />
      <div className="min-w-0 flex-1">
        <div
          className={cn(
            'truncate whitespace-pre-wrap',
            isComposer ? 'text-sm' : 'text-xs font-medium',
          )}
        >
          {getReferenceLabel(reference)}
        </div>
        {metaLine && (
          <div
            className={cn(
              'truncate whitespace-pre-wrap',
              isComposer
                ? 'text-xs text-muted-foreground'
                : 'text-[10px] text-primary-foreground/75',
            )}
          >
            {metaLine}
          </div>
        )}
      </div>
      {onRemove && removeLabel && (
        <button
          type="button"
          onClick={onRemove}
          className={cn(
            'ml-1 rounded-full p-0.5',
            isComposer
              ? 'hover:bg-muted-foreground/20'
              : 'hover:bg-primary-foreground/20',
          )}
          title={removeLabel}
          aria-label={removeLabel}
        >
          <X size={12} />
        </button>
      )}
    </div>
  );
}
