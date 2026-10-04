import * as React from 'react';
import type {
  Client,
  WorkspaceFileScope,
  XpertWorkspaceFile,
} from '@xpert-ai/xpert-sdk';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Check, Copy, File, Folders, Loader2 } from 'lucide-react';
import { useChatkitTranslation } from '../../../i18n/useChatkitTranslation';
import { fileName, previewKind } from './workspace-file-utils';
const CodeEditor = React.lazy(() => import('../../code-editor/CodeEditor'));

export type WorkspaceFileTextContent = { filePath: string; text: string };

export function WorkspaceFilePreview({
  client,
  scope,
  file,
  source,
  revision,
  onTextContent,
}: {
  client: Client;
  scope: WorkspaceFileScope;
  file: XpertWorkspaceFile | null;
  source: boolean;
  revision: number;
  onTextContent?: (content: WorkspaceFileTextContent | null) => void;
}) {
  const { t } = useChatkitTranslation();
  const [content, setContent] = React.useState<{
    text: string;
    url: string;
  } | null>(null);
  const [error, setError] = React.useState('');
  const [copied, setCopied] = React.useState(false);
  const [copyError, setCopyError] = React.useState('');
  const [attempt, retry] = React.useReducer((n) => n + 1, 0);
  const kind = file ? previewKind(file) : 'unsupported';
  const textFile = kind === 'text' || kind === 'markdown' || kind === 'html';
  const scopeKey = JSON.stringify(scope);
  React.useEffect(() => {
    const abort = new AbortController();
    let url = '';
    setContent(null);
    onTextContent?.(null);
    setError('');
    setCopied(false);
    setCopyError('');
    if (file && kind !== 'unsupported') {
      void (async () => {
        const max = (textFile ? 5 : 50) * 1024 * 1024;
        if ((file.size ?? 0) > max) throw new Error(t('workbench.files.large'));
        const blob = await client.workbench.downloadFile(scope, file.filePath, {
          signal: abort.signal,
        });
        if (abort.signal.aborted) return;
        if (blob.size > max) throw new Error(t('workbench.files.large'));
        const text = textFile ? await blob.text() : '';
        if (abort.signal.aborted) return;
        if (text.includes('\0')) throw new Error(t('workbench.files.binary'));
        if (!textFile)
          url = URL.createObjectURL(
            new Blob([blob], { type: file.mimeType || blob.type }),
          );
        setContent({ text, url });
        if (textFile) onTextContent?.({ filePath: file.filePath, text });
      })().catch((error: unknown) => {
        if (!abort.signal.aborted)
          setError(
            error instanceof Error
              ? error.message
              : t('workbench.files.failed'),
          );
      });
    }
    return () => {
      abort.abort();
      onTextContent?.(null);
      if (url) URL.revokeObjectURL(url);
    };
  }, [
    client,
    scopeKey,
    file?.filePath,
    kind,
    textFile,
    revision,
    attempt,
    t,
    onTextContent,
  ]);
  React.useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);
  if (!file)
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
        <Folders
          size={32}
          strokeWidth={1.5}
          className="mb-1 text-muted-foreground"
        />
        <h2 className="text-lg font-medium">{t('workbench.files.openFile')}</h2>
        <p className="text-sm text-muted-foreground">
          {t('workbench.files.selectHint')}
        </p>
      </div>
    );
  if (error)
    return (
      <div
        role="alert"
        className="flex h-full flex-col items-center justify-center gap-3 p-6 text-sm"
      >
        <p className="text-destructive">{error}</p>
        <button
          className="rounded-[var(--chat-item-radius,var(--radius))] border px-3 py-1.5 hover:bg-muted"
          onClick={retry}
        >
          {t('workbench.files.retry')}
        </button>
      </div>
    );
  if (kind === 'unsupported')
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center text-sm text-muted-foreground">
        <File size={32} />
        <p>{t('workbench.files.unsupported')}</p>
      </div>
    );
  if (!content)
    return (
      <div
        role="status"
        className="flex h-full items-center justify-center gap-2 text-sm text-muted-foreground"
      >
        <Loader2 size={16} className="animate-spin" />
        {t('workbench.files.loading')}
      </div>
    );
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
            title={fileName(file.filePath)}
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
            <CodeEditor path={file.filePath} value={content.text} readOnly />
          </React.Suspense>
        )}
      </div>
    );
  if (kind === 'image')
    return (
      <div className="flex h-full items-center justify-center overflow-auto p-6">
        <img
          src={content.url}
          alt={fileName(file.filePath)}
          className="max-h-full max-w-full object-contain"
        />
      </div>
    );
  if (kind === 'pdf')
    return (
      <iframe
        title={fileName(file.filePath)}
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
  return null;
}
