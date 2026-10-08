import './file-preview.css';
import * as React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Check, Copy } from 'lucide-react';
import { useChatkitTranslation } from '../../i18n/useChatkitTranslation';
import type { FilePreviewContent } from './types';
const CodeEditor = React.lazy(() => import('../code-editor/CodeEditor'));

/** Shared format rendering; authorization and file origins belong to adapters. */
export function FilePreviewBody({
  content,
  title,
  source = false,
  onError,
}: {
  content: FilePreviewContent;
  title: string;
  source?: boolean;
  onError?: () => void;
}) {
  const { t } = useChatkitTranslation();
  const { kind } = content;
  const textFile = ['text', 'markdown', 'html'].includes(kind);
  const [copied, setCopied] = React.useState(false);
  const [copyError, setCopyError] = React.useState('');
  React.useEffect(() => {
    setCopied(false);
    setCopyError('');
  }, [content]);
  React.useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);
  if (textFile)
    return (
      <div className="relative h-full min-h-0">
        <button
          className="absolute top-3 right-4 z-10 rounded-[var(--chat-item-radius,var(--radius))] bg-background/90 p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label={t(
            copied ? 'workbench.files.copied' : 'workbench.files.copy',
          )}
          title={t(copied ? 'workbench.files.copied' : 'workbench.files.copy')}
          onClick={async () => {
            setCopyError('');
            try {
              await navigator.clipboard.writeText(content.text);
              setCopied(true);
            } catch {
              setCopyError(t('workbench.files.copyFailed'));
            }
          }}
        >
          {copied ? <Check size={16} /> : <Copy size={16} />}
        </button>
        {copyError && (
          <p
            role="alert"
            className="absolute top-12 right-4 z-10 rounded-[var(--chat-item-radius,var(--radius))] border bg-background p-2 text-xs text-destructive"
          >
            {copyError}
          </p>
        )}
        {kind === 'markdown' && !source ? (
          <article className="workspace-markdown h-full overflow-auto px-5 py-4 pr-12">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {content.text}
            </ReactMarkdown>
          </article>
        ) : kind === 'html' && !source ? (
          <iframe
            title={title}
            srcDoc={content.text}
            sandbox="allow-scripts"
            referrerPolicy="no-referrer"
            className="h-full w-full border-0 bg-background"
          />
        ) : (
          <React.Suspense
            fallback={
              <p className="p-5 text-sm text-muted-foreground">
                {t('workbench.files.loading')}
              </p>
            }
          >
            <CodeEditor path={content.fileName} value={content.text} readOnly />
          </React.Suspense>
        )}
      </div>
    );
  if (kind === 'image')
    return (
      <div className="flex h-full items-center justify-center overflow-auto p-6">
        <img
          src={content.url}
          alt={title}
          onError={onError}
          className="max-h-full max-w-full object-contain"
        />
      </div>
    );
  if (kind === 'pdf')
    return (
      <iframe
        title={title}
        src={content.url}
        className="h-full w-full border-0"
      />
    );
  if (kind === 'audio')
    return (
      <div className="flex h-full items-center justify-center p-6">
        <audio controls src={content.url} />
      </div>
    );
  if (kind === 'video')
    return <video controls src={content.url} className="h-full w-full" />;
  return (
    <p className="grid h-full place-items-center p-4 text-sm text-muted-foreground">
      {t('workbench.files.unsupported')}
    </p>
  );
}
