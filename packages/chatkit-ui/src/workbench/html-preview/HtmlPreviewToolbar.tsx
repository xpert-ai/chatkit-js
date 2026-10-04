import * as React from 'react';
import {
  Code,
  Copy,
  Download,
  Globe,
  MoreHorizontal,
  MessageSquarePlus,
  RotateCw,
  Smartphone,
  SquareTerminal,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../../components/ui/dropdown-menu';
import { useChatkitTranslation } from '../../i18n/useChatkitTranslation';
import { previewButtonClass } from './HtmlPreviewPanels';
import type { HtmlPreviewViewportOptions } from './HtmlPreviewViewport';

export function HtmlPreviewToolbar({
  title,
  file,
  sourceMode,
  setSourceMode,
  onReload,
  annotate,
  canAnnotate,
  onAnnotate,
  devtools,
  onDevtools,
  viewport,
}: {
  title: string;
  file: { name: string; downloadUrl: string; source: string } | null;
  sourceMode: boolean;
  setSourceMode: (value: boolean) => void;
  onReload: () => void;
  annotate: boolean;
  canAnnotate: boolean;
  onAnnotate: () => void;
  devtools: boolean;
  onDevtools: () => void;
  viewport: HtmlPreviewViewportOptions;
}) {
  const { t } = useChatkitTranslation();
  const [clipboard, setClipboard] = React.useState<
    'copied' | 'copyFailed' | null
  >(null);
  const copy = async () => {
    if (!file) return;
    try {
      await navigator.clipboard.writeText(file.source);
      setClipboard('copied');
    } catch {
      setClipboard('copyFailed');
    }
  };
  return (
    <>
      <div className="flex shrink-0 flex-wrap items-center gap-1 border-y px-2 py-1.5 text-xs">
        <Globe className="size-4 shrink-0" />
        <span className="min-w-0 flex-1 truncate" title={file?.name ?? title}>
          {file?.name ?? title}
        </span>
        <span className="text-muted-foreground">
          {t('fileActivity.savedVersion')}
        </span>
        <button
          type="button"
          className={previewButtonClass}
          disabled={!file}
          onClick={onReload}
          aria-label={t('workbench.files.refresh')}
          title={t('workbench.files.refresh')}
        >
          <RotateCw className="size-4" />
        </button>
        <button
          type="button"
          className={previewButtonClass}
          disabled={!canAnnotate || sourceMode}
          aria-pressed={annotate}
          aria-label={t('workbench.previewTools.annotate')}
          title={t('workbench.previewTools.annotate')}
          onClick={onAnnotate}
        >
          <MessageSquarePlus className="size-4" />
        </button>
        <button
          type="button"
          className={previewButtonClass}
          disabled={!file}
          aria-pressed={sourceMode}
          onClick={() => setSourceMode(!sourceMode)}
          title={t(
            sourceMode ? 'workbench.files.preview' : 'workbench.preview.source',
          )}
          aria-label={t(
            sourceMode ? 'workbench.files.preview' : 'workbench.preview.source',
          )}
        >
          {sourceMode ? (
            <Globe className="size-4" />
          ) : (
            <Code className="size-4" />
          )}
        </button>
        {file && (
          <a
            className={previewButtonClass}
            href={file.downloadUrl}
            download={file.name}
            title={t('workbench.files.download')}
            aria-label={t('workbench.files.download')}
          >
            <Download className="size-4" />
          </a>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className={previewButtonClass}
              disabled={!file}
              aria-label={t('workbench.previewTools.more')}
              title={t('workbench.previewTools.more')}
            >
              <MoreHorizontal className="size-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            <DropdownMenuItem onSelect={onReload}>
              <RotateCw className="size-4" />
              {t('workbench.files.refresh')}
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => void copy()}>
              <Copy className="size-4" />
              {t('workbench.previewTools.copySource')}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={() => viewport.setDevice(!viewport.device)}
            >
              <Smartphone className="size-4" />
              {t('workbench.previewTools.device')}
              {viewport.device && (
                <span className="ml-auto" aria-hidden>
                  ✓
                </span>
              )}
            </DropdownMenuItem>
            <div
              className="flex items-center gap-1 px-2 py-1 text-sm"
              role="group"
              aria-label={t('workbench.previewTools.zoom')}
            >
              <span className="mr-auto">
                {t('workbench.previewTools.zoom')}
              </span>
              <DropdownMenuItem
                asChild
                disabled={viewport.zoom <= 50}
                onSelect={(event) => {
                  event.preventDefault();
                  viewport.setZoom(viewport.zoom - 10);
                }}
              >
                <button
                  type="button"
                  className={previewButtonClass}
                  disabled={viewport.zoom <= 50}
                  aria-label={t('workbench.previewTools.zoomOut')}
                >
                  <ZoomOut className="size-4" />
                </button>
              </DropdownMenuItem>
              <DropdownMenuItem
                asChild
                disabled={false}
                onSelect={(event) => {
                  event.preventDefault();
                  viewport.setZoom(100);
                }}
              >
                <button
                  type="button"
                  className={previewButtonClass}
                  aria-label={t('workbench.previewTools.resetZoom')}
                >
                  {viewport.zoom}%
                </button>
              </DropdownMenuItem>
              <DropdownMenuItem
                asChild
                disabled={viewport.zoom >= 200}
                onSelect={(event) => {
                  event.preventDefault();
                  viewport.setZoom(viewport.zoom + 10);
                }}
              >
                <button
                  type="button"
                  className={previewButtonClass}
                  disabled={viewport.zoom >= 200}
                  aria-label={t('workbench.previewTools.zoomIn')}
                >
                  <ZoomIn className="size-4" />
                </button>
              </DropdownMenuItem>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={onDevtools}>
              <SquareTerminal className="size-4" />
              {t('workbench.previewTools.devtools')}
              {devtools && (
                <span className="ml-auto" aria-hidden>
                  ✓
                </span>
              )}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {clipboard && (
        <p
          role="status"
          className="shrink-0 px-3 py-1 text-xs text-muted-foreground"
        >
          {t(`workbench.previewTools.${clipboard}`)}
        </p>
      )}
    </>
  );
}
