import * as React from 'react';
import type {
  Client,
  WorkspaceFileScope,
  XpertWorkspaceFile,
} from '@xpert-ai/xpert-sdk';
import { normalizeWorkspaceFiles } from './workspace-file-utils';

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
      void client.workbench
        .listFiles(scope, path, { signal: abort.signal })
        .then((files) => {
          if (!abort.signal.aborted)
            setDirectories((current) => ({
              ...current,
              [path]: {
                files: normalizeWorkspaceFiles(files, path),
                loading: false,
              },
            }));
        })
        .catch((error: unknown) => {
          if (!abort.signal.aborted)
            setDirectories((current) => ({
              ...current,
              [path]: {
                files: current[path]?.files ?? [],
                loading: false,
                error: error instanceof Error ? error.message : failure,
              },
            }));
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
  return {
    directories,
    expanded,
    refresh,
    load,
    reveal,
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
