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
  const [opened, setOpened] = React.useState<{
    scope: string;
    keys: string[];
    closed: string[];
  }>({
    scope: '',
    keys: [],
    closed: [],
  });
  const scopedViews = React.useMemo(
    () =>
      views.filter(
        (view) =>
          !(opened.scope === scope && opened.closed.includes(view.key)) &&
          (view.workbench?.openMode !== 'on-demand' ||
            (opened.scope === scope && opened.keys.includes(view.key))),
      ),
    [views, opened, scope],
  );
  const selectView = React.useCallback(
    (key: string) => {
      setOpened((current) => ({
        scope,
        closed:
          current.scope === scope
            ? current.closed.filter((item) => item !== key)
            : [],
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

  // Closing a tab does not revoke access; it can be opened again from the guide.
  const closeView = React.useCallback(
    (key: string) => {
      setOpened((current) => ({
        scope,
        keys:
          current.scope === scope
            ? current.keys.filter((item) => item !== key)
            : [],
        closed: [...(current.scope === scope ? current.closed : []), key],
      }));
    },
    [scope],
  );

  return { scopedViews, selectView, closeView };
}
