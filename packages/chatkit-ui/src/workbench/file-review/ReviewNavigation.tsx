import * as React from 'react';
import {
  ChevronDown,
  ChevronRight,
  FileCode2,
  FileText,
  File,
  Search,
  Atom,
} from 'lucide-react';
import { countFileChangeLines } from '@xpert-ai/chatkit-types';
import { useChatkitTranslation } from '../../i18n/useChatkitTranslation';
import type { FileReviewEntry } from './types';
import { ReviewStats } from './ReviewPrimitives';

export function ReviewFileIcon({ path }: { path: string }) {
  const ext = path.split('.').pop()?.toLowerCase();
  const Icon =
    ext === 'tsx' || ext === 'jsx'
      ? Atom
      : /^(ts|js|html|css|json|py)$/.test(ext ?? '')
        ? FileCode2
        : ext === 'md'
          ? FileText
          : File;
  return (
    <Icon
      size={17}
      aria-hidden="true"
      className={`shrink-0 ${ext === 'tsx' || ext === 'jsx' ? 'text-cyan-500' : ext === 'ts' ? 'text-blue-500' : ext === 'html' ? 'text-orange-500' : 'text-muted-foreground'}`}
    />
  );
}
export function splitPath(path: string) {
  const slash = path.lastIndexOf('/');
  return { directory: path.slice(0, slash + 1), name: path.slice(slash + 1) };
}
type TreeNode = {
  name: string;
  path: string;
  children: TreeNode[];
  entry?: FileReviewEntry;
};
function buildTree(entries: FileReviewEntry[]): TreeNode[] {
  const root: TreeNode = { name: '', path: '', children: [] };
  for (const entry of entries) {
    const parts = entry.path.split('/').filter(Boolean);
    let current = root;
    for (let index = 0; index < parts.length; index++) {
      const path = parts.slice(0, index + 1).join('/');
      let node = current.children.find(
        (child) => child.path === path && !child.entry,
      );
      if (!node) {
        node = { name: parts[index], path, children: [] };
        current.children.push(node);
      }
      if (index === parts.length - 1) node.entry = entry;
      current = node;
    }
    if (!parts.length)
      root.children.push({
        name: entry.key,
        path: entry.key,
        children: [],
        entry,
      });
  }
  const compact = (nodes: TreeNode[]): TreeNode[] =>
    nodes.map((node) => {
      while (
        !node.entry &&
        node.children.length === 1 &&
        !node.children[0].entry
      ) {
        const child = node.children[0];
        node = { ...child, name: `${node.name}/${child.name}` };
      }
      return { ...node, children: compact(node.children) };
    });
  return compact(root.children);
}
export function ReviewFileTree({
  entries,
  active,
  onSelect,
}: {
  entries: FileReviewEntry[];
  active: string | null;
  onSelect: (key: string) => void;
}) {
  const { t } = useChatkitTranslation();
  const [query, setQuery] = React.useState('');
  const [collapsed, setCollapsed] = React.useState(new Set<string>());
  const filtered = React.useMemo(
    () =>
      entries.filter((entry) =>
        entry.path.toLowerCase().includes(query.trim().toLowerCase()),
      ),
    [entries, query],
  );
  const tree = React.useMemo(() => buildTree(filtered), [filtered]);
  const render = (nodes: TreeNode[], depth = 0): React.ReactNode =>
    nodes.map((node) => {
      const entry = node.entry;
      const count = entry?.report ? countFileChangeLines(entry.report) : null;
      return (
        <li key={entry?.key ?? node.path}>
          <button
            type="button"
            className="review-tree-row"
            style={{ paddingLeft: 8 + depth * 16 }}
            title={entry?.path ?? node.path}
            aria-current={entry && active === entry.key ? 'true' : undefined}
            aria-expanded={
              !entry ? (query ? true : !collapsed.has(node.path)) : undefined
            }
            onClick={() =>
              entry
                ? onSelect(entry.key)
                : setCollapsed((old) => {
                    const next = new Set(old);
                    if (!next.delete(node.path)) next.add(node.path);
                    return next;
                  })
            }
          >
            {entry ? (
              <ReviewFileIcon path={entry.path} />
            ) : collapsed.has(node.path) && !query ? (
              <ChevronRight size={14} />
            ) : (
              <ChevronDown size={14} />
            )}
            <span className="min-w-0 flex-1 truncate">
              {entry && !entry.path
                ? t('workbench.review.selected')
                : node.name}
            </span>
            {count?.status === 'ready' && (
              <ReviewStats added={count.added} removed={count.removed} />
            )}
          </button>
          {!entry && (!collapsed.has(node.path) || query) && (
            <ul>{render(node.children, depth + 1)}</ul>
          )}
        </li>
      );
    });
  return (
    <nav className="review-tree" aria-label={t('workbench.review.files')}>
      <label className="review-search">
        <Search size={16} />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t('workbench.review.filter')}
          aria-label={t('workbench.review.filter')}
        />
      </label>
      <ul>{render(tree)}</ul>
      {!filtered.length && (
        <p className="p-3 text-sm text-muted-foreground">
          {t('workbench.review.noMatches')}
        </p>
      )}
    </nav>
  );
}
export function ReviewJumpList({
  entries,
  onSelect,
}: {
  entries: FileReviewEntry[];
  onSelect: (key: string) => void;
}) {
  const { t } = useChatkitTranslation();
  const [query, setQuery] = React.useState('');
  const [selected, setSelected] = React.useState(0);
  const id = React.useId();
  const filtered = entries.filter((entry) =>
    entry.path.toLowerCase().includes(query.trim().toLowerCase()),
  );
  return (
    <div>
      <label className="review-search border-0">
        <Search size={17} />
        <input
          autoFocus
          role="combobox"
          aria-expanded="true"
          aria-controls={id}
          aria-activedescendant={
            filtered[selected] ? `${id}-${selected}` : undefined
          }
          aria-label={t('workbench.review.jump')}
          placeholder={t('workbench.review.jump')}
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setSelected(0);
          }}
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
              event.preventDefault();
              setSelected(
                (value) =>
                  (value +
                    (event.key === 'ArrowDown' ? 1 : -1) +
                    filtered.length) %
                  Math.max(1, filtered.length),
              );
            }
            if (event.key === 'Enter' && filtered[selected]) {
              event.preventDefault();
              onSelect(filtered[selected].key);
            }
          }}
        />
      </label>
      <ul
        id={id}
        role="listbox"
        aria-label={t('workbench.review.files')}
        className="max-h-72 overflow-auto"
      >
        {filtered.map((entry, index) => {
          const path = splitPath(entry.path);
          return (
            <li
              id={`${id}-${index}`}
              key={entry.key}
              role="option"
              aria-selected={index === selected}
            >
              <button
                type="button"
                className={`review-jump-row ${selected === index ? 'bg-muted' : ''}`}
                onClick={() => onSelect(entry.key)}
                onMouseEnter={() => setSelected(index)}
              >
                <span className="shrink-0">
                  {path.name || t('workbench.review.selected')}
                </span>
                <span className="truncate text-muted-foreground">
                  {path.directory.replace(/\/$/, '')}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      {!filtered.length && (
        <p className="p-3 text-sm text-muted-foreground">
          {t('workbench.review.noMatches')}
        </p>
      )}
    </div>
  );
}
