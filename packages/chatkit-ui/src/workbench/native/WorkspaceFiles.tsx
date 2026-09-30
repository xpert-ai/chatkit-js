import * as React from 'react';
import type {
  Client,
  WorkspaceFileScope,
  XpertWorkspaceFile,
} from '@xpert-ai/xpert-sdk';
import {
  ArrowUp,
  Download,
  File,
  FilePlus2,
  Folder,
  Loader2,
  RefreshCw,
  Trash2,
  Upload,
} from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
} from '../../components/ui/alert-dialog';
import { useChatkitTranslation } from '../../i18n/useChatkitTranslation';

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export const fileName = (path: string) =>
  path.split('/').filter(Boolean).pop() ?? path;
export const isFolder = (file: XpertWorkspaceFile) =>
  file.hasChildren === true || file.fileType === 'directory';
export const validRelativePath = (path: string) =>
  !!path &&
  !path.startsWith('/') &&
  !path.includes('\\') &&
  !path.includes('\0') &&
  path.split('/').every((part) => !!part && part !== '..' && part !== '.');

export function WorkspaceFiles({
  client,
  scope,
  onOpen,
  revision = 0,
}: {
  client: Client;
  scope: WorkspaceFileScope | null;
  onOpen: (file: XpertWorkspaceFile) => void;
  revision?: number;
}) {
  const { t } = useChatkitTranslation();
  const [path, setPath] = React.useState('');
  const [files, setFiles] = React.useState<XpertWorkspaceFile[]>([]);
  const [query, setQuery] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState('');
  const [version, refresh] = React.useReducer((x) => x + 1, 0);
  const [create, setCreate] = React.useState(false);
  const [name, setName] = React.useState('');
  const [deleting, setDeleting] = React.useState<XpertWorkspaceFile | null>(
    null,
  );
  const input = React.useRef<HTMLInputElement>(null);
  const scopeKey = JSON.stringify(scope);
  const currentScope = React.useRef(scopeKey);
  currentScope.current = scopeKey;
  React.useEffect(() => {
    if (!scope) return;
    const abort = new AbortController();
    setLoading(true);
    setError('');
    setFiles([]);
    client.workbench
      .listFiles(scope, path, { signal: abort.signal })
      .then((items) => {
        if (!abort.signal.aborted) setFiles(items);
      })
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
  }, [client, scopeKey, path, version, revision, t]);
  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError('');
    try {
      await action();
      if (currentScope.current === scopeKey) refresh();
    } catch (error) {
      if (currentScope.current === scopeKey)
        setError(
          error instanceof Error ? error.message : t('workbench.files.failed'),
        );
    } finally {
      if (currentScope.current === scopeKey) setBusy(false);
    }
  }
  if (!scope)
    return (
      <p className="p-6 text-sm text-muted-foreground">
        {t('workbench.start.conversationRequired')}
      </p>
    );
  const visible = files
    .filter((file) =>
      fileName(file.filePath)
        .toLocaleLowerCase()
        .includes(query.toLocaleLowerCase()),
    )
    .sort(
      (a, b) =>
        Number(isFolder(b)) - Number(isFolder(a)) ||
        a.filePath.localeCompare(b.filePath),
    );
  const itemButton =
    'rounded-[var(--chat-item-radius)] p-2 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-40';
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex flex-wrap items-center gap-2 border-y p-3">
        <button
          className={itemButton}
          title={t('workbench.files.parent')}
          aria-label={t('workbench.files.parent')}
          disabled={!path || busy}
          onClick={() => setPath(path.split('/').slice(0, -1).join('/'))}
        >
          <ArrowUp size={16} />
        </button>
        <button
          className="min-w-0 flex-1 truncate text-left text-sm"
          onClick={() => setPath('')}
        >
          {t('workbench.files.root')}
          {path && ` / ${path}`}
        </button>
        <button
          className={itemButton}
          aria-label={t('workbench.files.refresh')}
          disabled={busy || loading}
          onClick={refresh}
        >
          <RefreshCw size={16} />
        </button>
        <button
          className={itemButton}
          aria-label={t('workbench.files.newFile')}
          title={t('workbench.files.newFile')}
          disabled={busy}
          onClick={() => {
            setName('');
            setCreate(true);
          }}
        >
          <FilePlus2 size={16} />
        </button>
        <button
          className={itemButton}
          aria-label={t('workbench.files.upload')}
          title={t('workbench.files.upload')}
          disabled={busy}
          onClick={() => input.current?.click()}
        >
          <Upload size={16} />
        </button>
        <input
          ref={input}
          type="file"
          multiple
          hidden
          onChange={(event) => {
            const uploads = Array.from(event.target.files ?? []);
            event.target.value = '';
            void run(async () => {
              for (const file of uploads)
                await client.workbench.uploadFile(scope, path, file, file.name);
            });
          }}
        />
      </div>
      <div className="px-4 pt-3">
        <Input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t('workbench.files.search')}
          aria-label={t('workbench.files.search')}
        />
      </div>
      {error && (
        <p role="alert" className="px-4 py-3 text-sm text-destructive">
          {error}
        </p>
      )}
      <div className="min-h-0 flex-1 overflow-auto p-3">
        {loading || busy ? (
          <div
            role="status"
            className="flex items-center gap-2 p-3 text-sm text-muted-foreground"
          >
            <Loader2 size={16} className="animate-spin" />
            {t('workbench.loading')}
          </div>
        ) : null}
        {!loading && !visible.length && (
          <p className="p-3 text-sm text-muted-foreground">
            {t(query ? 'workbench.start.noResults' : 'workbench.files.empty')}
          </p>
        )}
        {visible.map((file) => (
          <div
            key={file.filePath}
            className="group flex items-center gap-1 rounded-[var(--chat-item-radius)] hover:bg-muted/50"
          >
            <button
              type="button"
              className="flex min-w-0 flex-1 items-center gap-3 px-3 py-3 text-left text-sm"
              onClick={() =>
                isFolder(file) ? setPath(file.filePath) : onOpen(file)
              }
            >
              {isFolder(file) ? (
                <Folder className="shrink-0 text-muted-foreground" size={18} />
              ) : (
                <File className="shrink-0 text-muted-foreground" size={18} />
              )}
              <span className="min-w-0 flex-1 truncate" title={file.filePath}>
                {fileName(file.filePath)}
              </span>
              {file.size != null && !isFolder(file) && (
                <span className="shrink-0 text-xs text-muted-foreground">
                  {new Intl.NumberFormat(undefined, {
                    style: 'unit',
                    unit: 'kilobyte',
                    maximumFractionDigits: 1,
                  }).format(file.size / 1024)}
                </span>
              )}
            </button>
            <button
              className={itemButton}
              disabled={busy}
              aria-label={`${t('workbench.files.download')} ${fileName(file.filePath)}`}
              onClick={() =>
                void run(async () =>
                  downloadBlob(
                    await client.workbench.downloadFile(scope, file.filePath),
                    fileName(file.filePath) + (isFolder(file) ? '.zip' : ''),
                  ),
                )
              }
            >
              <Download size={16} />
            </button>
            <button
              className={itemButton}
              disabled={busy}
              aria-label={`${t('workbench.files.delete')} ${fileName(file.filePath)}`}
              onClick={() => setDeleting(file)}
            >
              <Trash2 size={16} />
            </button>
          </div>
        ))}
      </div>
      <AlertDialog
        open={create}
        onOpenChange={(next) => {
          if (!busy) setCreate(next);
        }}
      >
        <AlertDialogContent>
          <AlertDialogTitle>{t('workbench.files.newFile')}</AlertDialogTitle>
          <AlertDialogDescription>
            {t('workbench.files.createHint')}
          </AlertDialogDescription>
          <Input
            aria-label={t('workbench.files.name')}
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>
              {t('workbench.files.cancel')}
            </AlertDialogCancel>
            <Button
              disabled={
                busy ||
                !validRelativePath(name) ||
                files.some(
                  (file) =>
                    file.filePath === [path, name].filter(Boolean).join('/'),
                )
              }
              onClick={() =>
                void run(async () => {
                  const filePath = [path, name].filter(Boolean).join('/');
                  let parent = path;
                  let siblings = files;
                  for (const directory of name.split('/').slice(0, -1)) {
                    parent = [parent, directory].filter(Boolean).join('/');
                    const existing = siblings.find(
                      (item) => item.filePath === parent,
                    );
                    if (!existing) {
                      siblings = [];
                      break;
                    }
                    if (!isFolder(existing))
                      throw new Error(t('workbench.files.pathExists'));
                    siblings = await client.workbench.listFiles(scope, parent);
                  }
                  if (siblings.some((item) => item.filePath === filePath)) {
                    throw new Error(t('workbench.files.pathExists'));
                  }
                  const separator = filePath.lastIndexOf('/');
                  const created = await client.workbench.uploadFile(
                    scope,
                    separator < 0 ? '' : filePath.slice(0, separator),
                    new Blob([''], { type: 'text/plain' }),
                    filePath.slice(separator + 1),
                  );
                  setCreate(false);
                  onOpen({ ...created, filePath });
                })
              }
            >
              {t('workbench.files.create')}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog
        open={!!deleting}
        onOpenChange={(next) => {
          if (!next && !busy) setDeleting(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogTitle>
            {t('workbench.files.deleteTitle')}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {t('workbench.files.deleteDescription')} {deleting?.filePath}
          </AlertDialogDescription>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>
              {t('workbench.files.cancel')}
            </AlertDialogCancel>
            <Button
              variant="destructive"
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  if (deleting)
                    await client.workbench.deleteFile(scope, deleting.filePath);
                  setDeleting(null);
                })
              }
            >
              {t('workbench.files.delete')}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
