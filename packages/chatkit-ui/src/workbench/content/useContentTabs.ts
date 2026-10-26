import * as React from 'react';
import type { ContentClient, ContentScope, XpertViewQuery, XpertExtensionViewManifest } from '@xpert-ai/xpert-sdk';
import { contentTabKey } from './tab-identity';
import { readContentTabs, writeContentTabs } from './tab-storage';

export function useContentTabs(options: {
  scope: string;
  enabled: boolean;
  ready: boolean;
  api?: ContentClient;
  contentScope?: ContentScope;
  views: XpertExtensionViewManifest[];
  keys: string[];
  queries: Record<string, XpertViewQuery>;
  restore: (queries: Record<string, XpertViewQuery>) => void;
}) {
  const { scope, enabled, ready, api, contentScope } = options;
  const latest = React.useRef(options);
  latest.current = options;
  const [restored, setRestored] = React.useState<string | null>(null);
  React.useEffect(() => {
    if (!enabled || !ready || !api || !contentScope || restored === scope) return;
    let cancelled = false;
    void Promise.all(readContentTabs(scope).map(async (reference) => {
      try {
        const result = await api.resolve(contentScope, {
          providerKey: 'platform.content.catalog', resourceId: reference.contentId,
          ...(reference.editorKey ? { editorKey: reference.editorKey } : {}),
        });
        if (!latest.current.views.some((view) => view.key === result.viewKey)) return null;
        const query = { selectionId: result.selectionId, parameters: result.parameters };
        return [contentTabKey(result.viewKey, query), query] as const;
      } catch { return null; } // Revoked/deleted/uninstalled resources are not restored from stale metadata.
    })).then((entries) => {
      if (cancelled) return;
      latest.current.restore(Object.fromEntries(entries.filter((entry) => entry !== null)));
      setRestored(scope);
    });
    return () => { cancelled = true; };
  }, [scope, enabled, ready, api, contentScope?.projectId, contentScope?.assistantId, restored]);
  React.useEffect(() => {
    if (enabled && restored === scope) writeContentTabs(scope, options.keys, options.queries);
  }, [scope, enabled, restored, options.keys, options.queries]);
}
