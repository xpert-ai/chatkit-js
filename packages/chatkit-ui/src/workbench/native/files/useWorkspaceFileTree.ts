import * as React from 'react';
import type {
  Client,
  WorkspaceFileScope,
  XpertWorkspaceFile,
} from '@xpert-ai/xpert-sdk';
import { isFolder, normalizeWorkspaceFiles } from './workspace-file-utils';

export type DirectoryState = {
  files: XpertWorkspaceFile[];
  loading: boolean;
  error?: string;
};

/** The parent keys this session by scope, so results never cross workspace boundaries. */
export function useWorkspaceFileTree(
  client: Client,
  scope: WorkspaceFileScope,
  revision: number,
  failure: string,
) {
  const [directories, setDirectories] = React.useState<
    Record<string, DirectoryState>
  >({});
  const [expanded, setExpanded] = React.useState<Set<string>>(() => new Set());
  const requests = React.useRef(new Map<string, AbortController>());
  const expandedRef = React.useRef(expanded);
  expandedRef.current = expanded;
  const scopeKey = JSON.stringify(scope);
  const load = React.useCallback(
    (path: string) => {
      requests.current.get(path)?.abort();
      const abort = new AbortController();
      requests.current.set(path, abort);
      setDirectories((current) => ({
        ...current,
        [path]: { files: current[path]?.files ?? [], loading: true },
      }));
      return client.workbench
        .listFiles(scope, path, { signal: abort.signal })
        .then((files) => {
          if (abort.signal.aborted) return null;
          const normalized = normalizeWorkspaceFiles(files, path);
          setDirectories((current) => ({
            ...current,
            [path]: {
              files: normalized,
              loading: false,
            },
          }));
          return { files: normalized };
        })
        .catch((error: unknown) => {
          if (abort.signal.aborted) return null;
          const message = error instanceof Error ? error.message : failure;
          setDirectories((current) => ({
            ...current,
            [path]: {
              files: current[path]?.files ?? [],
              loading: false,
              error: message,
            },
          }));
          return { error: message };
        })
        .finally(() => {
          if (requests.current.get(path) === abort)
            requests.current.delete(path);
        });
    },
    [client, scopeKey, failure],
  );
  const refresh = React.useCallback(() => {
    // Invalidate collapsed folders too; opening them later must not show a stale cache.
    requests.current.forEach((abort) => abort.abort());
    requests.current.clear();
    setDirectories({});
    load('');
    expandedRef.current.forEach(load);
  }, [load]);
  React.useEffect(() => {
    refresh();
    return () => {
      requests.current.forEach((abort) => abort.abort());
      requests.current.clear();
    };
  }, [refresh, revision]);
  const reveal = React.useCallback(
    (path: string) => {
      const parts = path.split('/').filter(Boolean);
      const parents = parts.map((_, i) => parts.slice(0, i + 1).join('/'));
      setExpanded((current) => new Set([...current, ...parents]));
      for (const parent of parents) if (!directories[parent]) load(parent);
    },
    [directories, load],
  );
  const locate = async (
    path: string,
    signal: AbortSignal,
  ): Promise<XpertWorkspaceFile | null> => {
    const parts = path.split('/').filter(Boolean);
    const parents: string[] = [];
    let directory = '';
    let target: XpertWorkspaceFile = { filePath: '', fileType: 'directory' };
    for (const [index, part] of parts.entries()) {
      const result = await load(directory);
      if (signal.aborted || !result) return null;
      if ('error' in result) throw new Error(result.error);
      const nextPath = [directory, part].filter(Boolean).join('/');
      const file = result.files.find((file) => file.filePath === nextPath);
      if (!file || (index < parts.length - 1 && !isFolder(file))) return null;
      parents.push(directory);
      directory = nextPath;
      target = file;
    }
    if (isFolder(target)) {
      const result = await load(target.filePath);
      if (signal.aborted || !result) return null;
      if ('error' in result) throw new Error(result.error);
      parents.push(target.filePath);
    }
    if (!signal.aborted)
      setExpanded((current) => new Set([...current, ...parents]));
    return target;
  };
  return {
    directories,
    expanded,
    refresh,
    load,
    reveal,
    locate,
    toggle: (path: string) => {
      const opening = !expanded.has(path);
      setExpanded((current) => {
        const next = new Set(current);
        if (opening) next.add(path);
        else next.delete(path);
        return next;
      });
      if (opening && !directories[path]) load(path);
    },
  };
}
