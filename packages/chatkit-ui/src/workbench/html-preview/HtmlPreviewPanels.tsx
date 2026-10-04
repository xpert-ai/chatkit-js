import * as React from 'react';
import { ArrowUp, MousePointer2, Trash2, X } from 'lucide-react';
import type { ChatKitQuoteReference } from '@xpert-ai/chatkit-types';
import { useChatkitTranslation } from '../../i18n/useChatkitTranslation';
import {
  htmlAnnotationReference,
  type HtmlPreviewIdentity,
} from './annotation';
import type { HtmlPreviewRuntime } from './useHtmlPreviewRuntime';

export const previewButtonClass =
  'inline-flex shrink-0 items-center justify-center gap-1 rounded-md px-2 py-1.5 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50';

export function HtmlAnnotationPanel({
  title,
  identity,
  runtime,
  onAnnotate,
  onClose,
}: {
  title: string;
  identity: HtmlPreviewIdentity;
  runtime: HtmlPreviewRuntime;
  onAnnotate: (reference: ChatKitQuoteReference) => Promise<void>;
  onClose: () => void;
}) {
  const { t } = useChatkitTranslation();
  const [comment, setComment] = React.useState('');
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState(false);
  const [added, setAdded] = React.useState(false);
  const operation = React.useRef(0);
  React.useEffect(() => {
    operation.current++;
    setComment('');
    setError(false);
    setPending(false);
    return () => {
      operation.current++;
    };
  }, [runtime.session, runtime.selection]);
  const submit = async () => {
    if (!runtime.selection || !comment.trim() || pending) return;
    const id = ++operation.current;
    setPending(true);
    setError(false);
    try {
      await onAnnotate(
        htmlAnnotationReference(title, identity, runtime.selection, comment),
      );
      if (id !== operation.current) return;
      setAdded(true);
      setComment('');
      runtime.clearSelection();
    } catch {
      if (id === operation.current) setError(true);
    } finally {
      if (id === operation.current) setPending(false);
    }
  };
  return (
    <div
      className="shrink-0 space-y-2 border-b p-3 text-xs"
      aria-label={t('workbench.previewTools.annotate')}
    >
      <div className="flex items-center gap-2">
        <MousePointer2 className="size-4 shrink-0" />
        <span className="flex-1">
          {t('workbench.previewTools.annotationHint')}
        </span>
        <button
          type="button"
          className={previewButtonClass}
          onClick={onClose}
          aria-label={t('workbench.previewTools.exitAnnotation')}
        >
          <X className="size-4" />
        </button>
      </div>
      {runtime.selection && (
        <>
          <div className="flex min-w-0 items-center gap-1">
            <code
              className="min-w-0 flex-1 truncate"
              title={runtime.selection.selector}
            >
              {runtime.selection.selector}
            </code>
            <button
              type="button"
              className={previewButtonClass}
              onClick={() => runtime.command({ type: 'parent' })}
              title={t('workbench.previewTools.parent')}
              aria-label={t('workbench.previewTools.parent')}
            >
              <ArrowUp className="size-4" />
            </button>
          </div>
          <textarea
            className="w-full resize-y rounded-md border bg-background p-2 text-sm"
            rows={2}
            maxLength={4000}
            value={comment}
            aria-label={t('workbench.previewTools.comment')}
            placeholder={t('workbench.previewTools.comment')}
            onChange={(event) => {
              setComment(event.target.value);
              setAdded(false);
            }}
            onKeyDown={(event) => {
              if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
                event.preventDefault();
                void submit();
              }
            }}
          />
          <button
            type="button"
            className={`${previewButtonClass} border`}
            disabled={pending || !comment.trim()}
            onClick={() => void submit()}
          >
            {t('workbench.previewTools.addToChat')}
          </button>
        </>
      )}
      {error && (
        <p role="alert" className="text-destructive">
          {t('workbench.previewTools.annotationFailed')}
        </p>
      )}
      {added && (
        <p role="status" className="text-muted-foreground">
          {t('workbench.previewTools.annotationAdded')}
        </p>
      )}
    </div>
  );
}

export function HtmlDeveloperTools({
  runtime,
  onClose,
}: {
  runtime: HtmlPreviewRuntime;
  onClose: () => void;
}) {
  const { t } = useChatkitTranslation();
  const [tab, setTab] = React.useState<'console' | 'elements'>('console');
  return (
    <section
      className="flex h-64 max-h-[45%] min-h-32 shrink-0 flex-col border-t bg-background text-xs"
      aria-label={t('workbench.previewTools.devtools')}
    >
      <div className="flex shrink-0 flex-wrap items-center gap-1 border-b p-1">
        {(['console', 'elements'] as const).map((key) => (
          <button
            type="button"
            key={key}
            aria-pressed={tab === key}
            className={`${previewButtonClass} ${tab === key ? 'bg-muted font-medium' : ''}`}
            onClick={() => setTab(key)}
          >
            {t(`workbench.previewTools.${key}`)}
          </button>
        ))}
        <span className="flex-1" />
        <button
          type="button"
          className={previewButtonClass}
          disabled={!runtime.ready}
          aria-pressed={runtime.inspecting}
          aria-label={t('workbench.previewTools.inspect')}
          onClick={() => {
            setTab('elements');
            runtime.inspect(!runtime.inspecting);
          }}
        >
          <MousePointer2 className="size-4" />
        </button>
        <button
          type="button"
          className={previewButtonClass}
          aria-label={t('workbench.previewTools.clearConsole')}
          onClick={runtime.clearLogs}
        >
          <Trash2 className="size-4" />
        </button>
        <button
          type="button"
          className={previewButtonClass}
          aria-label={t('workbench.previewTools.closeDevtools')}
          onClick={onClose}
        >
          <X className="size-4" />
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-auto p-2">
        {tab === 'console' ? (
          <>
            <p className="mb-2 text-muted-foreground">
              {t('workbench.previewTools.consoleHint')}
            </p>
            <div role="log" aria-label={t('workbench.previewTools.console')}>
              {runtime.logs.map((log, index) => (
                <pre
                  key={index}
                  className={`whitespace-pre-wrap break-words border-b py-1 font-mono ${log.level === 'error' ? 'text-destructive' : log.level === 'warn' ? 'text-amber-600 dark:text-amber-400' : ''}`}
                >
                  [{log.level}] {log.text}
                </pre>
              ))}
            </div>
          </>
        ) : runtime.selection ? (
          <>
            <code className="block break-all font-medium">
              {runtime.selection.selector}
            </code>
            <pre className="my-2 whitespace-pre-wrap break-words font-mono">
              {runtime.selection.html}
            </pre>
            <dl>
              {runtime.selection.styles.map(({ name, value }) => (
                <div key={name} className="flex gap-2 border-b py-1">
                  <dt className="w-32 shrink-0">{name}</dt>
                  <dd className="min-w-0 break-all font-mono">{value}</dd>
                </div>
              ))}
            </dl>
          </>
        ) : (
          <p className="text-muted-foreground">
            {t('workbench.previewTools.inspectHint')}
          </p>
        )}
      </div>
    </section>
  );
}
