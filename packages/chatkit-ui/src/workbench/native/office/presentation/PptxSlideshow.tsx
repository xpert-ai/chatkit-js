import * as React from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import type { PptxDeck } from './pptx-file.utils';
import { PptxCanvas } from './PptxCanvas';
import { useChatkitTranslation } from '../../../../i18n/useChatkitTranslation';

export function PptxSlideshow({
  deck,
  initialIndex,
  onClose,
}: {
  deck: PptxDeck;
  initialIndex: number;
  onClose: () => void;
}) {
  const { t } = useChatkitTranslation();
  const slides = deck.slides.filter((s) => !s.hidden);
  const [index, setIndex] = React.useState(
    Math.max(0, slides.indexOf(deck.slides[initialIndex])),
  );
  const move = (delta: number) =>
    setIndex((i) => Math.max(0, Math.min(slides.length - 1, i + delta)));
  return (
    <Dialog.Root
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/80" />
        <Dialog.Content
          aria-describedby={undefined}
          className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 rounded-[var(--chat-panel-radius)] flex h-[90vh] w-[95vw] max-w-none flex-col bg-black p-4 text-white sm:max-w-none"
          onKeyDown={(e) => {
            // Portal events still bubble to the canvas editor's React handlers.
            e.stopPropagation();
            if (['ArrowRight', 'ArrowDown', ' '].includes(e.key)) {
              e.preventDefault();
              move(1);
            }
            if (['ArrowLeft', 'ArrowUp'].includes(e.key)) {
              e.preventDefault();
              move(-1);
            }
            if (e.key === 'Home') setIndex(0);
            if (e.key === 'End') setIndex(Math.max(0, slides.length - 1));
          }}
        >
          <Dialog.Title className="sr-only">
            {t('workbench.office.present')}
          </Dialog.Title>
          <div className="flex min-h-0 flex-1 items-center justify-center">
            {slides[index] && (
              <div
                style={{
                  width: `min(100%, calc(75vh * ${deck.width / deck.height}))`,
                }}
              >
                <PptxCanvas deck={deck} slide={slides[index]} />
              </div>
            )}
          </div>
          <div className="flex items-center justify-center gap-4 text-sm">
            <button disabled={index === 0} onClick={() => move(-1)}>
              {t('workbench.office.previous')}
            </button>
            <span>
              {slides.length ? index + 1 : 0} / {slides.length}
            </span>
            <button
              disabled={index >= slides.length - 1}
              onClick={() => move(1)}
            >
              {t('workbench.office.next')}
            </button>
          </div>
          <Dialog.Close
            className="absolute right-3 top-3 p-2"
            aria-label={t('workbench.files.close', {
              name: t('workbench.office.present'),
            })}
          >
            <X size={18} />
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
