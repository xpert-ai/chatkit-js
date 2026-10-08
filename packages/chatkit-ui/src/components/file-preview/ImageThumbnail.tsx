import { useFilePreviewContent } from './useFilePreviewContent';
import * as React from 'react';
import { ImageIcon, Loader2 } from 'lucide-react';
import { useChatkitTranslation } from '../../i18n/useChatkitTranslation';

export type ImageLoader = (signal: AbortSignal) => Promise<Blob>;

/** Each visible surface owns its Blob URL; closing chat must not break an open file preview. */
export function ImageThumbnail({
  load,
  alt,
  onOpen,
}: {
  load: ImageLoader;
  alt: string;
  onOpen?: () => void;
}) {
  const { t } = useChatkitTranslation();
  const ref = React.useRef<HTMLDivElement>(null);
  const [visible, setVisible] = React.useState(
    typeof IntersectionObserver === 'undefined',
  );
  const read = React.useCallback(
    async (signal: AbortSignal) => ({
      blob: await load(signal),
      fileName: 'image',
    }),
    [load],
  );
  const { content, error, retry, fail } = useFilePreviewContent(
    visible ? read : null,
  );
  React.useEffect(() => {
    if (visible || !ref.current) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setVisible(true);
        observer.disconnect();
      }
    });
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [visible]);
  return (
    <div
      ref={ref}
      className="flex aspect-[4/3] items-center justify-center overflow-hidden rounded-md bg-muted"
    >
      {error ? (
        <div className="flex flex-col items-center gap-2 p-3 text-sm text-muted-foreground">
          <ImageIcon aria-hidden="true" />
          <span role="status">{t('workbench.files.failed')}</span>
          <button
            type="button"
            className="rounded-md border px-2 py-1 hover:bg-background"
            onClick={(event) => {
              event.stopPropagation();
              retry();
            }}
          >
            {t('workbench.files.retry')}
          </button>
        </div>
      ) : content?.url ? (
        onOpen ? (
          <button
            type="button"
            onClick={onOpen}
            aria-label={`${t('resourceCard.open')} ${alt}`}
            className="h-full w-full"
          >
            <img
              src={content?.url}
              alt={alt}
              className="h-full w-full object-contain"
              onError={() => fail()}
            />
          </button>
        ) : (
          <img
            src={content?.url}
            alt={alt}
            className="h-full w-full object-contain"
            onError={() => fail()}
          />
        )
      ) : (
        <Loader2
          className="h-5 w-5 animate-spin text-muted-foreground"
          aria-label={t('workbench.loading')}
        />
      )}
    </div>
  );
}
