import * as React from 'react';
import { RotateCw } from 'lucide-react';
import { useChatkitTranslation } from '../../i18n/useChatkitTranslation';
import { previewButtonClass } from './HtmlPreviewPanels';

export function useHtmlPreviewViewport() {
  const [device, setDevice] = React.useState(false);
  const [width, setWidth] = React.useState(390);
  const [height, setHeight] = React.useState(844);
  const [zoom, setZoom] = React.useState(100);
  return {
    device,
    setDevice,
    width,
    setWidth,
    height,
    setHeight,
    zoom,
    setZoom,
  };
}
export type HtmlPreviewViewportOptions = ReturnType<
  typeof useHtmlPreviewViewport
>;

function Dimension({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  const [draft, setDraft] = React.useState(String(value));
  React.useEffect(() => setDraft(String(value)), [value]);
  const commit = () => {
    const next = Number(draft);
    if (draft.trim() && Number.isFinite(next))
      onChange(Math.min(2560, Math.max(240, Math.round(next))));
    else setDraft(String(value));
  };
  return (
    <input
      className="w-20 rounded-md border bg-background px-2 py-1 text-center"
      aria-label={label}
      type="number"
      min={240}
      max={2560}
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === 'Enter') commit();
      }}
    />
  );
}

export function HtmlDeviceToolbar({
  viewport,
}: {
  viewport: HtmlPreviewViewportOptions;
}) {
  const { t } = useChatkitTranslation();
  return (
    <div className="flex shrink-0 flex-wrap items-center justify-center gap-2 border-b p-2 text-xs">
      <Dimension
        label={t('workbench.previewTools.width')}
        value={viewport.width}
        onChange={viewport.setWidth}
      />{' '}
      ×
      <Dimension
        label={t('workbench.previewTools.height')}
        value={viewport.height}
        onChange={viewport.setHeight}
      />
      <button
        type="button"
        className={previewButtonClass}
        aria-label={t('workbench.previewTools.rotate')}
        onClick={() => {
          viewport.setWidth(viewport.height);
          viewport.setHeight(viewport.width);
        }}
      >
        <RotateCw className="size-4" />
      </button>
    </div>
  );
}

export function HtmlPreviewViewport({
  viewport,
  hidden,
  children,
}: {
  viewport: HtmlPreviewViewportOptions;
  hidden: boolean;
  children: React.ReactNode;
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  // Do not execute page scripts in an initially hidden or zero-size viewport.
  const [size, setSize] = React.useState<{
    width: number;
    height: number;
  } | null>(null);
  React.useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const update = () => {
      if (element.clientWidth && element.clientHeight)
        setSize({ width: element.clientWidth, height: element.clientHeight });
    };
    const observer = new ResizeObserver(update);
    observer.observe(element);
    update();
    return () => observer.disconnect();
  }, []);
  const scale = viewport.zoom / 100;
  const width = viewport.device ? viewport.width : (size?.width ?? 0) / scale;
  const height = viewport.device
    ? viewport.height
    : (size?.height ?? 0) / scale;
  return (
    <div
      ref={ref}
      aria-hidden={hidden || undefined}
      inert={hidden}
      style={
        hidden
          ? {
              position: 'absolute',
              visibility: 'hidden',
              pointerEvents: 'none',
              width: size?.width,
              height: size?.height,
            }
          : undefined
      }
      className="relative min-h-0 min-w-0 flex-1 overflow-auto bg-muted/40"
      data-testid="html-preview-viewport"
    >
      {size && (
        <div
          className="relative mx-auto"
          style={{ width: width * scale, height: height * scale }}
        >
          <div
            className="h-full origin-top-left bg-white"
            style={{ width, height, transform: `scale(${scale})` }}
          >
            {children}
          </div>
        </div>
      )}
    </div>
  );
}
