import * as React from 'react';
import type { ResourceCardImage } from '@xpert-ai/chatkit-types';
import { useResourceCardActions } from '../../../../resource-cards/context';
import { ImageThumbnail } from '../../../file-preview/ImageThumbnail';
import { useChatkitTranslation } from '../../../../i18n/useChatkitTranslation';

function ImageItem({ image }: { image: ResourceCardImage }) {
  const { loadResourceCardImage, openResourceCardImage } =
    useResourceCardActions();
  const descriptor = JSON.stringify(image);
  const stableImage = React.useMemo(() => image, [descriptor]);
  const load = React.useCallback(
    (signal: AbortSignal) => {
      if (!loadResourceCardImage)
        return Promise.reject(new Error('Preview unavailable'));
      return loadResourceCardImage(stableImage, signal);
    },
    [loadResourceCardImage, stableImage],
  );
  const open = () => openResourceCardImage?.(stableImage);
  return (
    <li className="min-w-0">
      <ImageThumbnail
        load={load}
        alt={image.alt || image.title}
        onOpen={openResourceCardImage ? open : undefined}
      />
      <button
        type="button"
        onClick={open}
        disabled={!openResourceCardImage}
        className="mt-2 w-full break-words text-left text-sm font-medium hover:underline disabled:no-underline"
      >
        {image.title}
      </button>
    </li>
  );
}

export function ResourceCardImages({
  images,
  title,
}: {
  images: ResourceCardImage[];
  title: string;
}) {
  const { t } = useChatkitTranslation();
  const [expanded, setExpanded] = React.useState(false);
  const [columns, setColumns] = React.useState(3);
  const grid = React.useRef<HTMLUListElement>(null);
  const id = React.useId();
  React.useLayoutEffect(() => {
    const element = grid.current;
    if (!element) return;
    const measure = (width: number) => {
      if (width > 0)
        setColumns(Math.max(1, Math.min(3, Math.floor((width + 12) / 172))));
    };
    measure(element.getBoundingClientRect().width);
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(([entry]) =>
      measure(entry.contentRect.width),
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const hiddenCount = Math.max(0, images.length - columns);
  return (
    <>
      <ul
        id={id}
        ref={grid}
        aria-label={title}
        className="mt-3 grid gap-3"
        style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
      >
        {images.slice(0, expanded ? undefined : columns).map((image) => (
          <ImageItem key={image.id} image={image} />
        ))}
      </ul>
      {hiddenCount > 0 && (
        <button
          type="button"
          aria-expanded={expanded}
          aria-controls={id}
          onClick={() => setExpanded((value) => !value)}
          className="mt-3 rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {t(
            expanded
              ? 'resourceCard.collapseImages'
              : 'resourceCard.moreImages',
            { count: hiddenCount },
          )}
        </button>
      )}
    </>
  );
}
