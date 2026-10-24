import type { EditorLifecycle } from '../editors/editor-lifecycle';
import * as React from 'react';
import type { XpertWorkspaceFile } from '@xpert-ai/xpert-sdk';

export type NativeTool = 'files' | 'terminal' | 'side-chat';
export type NativeTab = { key: string } & (
  | { kind: 'files'; preview?: XpertWorkspaceFile }
  | { kind: 'terminal' }
  | { kind: 'file'; file: XpertWorkspaceFile }
);
export type RecentWorkspaceFile = {
  file: XpertWorkspaceFile;
  openedAt: number;
};
export type FileEditorHandle = { dirty: boolean; save: () => Promise<void> };
export const NATIVE_PREFIX = 'chatkit.native.resource:';
export const nativeFileKey = (path: string) => `${NATIVE_PREFIX}file:${path}`;
const empty = { tabs: [] as NativeTab[], recent: [] as RecentWorkspaceFile[] };

export function useNativeWorkbench(scope: string, editors: EditorLifecycle) {
  const [state, setState] = React.useState({ scope, ...empty });
  const [pending, setPending] = React.useState<string | null>(null);
  // Keep native save callbacks here; dirty state belongs exclusively to the shared coordinator.
  const handles = React.useMemo(
    () => ({ scope, saves: new Map<string, FileEditorHandle['save']>() }),
    [scope],
  );
  const dirtyTabs = React.useSyncExternalStore(
    editors.subscribe,
    editors.getDirtyTabs,
    editors.getDirtyTabs,
  );
  const dirty = dirtyTabs.filter((key) => handles.saves.has(key));
  const generation = React.useRef(scope);
  generation.current = scope;
  React.useEffect(() => {
    setState({ scope, ...empty });
    setPending(null);
    return () => {
      // Scope-qualified registration prevents a late old editor cleanup from clearing its replacement.
      for (const key of handles.saves.keys())
        editors.register(nativeEditorId(scope, key), null);
      handles.saves.clear();
    };
  }, [scope, handles, editors]);
  const update = React.useCallback(
    (change: (data: typeof empty) => typeof empty) => {
      setState((current) => ({
        scope,
        ...change(current.scope === scope ? current : empty),
      }));
    },
    [scope],
  );
  const register = React.useCallback(
    (key: string, handle: FileEditorHandle | null) => {
      if (handle && generation.current !== scope) return;
      if (handle) handles.saves.set(key, handle.save);
      else handles.saves.delete(key);
      editors.register(
        nativeEditorId(scope, key),
        handle
          ? {
              tabKey: key,
              dirty: handle.dirty,
              prepare: async () => {
                await handle.save();
                return true;
              },
            }
          : null,
      );
    },
    [editors, handles, scope],
  );
  const open = React.useCallback(
    (tab: NativeTab) => {
      update((data) => ({
        tabs: data.tabs.some((item) => item.key === tab.key)
          ? data.tabs
          : [...data.tabs, tab],
        recent:
          tab.kind === 'file'
            ? [
                { file: tab.file, openedAt: Date.now() },
                ...data.recent.filter(
                  (item) => item.file.filePath !== tab.file.filePath,
                ),
              ].slice(0, 30)
            : data.recent,
      }));
      return tab.key;
    },
    [update],
  );
  const remove = React.useCallback(
    (key: string) => {
      update((data) => ({
        ...data,
        tabs: data.tabs.filter((tab) => tab.key !== key),
      }));
      register(key, null);
      setPending(null);
    },
    [update, register],
  );
  return {
    ...(state.scope === scope ? state : empty),
    dirty,
    pending,
    setPending,
    register,
    openTool: (kind: 'files' | 'terminal') =>
      open({ key: `${NATIVE_PREFIX}${kind}`, kind }),
    openFile: (file: XpertWorkspaceFile) =>
      open({ key: nativeFileKey(file.filePath), kind: 'file', file }),
    previewFile: (file: XpertWorkspaceFile | null) =>
      update((data) => ({
        tabs: data.tabs.map((tab) =>
          tab.kind === 'files' ? { ...tab, preview: file ?? undefined } : tab,
        ),
        recent: file
          ? [
              { file, openedAt: Date.now() },
              ...data.recent.filter(
                (item) => item.file.filePath !== file.filePath,
              ),
            ].slice(0, 30)
          : data.recent,
      })),
    requestClose: (key: string) => {
      if (editors.isDirty(key)) {
        setPending(key);
        return false;
      }
      remove(key);
      return true;
    },
    discard: remove,
    saveAndClose: async (key: string) => {
      const startScope = scope;
      await handles.saves.get(key)?.();
      if (generation.current !== startScope) return false;
      remove(key);
      return true;
    },
  };
}

function nativeEditorId(scope: string, key: string) {
  return JSON.stringify(['native', scope, key]);
}
