import * as React from 'react';
import type { WorkbenchPreview } from './client-command-payload';

export const NEW_TAB_PREFIX = 'chatkit.new-tab:';
export const isWorkbenchNewTab = (key: string | null) =>
  Boolean(key?.startsWith(NEW_TAB_PREFIX));
export type RecentWorkbenchPreview = {
  preview: WorkbenchPreview;
  openedAt: number;
};
type Pages = {
  newTabs: string[];
  previews: WorkbenchPreview[];
  recent: RecentWorkbenchPreview[];
};
const empty: Pages = { newTabs: [], previews: [], recent: [] };

const remember = (
  pages: Pages,
  preview: WorkbenchPreview,
): RecentWorkbenchPreview[] =>
  [
    { preview, openedAt: Date.now() },
    ...pages.recent.filter((item) => item.preview.key !== preview.key),
  ].slice(0, 20);

/** Recent URLs and file evidence stay in memory within the current runtime scope. */
export function useWorkbenchPages(scope: string) {
  const [state, setState] = React.useState<Pages & { scope: string }>({
    scope,
    ...empty,
  });
  const pages = state.scope === scope ? state : empty;
  React.useEffect(() => {
    setState((current) =>
      current.scope === scope ? current : { scope, ...empty },
    );
  }, [scope]);
  const update = React.useCallback(
    (change: (pages: Pages) => Pages) => {
      setState((current) => ({
        scope,
        ...change(current.scope === scope ? current : empty),
      }));
    },
    [scope],
  );

  return {
    ...pages,
    reset: React.useCallback(() => update(() => empty), [update]),
    clearPreviews: React.useCallback(
      () => update((pages) => ({ ...pages, previews: [], recent: [] })),
      [update],
    ),
    addNewTab: React.useCallback(
      (key: string) =>
        update((pages) => ({ ...pages, newTabs: [...pages.newTabs, key] })),
      [update],
    ),
    closeNewTab: React.useCallback(
      (key: string) =>
        update((pages) => ({
          ...pages,
          newTabs: pages.newTabs.filter((item) => item !== key),
        })),
      [update],
    ),
    openPreview: React.useCallback(
      (preview: WorkbenchPreview) =>
        update((pages) => ({
          ...pages,
          previews: pages.previews.some((item) => item.key === preview.key)
            ? pages.previews.map((item) =>
                item.key === preview.key ? preview : item,
              )
            : [...pages.previews, preview],
          recent: remember(pages, preview),
        })),
      [update],
    ),
    closePreview: React.useCallback(
      (key: string) =>
        update((pages) => ({
          ...pages,
          previews: pages.previews.filter((item) => item.key !== key),
        })),
      [update],
    ),
    visitPreview: React.useCallback(
      (key: string) =>
        update((pages) => {
          const preview = pages.previews.find((item) => item.key === key);
          return preview
            ? { ...pages, recent: remember(pages, preview) }
            : pages;
        }),
      [update],
    ),
  };
}
