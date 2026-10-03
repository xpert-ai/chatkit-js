import * as React from 'react';
import type { XpertWorkspaceFile } from '@xpert-ai/xpert-sdk';
import {
  ChevronDown,
  ChevronRight,
  File,
  FileCode2,
  FileImage,
  FileSpreadsheet,
  FileText,
  Loader2,
} from 'lucide-react';
import { useChatkitTranslation } from '../../i18n/useChatkitTranslation';
import type { DirectoryState } from './useWorkspaceFileTree';
import {
  fileName,
  isFolder,
  previewKind,
  validRelativePath,
} from './workspace-file-utils';

export function WorkspaceFileIcon({ file }: { file: XpertWorkspaceFile }) {
  const kind = previewKind(file);
  const Icon =
    kind === 'markdown' || kind === 'docx'
      ? FileText
      : kind === 'spreadsheet'
        ? FileSpreadsheet
        : kind === 'image'
          ? FileImage
          : kind === 'text' || kind === 'html'
            ? FileCode2
            : File;
  return (
    <Icon
      size={16}
      strokeWidth={1.6}
      className={`shrink-0 ${kind === 'markdown' || kind === 'spreadsheet' ? 'text-primary' : 'text-muted-foreground'}`}
    />
  );
}

export function WorkspaceFileTree({
  rootPath = '',
  directories,
  expanded,
  query,
  selectedPath,
  onToggle,
  onSelect,
  onRetry,
}: {
  rootPath?: string;
  directories: Record<string, DirectoryState>;
  expanded: Set<string>;
  query: string;
  selectedPath?: string;
  onToggle: (path: string) => void;
  onSelect: (file: XpertWorkspaceFile) => void;
  onRetry: (path: string) => void;
}) {
  const { t } = useChatkitTranslation();
  const root = React.useRef<HTMLDivElement>(null);
  const [focused, setFocused] = React.useState('');
  const needle = query.trim().toLocaleLowerCase();
  const children = (path: string) =>
    (directories[path]?.files ?? [])
      .filter(
        (file) =>
          validRelativePath(file.filePath) &&
          file.filePath.split('/').slice(0, -1).join('/') === path,
      )
      .sort(
        (a, b) =>
          Number(isFolder(b)) - Number(isFolder(a)) ||
          fileName(a.filePath).localeCompare(fileName(b.filePath)),
      );
  const matches = (file: XpertWorkspaceFile): boolean =>
    !needle ||
    file.filePath.toLocaleLowerCase().includes(needle) ||
    (isFolder(file) &&
      (!directories[file.filePath] || children(file.filePath).some(matches)));
  type Row = { file: XpertWorkspaceFile; depth: number; open: boolean };
  const rows: Row[] = [];
  function visit(path: string, depth: number) {
    for (const file of children(path).filter(matches)) {
      const open =
        isFolder(file) &&
        (expanded.has(file.filePath) ||
          (!!needle && !!directories[file.filePath]));
      rows.push({ file, depth, open });
      if (open) visit(file.filePath, depth + 1);
    }
  }
  visit(rootPath, 0);
  const rootState = directories[rootPath];
  const tabStop = rows.some(({ file }) => file.filePath === focused)
    ? focused
    : rows[0]?.file.filePath;
  function focus(index: number) {
    root.current
      ?.querySelectorAll<HTMLButtonElement>('[role="treeitem"]')
      [index]?.focus();
  }
  return (
    <div
      ref={root}
      role="tree"
      aria-label={t('workbench.files.tree')}
      aria-busy={!rootState || rootState.loading}
      className="min-h-0 flex-1 overflow-auto px-2 pb-3"
    >
      {(!rootState || rootState.loading) && (
        <div
          role="status"
          className="flex items-center gap-2 p-3 text-xs text-muted-foreground"
        >
          <Loader2 size={14} className="animate-spin" />
          {t('workbench.loading')}
        </div>
      )}
      {rootState?.error && (
        <div role="alert" className="p-3 text-xs text-destructive">
          {rootState.error}
          <button className="ml-2 underline" onClick={() => onRetry(rootPath)}>
            {t('workbench.files.retry')}
          </button>
        </div>
      )}
      {rootState && !rootState.loading && !rootState.error && !rows.length && (
        <p className="p-3 text-sm text-muted-foreground">
          {t(query ? 'workbench.start.noResults' : 'workbench.files.empty')}
        </p>
      )}
      {rows.map(({ file, depth, open }, index) => (
        <React.Fragment key={file.filePath}>
          <button
            type="button"
            role="treeitem"
            aria-level={depth + 1}
            aria-expanded={isFolder(file) ? open : undefined}
            aria-selected={selectedPath === file.filePath}
            tabIndex={file.filePath === tabStop ? 0 : -1}
            onFocus={() => setFocused(file.filePath)}
            title={file.filePath}
            style={{ paddingInlineStart: 10 + depth * 18 }}
            className={`flex min-h-9 w-full items-center gap-2.5 rounded-[var(--chat-item-radius,var(--radius))] py-1.5 pr-2 text-left text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring ${selectedPath === file.filePath ? 'bg-muted font-medium' : 'hover:bg-muted/60'}`}
            onClick={() =>
              isFolder(file) ? onToggle(file.filePath) : onSelect(file)
            }
            onKeyDown={(event) => {
              switch (event.key) {
                case 'ArrowDown':
                  event.preventDefault();
                  focus(Math.min(index + 1, rows.length - 1));
                  break;
                case 'ArrowUp':
                  event.preventDefault();
                  focus(Math.max(index - 1, 0));
                  break;
                case 'Home':
                  event.preventDefault();
                  focus(0);
                  break;
                case 'End':
                  event.preventDefault();
                  focus(rows.length - 1);
                  break;
                case 'ArrowRight':
                  if (isFolder(file)) {
                    event.preventDefault();
                    if (!open) onToggle(file.filePath);
                    else focus(Math.min(index + 1, rows.length - 1));
                  }
                  break;
                case 'ArrowLeft': {
                  event.preventDefault();
                  if (open && !needle) onToggle(file.filePath);
                  else {
                    const parent = file.filePath
                      .split('/')
                      .slice(0, -1)
                      .join('/');
                    const i = rows.findIndex(
                      (row) => row.file.filePath === parent,
                    );
                    if (i >= 0) focus(i);
                  }
                  break;
                }
              }
            }}
          >
            {isFolder(file) ? (
              directories[file.filePath]?.loading ? (
                <Loader2
                  size={16}
                  className="shrink-0 animate-spin text-muted-foreground"
                />
              ) : open ? (
                <ChevronDown
                  size={16}
                  className="shrink-0 text-muted-foreground"
                />
              ) : (
                <ChevronRight
                  size={16}
                  className="shrink-0 text-muted-foreground"
                />
              )
            ) : (
              <WorkspaceFileIcon file={file} />
            )}
            <span className="truncate">{fileName(file.filePath)}</span>
          </button>
          {open && directories[file.filePath]?.error && (
            <p role="alert" className="px-5 py-2 text-xs text-destructive">
              {directories[file.filePath].error}{' '}
              <button
                className="underline"
                onClick={() => onRetry(file.filePath)}
              >
                {t('workbench.files.retry')}
              </button>
            </p>
          )}
          {open &&
            directories[file.filePath] &&
            !directories[file.filePath].loading &&
            !directories[file.filePath].error &&
            children(file.filePath).length === 0 && (
              <p className="px-8 py-2 text-xs text-muted-foreground">
                {t('workbench.files.empty')}
              </p>
            )}
        </React.Fragment>
      ))}
    </div>
  );
}
