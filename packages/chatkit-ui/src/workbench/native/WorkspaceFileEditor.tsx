import * as React from 'react';
import type {
  Client,
  WorkspaceFileScope,
  XpertWorkspaceFile,
} from '@xpert-ai/xpert-sdk';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Download, Loader2, Save } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { useChatkitTranslation } from '../../i18n/useChatkitTranslation';
import type { FileEditorHandle } from './useNativeWorkbench';
import { downloadBlob, fileName } from './WorkspaceFiles';
import {
  editableKinds,
  fileKind,
  sameFileBytes,
  type BinaryEditorHandle,
} from './file-types';

const CodeEditor = React.lazy(() => import('./CodeEditor'));
const DocxEditor = React.lazy(() => import('./office/DocxEditor'));
const SpreadsheetEditor = React.lazy(
  () => import('./office/SpreadsheetEditor'),
);
const PptxEditor = React.lazy(() => import('./office/PptxEditor'));

export function WorkspaceFileEditor({
  client,
  scope,
  file,
  tabKey,
  register,
  onSaved,
}: {
  client: Client;
  scope: WorkspaceFileScope;
  file: XpertWorkspaceFile;
  tabKey: string;
  register: (key: string, handle: FileEditorHandle | null) => void;
  onSaved: () => void;
}) {
  const { t } = useChatkitTranslation();
  const kind = fileKind(file.filePath, file.mimeType);
  const editable = editableKinds.includes(kind);
  const textFile = kind === 'text' || kind === 'markdown' || kind === 'html';
  const [source, setSource] = React.useState<Blob | null>(null);
  const baseline = React.useRef<Blob | null>(null);
  const [text, setText] = React.useState('');
  const originalText = React.useRef('');
  const [dirty, setDirty] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const savingRef = React.useRef(false);
  const [error, setError] = React.useState('');
  const [preview, setPreview] = React.useState(false);
  const [url, setUrl] = React.useState('');
  const [version, retry] = React.useReducer((n) => n + 1, 0);
  const editor = React.useRef<BinaryEditorHandle>(null);
  const lifetime = React.useRef<AbortController | null>(null);
  const scopeKey = JSON.stringify(scope);
  React.useEffect(() => {
    const abort = new AbortController();
    lifetime.current = abort;
    setLoading(true);
    setError('');
    if (kind === 'unsupported') {
      setLoading(false);
      return () => abort.abort();
    }
    void (async () => {
      if ((file.size ?? 0) > 50 * 1024 * 1024)
        throw new Error(t('workbench.files.large'));
      const blob = await client.workbench.downloadFile(scope, file.filePath, {
        signal: abort.signal,
      });
      if (abort.signal.aborted) return;
      if (
        blob.size > 50 * 1024 * 1024 ||
        (textFile && blob.size > 5 * 1024 * 1024)
      )
        throw new Error(t('workbench.files.large'));
      if (textFile) {
        const contents = await blob.text();
        if (abort.signal.aborted) return;
        if (contents.includes('\0'))
          throw new Error(t('workbench.files.binary'));
        originalText.current = contents;
        setText(contents);
      }
      baseline.current = blob;
      setSource(blob);
      setDirty(false);
    })()
      .catch((error: unknown) => {
        if (!abort.signal.aborted)
          setError(
            error instanceof Error
              ? error.message
              : t('workbench.files.failed'),
          );
      })
      .finally(() => {
        if (!abort.signal.aborted) setLoading(false);
      });
    return () => abort.abort();
  }, [client, scopeKey, file.filePath, version, kind, textFile, t]);
  React.useEffect(() => {
    if (!source) return;
    const url = URL.createObjectURL(
      new Blob([source], { type: file.mimeType || source.type }),
    );
    setUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [source, file.mimeType]);
  const save = React.useCallback(async () => {
    if (savingRef.current) throw new Error(t('workbench.files.saving'));
    if (!baseline.current || !dirty) return;
    const abort = lifetime.current;
    savingRef.current = true;
    setSaving(true);
    setError('');
    try {
      const fresh = await client.workbench.downloadFile(scope, file.filePath, {
        signal: abort?.signal,
      });
      if (!(await sameFileBytes(baseline.current, fresh)))
        throw new Error(t('workbench.files.conflict'));
      if (textFile) {
        await client.workbench.saveFile(scope, file.filePath, text, {
          signal: abort?.signal,
        });
        baseline.current = new Blob([text]);
        originalText.current = text;
      } else {
        const blob = await editor.current?.exportFile();
        if (!blob) throw new Error(t('workbench.files.loading'));
        await client.workbench.saveBinaryFile(scope, file.filePath, blob, {
          signal: abort?.signal,
        });
        baseline.current = blob;
        if (!abort?.signal.aborted) editor.current?.markSaved?.(blob);
      }
      if (!abort?.signal.aborted) {
        setDirty(false);
        onSaved();
      }
    } catch (error) {
      if (!abort?.signal.aborted)
        setError(
          error instanceof Error ? error.message : t('workbench.files.failed'),
        );
      throw error;
    } finally {
      savingRef.current = false;
      if (!abort?.signal.aborted) setSaving(false);
    }
  }, [client, scopeKey, file.filePath, dirty, text, textFile, t, onSaved]);
  React.useEffect(() => {
    register(tabKey, { dirty, save });
    return () => register(tabKey, null);
  }, [register, tabKey, dirty, save]);
  const saveFromToolbar = () => {
    void save().catch(() => undefined);
  };
  const markDirty = React.useCallback((value = true) => setDirty(value), []);
  const editorProps = source
    ? {
        blob: source,
        name: fileName(file.filePath),
        onDirty: markDirty,
        onSave: saveFromToolbar,
      }
    : null;
  const content = () => {
    if (!source || !editorProps) return null;
    if (textFile) {
      if (preview && kind === 'html')
        return (
          <iframe
            title={fileName(file.filePath)}
            srcDoc={text}
            sandbox="allow-scripts"
            referrerPolicy="no-referrer"
            className="h-full w-full border-0 bg-white"
          />
        );
      if (preview && kind === 'markdown')
        return (
          <article className="prose dark:prose-invert max-w-none overflow-auto p-6">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
          </article>
        );
      return (
        <CodeEditor
          path={file.filePath}
          value={text}
          onChange={(value) => {
            setText(value);
            setDirty(value !== originalText.current);
          }}
          onSave={saveFromToolbar}
        />
      );
    }
    switch (kind) {
      case 'docx':
        return <DocxEditor ref={editor} {...editorProps} />;
      case 'spreadsheet':
        return <SpreadsheetEditor ref={editor} {...editorProps} />;
      case 'pptx':
        return <PptxEditor ref={editor} {...editorProps} />;
      case 'image':
        return (
          <div className="flex h-full items-center justify-center overflow-auto p-4">
            <img
              src={url}
              alt={fileName(file.filePath)}
              className="max-h-full max-w-full object-contain"
            />
          </div>
        );
      case 'pdf':
        return (
          <iframe
            title={fileName(file.filePath)}
            src={url}
            className="h-full w-full border-0"
          />
        );
      case 'audio':
        return (
          <div className="flex h-full items-center justify-center p-4">
            <audio controls src={url} />
          </div>
        );
      case 'video':
        return <video controls src={url} className="h-full w-full" />;
      default:
        return null;
    }
  };
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-y px-3 py-2">
        <span
          className="min-w-0 flex-1 truncate text-xs text-muted-foreground"
          title={file.filePath}
        >
          {file.filePath}
          {dirty ? ' •' : ''}
        </span>
        {(kind === 'markdown' || kind === 'html') && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setPreview((v) => !v)}
          >
            {t(preview ? 'workbench.files.edit' : 'workbench.files.preview')}
          </Button>
        )}
        <Button
          size="sm"
          variant="ghost"
          aria-label={t('workbench.files.download')}
          onClick={() => {
            void (
              dirty
                ? textFile
                  ? Promise.resolve(new Blob([text], { type: 'text/plain' }))
                  : (editor.current?.exportFile() ??
                    Promise.reject(new Error(t('workbench.files.loading'))))
                : client.workbench.downloadFile(scope, file.filePath)
            )
              .then((blob) => downloadBlob(blob, fileName(file.filePath)))
              .catch((error: unknown) =>
                setError(
                  error instanceof Error
                    ? error.message
                    : t('workbench.files.failed'),
                ),
              );
          }}
        >
          <Download size={16} />
        </Button>
        {editable && (
          <Button
            size="sm"
            disabled={!dirty || loading || saving}
            onClick={saveFromToolbar}
          >
            {saving ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Save size={14} />
            )}{' '}
            {t(saving ? 'workbench.files.saving' : 'workbench.files.save')}
          </Button>
        )}
      </div>
      {error && (
        <div
          role="alert"
          className="flex items-center gap-3 px-4 py-3 text-sm text-destructive"
        >
          <span className="flex-1">{error}</span>
          {!source && (
            <Button size="sm" variant="outline" onClick={retry}>
              {t('workbench.files.retry')}
            </Button>
          )}
        </div>
      )}
      {loading && (
        <p role="status" className="p-6 text-sm text-muted-foreground">
          {t('workbench.files.loading')}
        </p>
      )}
      {kind === 'unsupported' && (
        <p className="p-6 text-sm text-muted-foreground">
          {t('workbench.files.unsupported')}
        </p>
      )}
      <div
        className="min-h-0 flex-1 overflow-hidden"
        inert={saving || undefined}
        onKeyDownCapture={(event) => {
          if (
            (event.metaKey || event.ctrlKey) &&
            event.key.toLowerCase() === 's' &&
            editable
          ) {
            event.preventDefault();
            event.stopPropagation();
            saveFromToolbar();
          }
        }}
      >
        <React.Suspense
          fallback={
            <p className="p-6 text-sm text-muted-foreground">
              {t('workbench.files.loading')}
            </p>
          }
        >
          {!loading && content()}
        </React.Suspense>
      </div>
    </div>
  );
}
