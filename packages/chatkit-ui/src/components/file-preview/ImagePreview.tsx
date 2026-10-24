import * as React from 'react';
import { Maximize, RotateCcw, RotateCw, ZoomIn, ZoomOut } from 'lucide-react';
import { useChatkitTranslation } from '../../i18n/useChatkitTranslation';
import { getDensitySpacing } from '../../lib/theme-surfaces';
import { useTheme } from '../../providers/Theme';
import { useImagePreviewGestures } from './useImagePreviewGestures';

export function ImagePreview(props: {
  src: string;
  title: string;
  onError?: () => void;
  referrerPolicy?: React.ImgHTMLAttributes<HTMLImageElement>['referrerPolicy'];
}) {
  return <ImagePreviewSession key={props.src} {...props} />;
}

function ImagePreviewSession({
  src,
  title,
  onError,
  referrerPolicy,
}: React.ComponentProps<typeof ImagePreview>) {
  const { t } = useChatkitTranslation();
  const theme = useTheme({ optional: true });
  const { spacing } = getDensitySpacing(theme?.theme.density ?? 'normal');
  const viewport = React.useRef<HTMLDivElement>(null);
  const imageBounds = React.useRef<HTMLDivElement>(null);
  const [size, setSize] = React.useState({ width: 0, height: 0 });
  const [natural, setNatural] = React.useState({ width: 0, height: 0 });
  const [rotation, setRotation] = React.useState(0);
  const [zoom, setZoom] = React.useState<number | null>(null);
  const padding = 16 * spacing;
  const turned = rotation % 180 !== 0;
  const naturalWidth = turned ? natural.height : natural.width;
  const naturalHeight = turned ? natural.width : natural.height;
  const fit =
    naturalWidth && naturalHeight && size.width && size.height
      ? Math.min(
          1,
          Math.max(1, size.width - padding * 2) / naturalWidth,
          Math.max(1, size.height - padding * 2) / naturalHeight,
        )
      : 1;
  const scale = zoom ?? fit;
  const { dragging, onPointerDown } = useImagePreviewGestures({
    viewport,
    imageBounds,
    scale,
    enabled: natural.width > 0 && natural.height > 0,
    setZoom,
  });
  const canPan =
    naturalWidth * scale + padding * 2 > size.width ||
    naturalHeight * scale + padding * 2 > size.height;
  React.useEffect(() => {
    const element = viewport.current;
    if (!element) return;
    const update = () =>
      setSize({ width: element.clientWidth, height: element.clientHeight });
    update();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const resize = (value: number) => setZoom(Math.min(4, Math.max(0.1, value)));
  const buttonClass =
    'inline-flex shrink-0 items-center justify-center rounded-chat-item text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-40';
  const actions = [
    {
      key: 'zoomOut',
      Icon: ZoomOut,
      disabled: scale <= 0.1,
      run: () => resize(scale - 0.25),
    },
    {
      key: 'zoomIn',
      Icon: ZoomIn,
      disabled: scale >= 4,
      run: () => resize(scale + 0.25),
    },
    {
      key: 'rotateLeft',
      Icon: RotateCcw,
      run: () => setRotation((value) => (value + 270) % 360),
    },
    {
      key: 'rotateRight',
      Icon: RotateCw,
      run: () => setRotation((value) => (value + 90) % 360),
    },
    {
      key: 'fit',
      Icon: Maximize,
      run: () => {
        setZoom(null);
        setRotation(0);
      },
    },
  ];
  return (
    <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col bg-background text-foreground">
      <div
        role="toolbar"
        aria-label={t('workbench.files.imageControls')}
        className="flex shrink-0 flex-wrap items-center justify-center border-b"
        style={{ gap: 4 * spacing, padding: 6 * spacing }}
      >
        {actions.map(({ key, Icon, disabled, run }) => (
          <button
            key={key}
            type="button"
            className={buttonClass}
            style={{ width: 32 * spacing, height: 32 * spacing }}
            aria-label={t(`workbench.files.${key}`)}
            title={t(`workbench.files.${key}`)}
            disabled={disabled}
            onClick={run}
          >
            <Icon size={16 * spacing} />
          </button>
        ))}
        <button
          type="button"
          className={`${buttonClass} px-2 text-xs tabular-nums`}
          style={{ height: 32 * spacing }}
          onClick={() => setZoom(1)}
          aria-label={t('workbench.files.actualSize')}
          title={t('workbench.files.actualSize')}
        >
          {Math.round(scale * 100)}%
        </button>
      </div>
      <div
        ref={viewport}
        className={`min-h-0 flex-1 overflow-auto overscroll-contain touch-none select-none ${dragging ? 'cursor-grabbing' : canPan ? 'cursor-grab' : ''}`}
        style={{ overflowAnchor: 'none' }}
        onPointerDown={onPointerDown}
        tabIndex={0}
        aria-label={t('workbench.files.preview')}
        title={t('workbench.files.imageGestureHint')}
      >
        <div
          className="grid min-h-full min-w-full place-items-center"
          style={{
            width: naturalWidth * scale + padding * 2,
            height: naturalHeight * scale + padding * 2,
            padding,
          }}
        >
          <div
            ref={imageBounds}
            className="relative shrink-0 overflow-hidden"
            style={{
              width: naturalWidth * scale,
              height: naturalHeight * scale,
            }}
          >
            <img
              src={src}
              alt={title}
              referrerPolicy={referrerPolicy}
              draggable={false}
              onError={onError}
              onLoad={(event) =>
                setNatural({
                  width: event.currentTarget.naturalWidth,
                  height: event.currentTarget.naturalHeight,
                })
              }
              className="absolute top-1/2 left-1/2 max-w-none select-none"
              style={{
                width: natural.width || undefined,
                height: natural.height || undefined,
                transform: `translate(-50%, -50%) rotate(${rotation}deg) scale(${scale})`,
                transformOrigin: 'center',
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
