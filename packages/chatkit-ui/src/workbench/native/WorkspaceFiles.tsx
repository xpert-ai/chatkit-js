import * as React from 'react';
import type {
  Client,
  WorkspaceFileScope,
  XpertWorkspaceFile,
} from '@xpert-ai/xpert-sdk';
import {
  ChevronRight,
  Download,
  FilePlus2,
  Folders,
  MoreHorizontal,
  Pencil,
  RefreshCw,
  Search,
  Trash2,
  Upload,
} from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../../components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
} from '../../components/ui/alert-dialog';
import { useChatkitTranslation } from '../../i18n/useChatkitTranslation';
import { WorkspaceFilePreview } from './WorkspaceFilePreview';
import { WorkspaceFileTree } from './WorkspaceFileTree';
import { useWorkspaceFileTree } from './useWorkspaceFileTree';
import {
  downloadBlob,
  fileName,
  isFolder,
  isOfficeFile,
  normalizeWorkspaceFiles,
  previewKind,
  validRelativePath,
} from './workspace-file-utils';
import './workspace-files.css';
export {
  downloadBlob,
  fileName,
  isFolder,
  validRelativePath,
} from './workspace-file-utils';

type Props = {
  client: Client;
  scope: WorkspaceFileScope | null;
  onOpen: (file: XpertWorkspaceFile) => void;
  revision?: number;
  onPreview?: (file: XpertWorkspaceFile | null) => void;
};
export function WorkspaceFiles(props: Props) {
  const { t } = useChatkitTranslation();
  return props.scope ? (
    <WorkspaceFilesSession
      key={JSON.stringify(props.scope)}
      {...props}
      scope={props.scope}
    />
  ) : (
    <p className="p-6 text-sm text-muted-foreground">
      {t('workbench.start.conversationRequired')}
    </p>
  );
}
function WorkspaceFilesSession({
  client,
  scope,
  onOpen,
  onPreview,
  revision = 0,
}: Props & { scope: WorkspaceFileScope }) {
  const { t } = useChatkitTranslation();
  const [path, setPath] = React.useState('');
  const [selected, setSelected] = React.useState<XpertWorkspaceFile | null>(
    null,
  );
  const [source, setSource] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const [sidebar, setSidebar] = React.useState(true);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState('');
  const [version, bumpVersion] = React.useReducer((n) => n + 1, 0);
  const [create, setCreate] = React.useState(false);
  const [name, setName] = React.useState('');
  const [deleting, setDeleting] = React.useState<XpertWorkspaceFile | null>(
    null,
  );
  const input = React.useRef<HTMLInputElement>(null);
  const container = React.useRef<HTMLDivElement>(null);
  const alive = React.useRef(true);
  React.useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const tree = useWorkspaceFileTree(
    client,
    scope,
    revision + version,
    t('workbench.files.failed'),
  );
  const files = tree.directories[path]?.files ?? [];
  const loading = tree.directories['']?.loading;
  const currentPath = selected?.filePath ?? path;
  const segments = currentPath.split('/').filter(Boolean);
  const kind = selected ? previewKind(selected) : null;
  const itemButton =
    'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--chat-item-radius,var(--radius))] text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-40';
  function refresh() {
    bumpVersion();
  }
  function select(file: XpertWorkspaceFile) {
    if (isOfficeFile(file)) {
      onOpen(file);
      return;
    }
    setSelected(file);
    setPath(file.filePath.split('/').slice(0, -1).join('/'));
    setSource(false);
    onPreview?.(file);
    const width = container.current?.getBoundingClientRect().width ?? 0;
    if (width > 0 && width <= 600) setSidebar(false);
  }
  function navigate(folder: string) {
    setPath(folder);
    setSelected(null);
    onPreview?.(null);
    tree.reveal(folder);
    setSidebar(true);
  }
  async function run(action: () => Promise<void>, refreshAfter = true) {
    setBusy(true);
    setError('');
    try {
      await action();
      if (alive.current && refreshAfter) refresh();
    } catch (error) {
      if (alive.current)
        setError(
          error instanceof Error ? error.message : t('workbench.files.failed'),
        );
    } finally {
      if (alive.current) setBusy(false);
    }
  }
  const download = () =>
    void run(async () => {
      const target =
        selected ?? (path ? { filePath: path, hasChildren: true } : null);
      if (target)
        downloadBlob(
          await client.workbench.downloadFile(scope, target.filePath),
          fileName(target.filePath) + (isFolder(target) ? '.zip' : ''),
        );
    }, false);
  return (
    <div
      ref={container}
      className="workspace-files flex h-full min-h-0 flex-col bg-background text-foreground"
    >
      <header className="flex h-12 shrink-0 items-center gap-1.5 border-b px-3">
        <nav
          aria-label={t('workbench.files.breadcrumb')}
          className="flex min-w-0 flex-1 items-center gap-1 overflow-hidden text-sm"
        >
          <button
            className="shrink-0 rounded-[var(--chat-item-radius,var(--radius))] px-1 py-1 text-muted-foreground hover:bg-muted"
            aria-label={t('workbench.files.root')}
            onClick={() => navigate('')}
          >
            /
          </button>
          {segments.map((segment, index) => (
            <React.Fragment key={index}>
              {index > 0 && (
                <ChevronRight
                  size={14}
                  className="shrink-0 text-muted-foreground"
                />
              )}
              <button
                className={`min-w-0 truncate rounded-[var(--chat-item-radius,var(--radius))] px-1 py-1 hover:bg-muted ${index === segments.length - 1 ? 'font-medium' : 'text-muted-foreground'}`}
                title={segments.slice(0, index + 1).join('/')}
                aria-current={
                  index === segments.length - 1 ? 'page' : undefined
                }
                onClick={() => {
                  if (!(selected && index === segments.length - 1))
                    navigate(segments.slice(0, index + 1).join('/'));
                }}
              >
                {segment}
              </button>
            </React.Fragment>
          ))}
        </nav>
        {(kind === 'markdown' || kind === 'html') && (
          <button
            className="shrink-0 rounded-[var(--chat-item-radius,var(--radius))] px-2 py-1.5 text-xs font-medium hover:bg-muted"
            onClick={() => setSource((value) => !value)}
          >
            {t(
              source ? 'workbench.files.preview' : 'workbench.files.viewSource',
            )}
          </button>
        )}
        <button
          className={`${itemButton} ${sidebar ? 'bg-muted/60' : ''}`}
          aria-label={t('workbench.files.toggleTree')}
          title={t('workbench.files.toggleTree')}
          aria-expanded={sidebar}
          onClick={() => setSidebar((value) => !value)}
        >
          <Folders size={18} />
        </button>
        {selected && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpen(selected)}
            title={t('workbench.files.openEditor')}
          >
            <Pencil size={14} />
            <span className="workspace-files-edit-label">
              {t('workbench.files.openEditor')}
            </span>
          </Button>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className={itemButton}
              disabled={busy}
              aria-label={t('workbench.files.actions')}
              title={t('workbench.files.actions')}
            >
              <MoreHorizontal size={18} />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="w-48 rounded-[var(--chat-item-radius,var(--radius))]"
          >
            <DropdownMenuItem onSelect={refresh} disabled={loading}>
              <RefreshCw />
              {t('workbench.files.refresh')}
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() => {
                setName('');
                setCreate(true);
              }}
            >
              <FilePlus2 />
              {t('workbench.files.newFile')}
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => input.current?.click()}>
              <Upload />
              {t('workbench.files.upload')}
            </DropdownMenuItem>
            {(selected || path) && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={download}>
                  <Download />
                  {t('workbench.files.download')}
                </DropdownMenuItem>
                <DropdownMenuItem
                  variant="destructive"
                  onSelect={() =>
                    setDeleting(
                      selected ?? { filePath: path, hasChildren: true },
                    )
                  }
                >
                  <Trash2 />
                  {t('workbench.files.delete')}
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
        <input
          ref={input}
          aria-label={t('workbench.files.upload')}
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
      </header>
      {error && (
        <p role="alert" className="border-b px-4 py-2 text-sm text-destructive">
          {error}
        </p>
      )}
      {busy && (
        <p role="status" className="px-4 py-1 text-xs text-muted-foreground">
          {t('workbench.loading')}
        </p>
      )}
      <div className="relative flex min-h-0 flex-1">
        <section
          aria-label={t('workbench.files.preview')}
          className="min-h-0 min-w-0 flex-1 overflow-hidden"
        >
          <WorkspaceFilePreview
            key={selected?.filePath ?? 'empty'}
            client={client}
            scope={scope}
            file={selected}
            source={source}
            revision={revision + version}
          />
        </section>
        {sidebar && (
          <>
            <button
              className="workspace-files-backdrop"
              aria-label={t('workbench.files.hideTree')}
              onClick={() => setSidebar(false)}
            />
            <aside
              className="workspace-files-sidebar flex min-h-0 shrink-0 flex-col border-l bg-background"
              aria-label={t('workbench.files.tree')}
            >
              <div className="relative mx-3 mt-3 mb-2">
                <Search
                  size={15}
                  className="pointer-events-none absolute top-2.5 left-3 text-muted-foreground"
                />
                <Input
                  type="search"
                  className="h-9 rounded-[var(--chat-item-radius,var(--radius))] pl-9 shadow-none"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={t('workbench.files.search')}
                  aria-label={t('workbench.files.search')}
                />
              </div>
              <WorkspaceFileTree
                directories={tree.directories}
                expanded={tree.expanded}
                query={query}
                selectedPath={selected?.filePath ?? path}
                onRetry={tree.load}
                onToggle={(folder) => {
                  tree.toggle(folder);
                  setPath(folder);
                  setSelected(null);
                  onPreview?.(null);
                }}
                onSelect={select}
              />
            </aside>
          </>
        )}
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
                  let siblings = normalizeWorkspaceFiles(
                    await client.workbench.listFiles(scope, parent),
                    parent,
                  );
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
                    siblings = normalizeWorkspaceFiles(
                      await client.workbench.listFiles(scope, parent),
                      parent,
                    );
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
                  if (alive.current) {
                    setCreate(false);
                    onOpen({ ...created, filePath });
                  }
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
                  if (alive.current) {
                    setDeleting(null);
                    setSelected(null);
                    onPreview?.(null);
                    setPath('');
                  }
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
