import * as React from 'react';
import { Loader2 } from 'lucide-react';
import type { ChatKitQuoteReference } from '@xpert-ai/chatkit-types';
import { useChatkitTranslation } from '../../i18n/useChatkitTranslation';
import { prepareHtmlPreview } from './html-artifact-preview';
import {
  HtmlAnnotationPanel,
  HtmlDeveloperTools,
  previewButtonClass,
} from './HtmlPreviewPanels';
import { HtmlPreviewToolbar } from './HtmlPreviewToolbar';
import {
  HtmlDeviceToolbar,
  HtmlPreviewViewport,
  useHtmlPreviewViewport,
} from './HtmlPreviewViewport';
import { useHtmlPreviewRuntime } from './useHtmlPreviewRuntime';
import type { HtmlPreviewIdentity } from './annotation';

const CodeEditor = React.lazy(
  () => import('../../components/code-editor/CodeEditor'),
);
type LoadedHtml = { source: string; downloadUrl: string; name: string };

export function HtmlArtifactPreview({
  title,
  load,
  identity,
  onAnnotate,
}: {
  title: string;
  load: (signal: AbortSignal) => Promise<{ blob: Blob; name: string }>;
  identity?: HtmlPreviewIdentity;
  onAnnotate?: (reference: ChatKitQuoteReference) => Promise<void>;
}) {
  const { t } = useChatkitTranslation();
  const [file, setFile] = React.useState<LoadedHtml | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [sourceMode, setSourceMode] = React.useState(false);
  const [annotation, setAnnotation] = React.useState(false);
  const [devtools, setDevtools] = React.useState(false);
  const [attempt, retry] = React.useReducer((value) => value + 1, 0);
  const [revision, reload] = React.useReducer((value) => value + 1, 0);
  const runtime = useHtmlPreviewRuntime(file, revision);
  const viewport = useHtmlPreviewViewport();
  const prepared = React.useMemo(
    () => (file ? prepareHtmlPreview(file.source, runtime.session) : null),
    [file, runtime.session],
  );
  const failed = t('workbench.files.failed');
  React.useEffect(() => {
    if (!runtime.inspecting) setAnnotation(false);
  }, [runtime.inspecting]);

  React.useEffect(() => {
    let disposed = false;
    const controller = new AbortController();
    let downloadUrl: string | undefined;
    setFile(null);
    setError(null);
    setAnnotation(false);
    void load(controller.signal)
      .then(async ({ blob, name }) => {
        const source = await blob.text();
        if (disposed) return;
        downloadUrl = URL.createObjectURL(blob);
        setFile({ source, downloadUrl, name });
      })
      .catch((reason: unknown) => {
        if (!disposed)
          setError(reason instanceof Error ? reason.message : failed);
      });
    return () => {
      disposed = true;
      controller.abort();
      if (downloadUrl) URL.revokeObjectURL(downloadUrl);
    };
  }, [load, attempt, failed]);

  const closeAnnotation = () => {
    setAnnotation(false);
    runtime.inspect(false);
  };
  return (
    <section
      className="relative flex h-full min-h-0 min-w-0 flex-col overflow-hidden"
      aria-label={title}
    >
      <HtmlPreviewToolbar
        title={title}
        file={file}
        sourceMode={sourceMode}
        setSourceMode={(value) => {
          setSourceMode(value);
          closeAnnotation();
        }}
        onReload={() => {
          closeAnnotation();
          setSourceMode(false);
          reload();
        }}
        annotate={annotation}
        canAnnotate={runtime.ready && Boolean(identity && onAnnotate)}
        onAnnotate={() => {
          setAnnotation(!annotation);
          runtime.inspect(!annotation);
        }}
        devtools={devtools}
        onDevtools={() => {
          setDevtools(!devtools);
          if (devtools && !annotation) runtime.inspect(false);
        }}
        viewport={viewport}
      />
      {error ? (
        <div role="alert" className="p-4 text-sm">
          <p>{error}</p>
          <button
            type="button"
            className={`${previewButtonClass} mt-2 border`}
            onClick={retry}
          >
            {t('workbench.files.retry')}
          </button>
        </div>
      ) : !file || !prepared ? (
        <div
          role="status"
          className="flex items-center gap-2 p-4 text-sm text-muted-foreground"
        >
          <Loader2 className="size-4 animate-spin" />
          {t('workbench.files.loading')}
        </div>
      ) : (
        <>
          {prepared.hasExternalResources && (
            <p
              role="status"
              className="shrink-0 border-b px-3 py-2 text-xs text-muted-foreground"
            >
              {t('workbench.preview.htmlResources')}
            </p>
          )}
          {annotation && identity && onAnnotate && (
            <HtmlAnnotationPanel
              title={title}
              identity={identity}
              runtime={runtime}
              onAnnotate={onAnnotate}
              onClose={closeAnnotation}
            />
          )}
          {viewport.device && !sourceMode && (
            <HtmlDeviceToolbar viewport={viewport} />
          )}
          {sourceMode && (
            <div className="min-h-0 flex-1 overflow-auto">
              <React.Suspense
                fallback={<p className="p-3">{t('workbench.files.loading')}</p>}
              >
                <CodeEditor value={file.source} path="snapshot.html" readOnly />
              </React.Suspense>
            </div>
          )}
          {/* Keep the document alive while viewing source and receiving streamed chat updates. */}
          <HtmlPreviewViewport viewport={viewport} hidden={sourceMode}>
            <iframe
              key={runtime.session}
              ref={runtime.frameRef}
              onLoad={() => runtime.command({ type: 'connect' })}
              title={title}
              srcDoc={prepared.srcDoc}
              sandbox="allow-scripts"
              referrerPolicy="no-referrer"
              className="h-full w-full border-0 bg-white"
            />
          </HtmlPreviewViewport>
          {devtools && (
            <HtmlDeveloperTools
              runtime={runtime}
              onClose={() => {
                setDevtools(false);
                if (!annotation) runtime.inspect(false);
              }}
            />
          )}
        </>
      )}
    </section>
  );
}
