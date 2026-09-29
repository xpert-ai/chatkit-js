import * as React from 'react';
import type {
  XpertExtensionViewManifest,
  XpertViewQuery,
} from '@xpert-ai/xpert-sdk';
import { useWorkbenchOpenRequest } from './useWorkbenchOpenRequest';

/** Keep available views separate from open tabs, scoped to the current workspace. */
export function useWorkbenchViewTabs(options: {
  views: XpertExtensionViewManifest[];
  scope: string;
  enabled: boolean;
  ready: boolean;
  projectId?: string | null;
  conversationId?: string | null;
  onSelect: (key: string | null) => void;
  onOpen: (open: boolean) => void;
  setQueries: React.Dispatch<
    React.SetStateAction<Record<string, XpertViewQuery>>
  >;
}) {
  const { views, scope, onSelect, onOpen, setQueries } = options;
  const [opened, setOpened] = React.useState<{ scope: string; keys: string[] }>(
    {
      scope: '',
      keys: [],
    },
  );
  const scopedViews = React.useMemo(
    () =>
      views.filter(
        (view) =>
          view.workbench?.openMode !== 'on-demand' ||
          (opened.scope === scope && opened.keys.includes(view.key)),
      ),
    [views, opened, scope],
  );
  const selectView = React.useCallback(
    (key: string) => {
      setOpened((current) => ({
        scope,
        keys: Array.from(
          new Set([...(current.scope === scope ? current.keys : []), key]),
        ),
      }));
      onSelect(key);
    },
    [scope, onSelect],
  );

  useWorkbenchOpenRequest({
    enabled: options.enabled,
    ready: options.ready,
    projectId: options.projectId,
    conversationId: options.conversationId,
    open: React.useCallback(
      (request) => {
        if (!views.some((view) => view.key === request.viewKey)) return false;
        setQueries((current) => ({
          ...current,
          [request.viewKey]: {
            ...(request.selectionId
              ? { selectionId: request.selectionId }
              : {}),
            ...(request.parameters ? { parameters: request.parameters } : {}),
          },
        }));
        selectView(request.viewKey);
        onOpen(true);
        return true;
      },
      [views, selectView, setQueries, onOpen],
    ),
  });

  // Auto-open views preserve their existing panel-close behavior. On-demand views
  // leave the tab list; the caller closes the panel if no other tab remains.
  const closeView = React.useCallback(
    (key: string) => {
      if (
        views.find((view) => view.key === key)?.workbench?.openMode !==
        'on-demand'
      )
        return true;
      setOpened((current) => ({
        ...current,
        keys: current.keys.filter((item) => item !== key),
      }));
      const next = scopedViews.find((view) => view.key !== key)?.key ?? null;
      onSelect(next);
      return !next;
    },
    [views, scopedViews, onSelect],
  );

  return { scopedViews, selectView, closeView };
}
