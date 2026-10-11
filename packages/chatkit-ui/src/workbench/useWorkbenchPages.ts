import * as React from 'react';
import type { WorkbenchPreview } from './preview/types';

export const NEW_TAB_PREFIX = 'chatkit.new-tab:';
export const isWorkbenchNewTab = (key: string | null) =>
  Boolean(key?.startsWith(NEW_TAB_PREFIX));
export type RecentWorkbenchPreview = {
  preview: WorkbenchPreview;
  openedAt: number;
};
export type WorkbenchBrowserHistory = {
  entries: (WorkbenchPreview | null)[];
  index: number;
};
type Pages = {
  newTabs: string[];
  previews: WorkbenchPreview[];
  recent: RecentWorkbenchPreview[];
  browserHistory: Record<string, WorkbenchBrowserHistory>;
};
const empty: Pages = {
  newTabs: [],
  previews: [],
  recent: [],
  browserHistory: {},
};

const remember = (
  pages: Pages,
  preview: WorkbenchPreview,
): RecentWorkbenchPreview[] => {
  const item =
    preview.kind === 'browser'
      ? { ...preview, key: `chatkit.preview.browser:${preview.url}` }
      : preview;
  return [
    { preview: item, openedAt: Date.now() },
    ...pages.recent.filter((recent) => recent.preview.key !== item.key),
  ].slice(0, 20);
};

function displayBrowser(
  pages: Pages,
  key: string,
  history: WorkbenchBrowserHistory,
): Pages {
  const entry = history.entries[history.index];
  return {
    ...pages,
    newTabs: entry
      ? pages.newTabs.filter((item) => item !== key)
      : [...new Set([...pages.newTabs, key])],
    previews: entry
      ? pages.previews.some((item) => item.key === key)
        ? pages.previews.map((item) =>
            item.key === key ? { ...entry, key } : item,
          )
        : [...pages.previews, { ...entry, key }]
      : pages.previews.filter((item) => item.key !== key),
    recent: entry ? remember(pages, entry) : pages.recent,
    browserHistory: { ...pages.browserHistory, [key]: history },
  };
}

function withoutHistory(pages: Pages, key: string) {
  const history = { ...pages.browserHistory };
  delete history[key];
  return history;
}

/** Keep browser navigation in the workspace; file evidence belongs to its conversation. */
export function useWorkbenchPages(scope: string, contentScope = scope) {
  const [state, setState] = React.useState<
    Pages & { scope: string; contentScope: string }
  >({
    scope,
    contentScope,
    ...empty,
  });
  const pages = React.useMemo(
    () =>
      state.scope !== scope
        ? empty
        : state.contentScope === contentScope
          ? state
          : retainBrowserPages(state),
    [state, scope, contentScope],
  );
  React.useEffect(() => {
    setState((current) =>
      current.scope !== scope
        ? { scope, contentScope, ...empty }
        : current.contentScope === contentScope
          ? current
          : { scope, contentScope, ...retainBrowserPages(current) },
    );
  }, [scope, contentScope]);
  const update = React.useCallback(
    (change: (pages: Pages) => Pages) => {
      setState((current) => ({
        scope,
        contentScope,
        ...change(
          current.scope !== scope
            ? empty
            : current.contentScope === contentScope
              ? current
              : retainBrowserPages(current),
        ),
      }));
    },
    [scope, contentScope],
  );

  return {
    ...pages,
    reset: React.useCallback(() => update(() => empty), [update]),
    clearPreviews: React.useCallback(
      () =>
        update((pages) => {
          const newTabs = [
            ...new Set([
              ...pages.newTabs,
              ...pages.previews
                .filter((preview) => isWorkbenchNewTab(preview.key))
                .map((preview) => preview.key),
            ]),
          ];
          return {
            ...pages,
            newTabs,
            previews: [],
            recent: [],
            browserHistory: Object.fromEntries(
              newTabs.map((key) => [key, { entries: [null], index: 0 }]),
            ),
          };
        }),
      [update],
    ),
    addNewTab: React.useCallback(
      (key: string) =>
        update((pages) => ({
          ...pages,
          newTabs: [...pages.newTabs, key],
          browserHistory: {
            ...pages.browserHistory,
            [key]: { entries: [null], index: 0 },
          },
        })),
      [update],
    ),
    closeNewTab: React.useCallback(
      (key: string) =>
        update((pages) => ({
          ...pages,
          newTabs: pages.newTabs.filter((item) => item !== key),
          browserHistory: withoutHistory(pages, key),
        })),
      [update],
    ),
    openPreview: React.useCallback(
      (preview: WorkbenchPreview) =>
        update((pages) => ({
          ...pages,
          newTabs: pages.newTabs.filter((key) => key !== preview.key),
          previews: pages.previews.some((item) => item.key === preview.key)
            ? pages.previews.map((item) =>
                item.key === preview.key ? preview : item,
              )
            : [...pages.previews, preview],
          recent: remember(pages, preview),
          browserHistory:
            preview.kind === 'browser'
              ? {
                  ...pages.browserHistory,
                  [preview.key]: { entries: [null, preview], index: 1 },
                }
              : pages.browserHistory,
        })),
      [update],
    ),
    closePreview: React.useCallback(
      (key: string) =>
        update((pages) => ({
          ...pages,
          previews: pages.previews.filter((item) => item.key !== key),
          browserHistory: withoutHistory(pages, key),
        })),
      [update],
    ),
    navigateBrowser: React.useCallback(
      (key: string, preview: WorkbenchPreview | null) =>
        update((pages) => {
          const history = pages.browserHistory[key];
          if (!history) return pages;
          const entries = [
            ...history.entries.slice(0, history.index + 1),
            preview,
          ].slice(-50);
          return displayBrowser(pages, key, {
            entries,
            index: entries.length - 1,
          });
        }),
      [update],
    ),
    moveBrowser: React.useCallback(
      (key: string, delta: number) =>
        update((pages) => {
          const history = pages.browserHistory[key];
          if (!history) return pages;
          const index = history.index + delta;
          if (index < 0 || index >= history.entries.length) return pages;
          return displayBrowser(pages, key, { ...history, index });
        }),
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

function retainBrowserPages(pages: Pages): Pages {
  const previews = pages.previews.filter(
    (preview) => preview.kind === 'browser',
  );
  const keys = new Set([
    ...pages.newTabs,
    ...previews.map((preview) => preview.key),
  ]);
  return {
    newTabs: pages.newTabs,
    previews,
    recent: pages.recent.filter(({ preview }) => preview.kind === 'browser'),
    browserHistory: Object.fromEntries(
      Object.entries(pages.browserHistory)
        .filter(([key]) => keys.has(key))
        .map(([key, history]) => [
          key,
          {
            entries: history.entries.filter(
              (entry) => !entry || entry.kind === 'browser',
            ),
            index:
              history.entries
                .slice(0, history.index + 1)
                .filter((entry) => !entry || entry.kind === 'browser').length -
              1,
          },
        ]),
    ),
  };
}
