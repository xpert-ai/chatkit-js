import * as React from 'react';
import type { ResourceCardImage } from '@xpert-ai/chatkit-types';
import { Loader2, RotateCcw } from 'lucide-react';
import { useResourceCardActions } from '../../../../resource-cards/context';
import { useFilePreviewContent } from '../../../file-preview/useFilePreviewContent';
import { useChatkitTranslation } from '../../../../i18n/useChatkitTranslation';
import { ResourceCardThumbnail } from './thumbnail';

/** A file's declared cover opens the document, while image bytes retain View authorization. */
export function ResourceCardCover({
  image,
  onOpen,
  disabled,
  openLabel,
  fallback,
}: {
  image: ResourceCardImage;
  onOpen: () => void;
  disabled: boolean;
  openLabel: string;
  fallback?: React.ReactNode;
}) {
  const { loadResourceCardImage } = useResourceCardActions();
  const { t } = useChatkitTranslation();
  const root = React.useRef<HTMLDivElement>(null);
  const [visible, setVisible] = React.useState(
    typeof IntersectionObserver === 'undefined',
  );
  const { id, title, alt, file } = image;
  const { viewKey, fileKey, targetId } = file;
  const stableImage = React.useMemo(
    () => ({ id, title, alt, file: { viewKey, fileKey, targetId } }),
    [id, title, alt, viewKey, fileKey, targetId],
  );
  const load = React.useCallback(
    async (signal: AbortSignal) => {
      if (!loadResourceCardImage) throw new Error('Preview unavailable');
      return {
        blob: await loadResourceCardImage(stableImage, signal),
        fileName: 'cover.png',
      };
    },
    [loadResourceCardImage, stableImage],
  );
  const { content, error, retry, fail } = useFilePreviewContent(
    visible ? load : null,
  );
  React.useEffect(() => {
    if (visible || !root.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: '160px' },
    );
    observer.observe(root.current);
    return () => observer.disconnect();
  }, [visible]);
  return (
    <ResourceCardThumbnail
      containerRef={root}
      action={{
        onClick: error ? retry : onOpen,
        disabled: error ? !loadResourceCardImage : disabled,
        label: error ? t('workbench.files.retry') : openLabel,
        title: error
          ? `${t('workbench.files.failed')} · ${t('workbench.files.retry')}`
          : openLabel,
      }}
    >
      {content?.url ? (
        <img
          src={content.url}
          alt={image.alt || image.title}
          onError={fail}
          className="size-full object-contain"
        />
      ) : error ? (
        (fallback ?? (
          <RotateCcw
            className="size-4 text-muted-foreground"
            aria-hidden="true"
          />
        ))
      ) : (
        <Loader2
          className="size-4 animate-spin text-muted-foreground"
          aria-label={t('workbench.loading')}
        />
      )}
      {error && (
        <span className="sr-only" role="status">
          {t('workbench.files.failed')}
        </span>
      )}
    </ResourceCardThumbnail>
  );
}
