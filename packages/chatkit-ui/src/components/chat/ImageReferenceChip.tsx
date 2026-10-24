import { useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import type { ChatKitImageReference } from '@xpert-ai/chatkit-types';
import { ImageIcon, X } from 'lucide-react';
import { useChatkitTranslation } from '../../i18n/useChatkitTranslation';
import { getReferenceLabel, getReferenceTitle } from '../../lib/references';
import {
  getDensitySpacing,
  getSurfaceThemeStyle,
} from '../../lib/theme-surfaces';
import { useTheme } from '../../providers/Theme';
import { ImagePreview } from '../file-preview/ImagePreview';

/** The reference remains unchanged; only its visual presentation uses the image URL. */
export function ImageReferenceChip({
  reference,
  onRemove,
  removeLabel,
}: {
  reference: ChatKitImageReference;
  onRemove?: () => void;
  removeLabel?: string;
}) {
  const { t } = useChatkitTranslation();
  const context = useTheme({ optional: true });
  const theme = context?.theme ?? {};
  const { spacing } = getDensitySpacing(theme.density ?? 'normal');
  const src = reference.url?.trim() ?? '';
  const title = getReferenceLabel(reference);
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const failed = failedSrc === src;
  const [open, setOpen] = useState(false);
  const unavailable = t('message.toolGroup.attachments.unavailable');
  const controlClass =
    'inline-flex shrink-0 items-center justify-center rounded-chat-item bg-background text-foreground shadow-sm hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <div
        data-slot="image-reference"
        className="relative max-w-full shrink-0"
        title={getReferenceTitle(reference)}
      >
        <Dialog.Trigger asChild>
          <button
            type="button"
            disabled={failed}
            aria-label={t('message.toolGroup.attachments.open', { title })}
            className="block max-w-full overflow-hidden rounded-chat-item border border-border bg-muted text-foreground transition-colors hover:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            style={{ width: 128 * spacing, height: 96 * spacing }}
          >
            {failed ? (
              <span className="flex h-full min-w-0 flex-col items-center justify-center gap-1 px-2 text-xs text-muted-foreground">
                <ImageIcon size={20 * spacing} aria-hidden="true" />
                <span className="max-w-full truncate">{title}</span>
                <span>{unavailable}</span>
              </span>
            ) : (
              <img
                src={src}
                alt={title}
                loading="lazy"
                referrerPolicy="no-referrer"
                draggable={false}
                onError={() => setFailedSrc(src)}
                className="h-full w-full object-contain"
              />
            )}
          </button>
        </Dialog.Trigger>
        {onRemove && removeLabel && (
          <button
            type="button"
            onClick={onRemove}
            className={`absolute ${controlClass}`}
            style={{
              top: 4 * spacing,
              right: 4 * spacing,
              width: 24 * spacing,
              height: 24 * spacing,
            }}
            title={removeLabel}
            aria-label={removeLabel}
          >
            <X size={14 * spacing} aria-hidden="true" />
          </button>
        )}
      </div>
      <Dialog.Portal container={context?.themeRootRef.current}>
        <Dialog.Overlay className="fixed inset-0 z-[80] bg-background/80 backdrop-blur-sm" />
        <Dialog.Content
          className="fixed left-1/2 top-1/2 z-[81] flex h-[min(80dvh,48rem)] w-[min(92vw,64rem)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-chat-panel border border-border bg-background text-foreground shadow-xl outline-none"
          style={getSurfaceThemeStyle(theme)}
          aria-describedby={undefined}
          onEscapeKeyDown={(event) => event.stopPropagation()}
        >
          <div
            className="flex shrink-0 items-center justify-between border-b"
            style={{ padding: 12 * spacing, gap: 8 * spacing }}
          >
            <Dialog.Title className="min-w-0 truncate text-sm font-medium">
              {title}
            </Dialog.Title>
            <Dialog.Close
              className={controlClass}
              style={{ width: 28 * spacing, height: 28 * spacing }}
              aria-label={t('message.toolGroup.attachments.close')}
            >
              <X size={16 * spacing} aria-hidden="true" />
            </Dialog.Close>
          </div>
          {failed ? (
            <p
              role="status"
              className="grid flex-1 place-items-center p-4 text-sm text-muted-foreground"
            >
              {unavailable}
            </p>
          ) : (
            <ImagePreview
              src={src}
              title={title}
              referrerPolicy="no-referrer"
              onError={() => setFailedSrc(src)}
            />
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
