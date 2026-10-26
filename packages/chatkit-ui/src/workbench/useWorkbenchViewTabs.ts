import { useContentTabs } from './content/useContentTabs';
import type { ContentClient, ContentScope } from '@xpert-ai/xpert-sdk';
import { contentTabKey, contentViewKey } from './content/tab-identity';
import * as React from 'react';
import type {
  XpertExtensionViewManifest,
  XpertViewQuery,
} from '@xpert-ai/xpert-sdk';
import { useWorkbenchOpenRequest } from './useWorkbenchOpenRequest';

/** Keep available views separate from open tabs, scoped to the current workspace. */
export function useWorkbenchViewTabs(options: {
  views: XpertExtensionViewManifest[];
  contentApi?: ContentClient;
  contentScope?: ContentScope;
  queries: Record<string, XpertViewQuery>;
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
  const { views, onSelect, onOpen, setQueries } = options;
  const scope = JSON.stringify([options.scope, options.projectId]);
  const [opened, setOpened] = React.useState<{
    scope: string;
    keys: string[];
    closed: string[];
  }>({
    scope: '',
    keys: [],
    closed: [],
  });
  useContentTabs({
    scope, enabled: options.enabled,
    ready: options.ready, api: options.contentApi, contentScope: options.contentScope,
    views, keys: opened.scope === scope ? opened.keys : [], queries: options.queries,
    restore: (queries) => {
      setQueries((current) => ({ ...current, ...queries }));
      setOpened((current) => ({ scope,
        keys: [...new Set([...Object.keys(queries), ...(current.scope === scope ? current.keys : [])])],
        closed: current.scope === scope ? current.closed : [],
      }));
    },
  });
  const scopedViews = React.useMemo(
    () =>
      [...views, ...(opened.scope === scope ? opened.keys : []).flatMap((key) => {
        const source = contentViewKey(key);
        const view = source !== key ? views.find((item) => item.key === source) : undefined;
        return view ? [{ ...view, key }] : [];
      })].filter(
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
        const query = {
          ...(request.selectionId ? { selectionId: request.selectionId } : {}),
          ...(request.parameters ? { parameters: request.parameters } : {}),
        };
        const key = contentTabKey(request.viewKey, query);
        setQueries((current) => ({
          ...current,
          [key]: {
            ...(request.selectionId
              ? { selectionId: request.selectionId }
              : {}),
            ...(request.parameters ? { parameters: request.parameters } : {}),
          },
        }));
        selectView(key);
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
