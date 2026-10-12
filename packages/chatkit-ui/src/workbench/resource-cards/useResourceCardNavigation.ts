import * as React from 'react';
import {
  parseResourceCard,
  type ResourceCardOpenTarget,
} from '@xpert-ai/chatkit-types';

// Ignore legacy entries: they did not bind selections to a project or conversation.
const stateKey = 'xpertResourceCardV2';
const storageKey = (scope: string) => `${stateKey}:${scope}`;
type NavigationEntry = {
  target: ResourceCardOpenTarget | null;
  conversationId?: string | null;
};
function parseTarget(value: unknown): ResourceCardOpenTarget | null {
  return (
    parseResourceCard({
      resource: { namespace: 'navigation', type: 'view', id: 'selection' },
      title: 'Selection',
      open: value,
    })?.open ?? null
  );
}
function parseEntry(value: unknown): NavigationEntry | null {
  if (!value || typeof value !== 'object' || !('target' in value)) return null;
  const target = value.target === null ? null : parseTarget(value.target);
  if (value.target !== null && target?.target !== 'workbench.view') return null;
  if ('conversationId' in value) {
    if (
      value.conversationId !== null &&
      typeof value.conversationId !== 'string'
    )
      return null;
    return { target, conversationId: value.conversationId };
  }
  return { target };
}
function saved(scope: string) {
  try {
    return parseEntry(
      JSON.parse(sessionStorage.getItem(storageKey(scope)) ?? 'null'),
    );
  } catch {
    return null;
  }
}
function save(scope: string, entry: NavigationEntry | null) {
  try {
    if (entry?.target)
      sessionStorage.setItem(storageKey(scope), JSON.stringify(entry));
    else sessionStorage.removeItem(storageKey(scope));
  } catch {
    /* Navigation remains usable with storage disabled. */
  }
}

/** Explicit, successful view navigation is restorable in the host, never the plugin iframe. */
export function useResourceCardNavigation(options: {
  scope: string;
  conversationId?: string | null;
  isConversationScoped?: (viewKey: string) => boolean;
  enabled: boolean;
  ready: boolean;
  restore: (target: ResourceCardOpenTarget) => boolean;
  close: () => void;
}) {
  const { scope, enabled, ready } = options;
  const callbacks = React.useRef(options);
  callbacks.current = options;
  const restored = React.useRef<string | null>(null);
  const isCurrent = React.useCallback((entry: NavigationEntry) => {
    if (!entry.target) return true;
    const context = callbacks.current;
    const conversationId = context.isConversationScoped?.(entry.target.viewKey)
      ? (context.conversationId ?? null)
      : undefined;
    return entry.conversationId === conversationId;
  }, []);
  React.useEffect(() => {
    if (!enabled || !ready || restored.current === scope) return;
    restored.current = scope;
    const entry = saved(scope);
    if (entry?.target && isCurrent(entry))
      callbacks.current.restore(entry.target);
  }, [scope, enabled, ready, isCurrent]);
  React.useEffect(() => {
    if (!enabled) return;
    const receive = (event: PopStateEvent) => {
      const entry: unknown = event.state?.[stateKey];
      if (
        !entry ||
        typeof entry !== 'object' ||
        !('scope' in entry) ||
        entry.scope !== scope ||
        !('target' in entry)
      )
        return;
      const parsed = parseEntry(entry);
      if (!parsed || !isCurrent(parsed) || !callbacks.current.ready) return;
      save(scope, parsed);
      if (parsed.target) callbacks.current.restore(parsed.target);
      else callbacks.current.close();
    };
    window.addEventListener('popstate', receive);
    return () => window.removeEventListener('popstate', receive);
  }, [scope, enabled, isCurrent]);
  const remember = React.useCallback(
    (target: ResourceCardOpenTarget) => {
      if (
        !enabled ||
        callbacks.current.scope !== scope ||
        target.target !== 'workbench.view'
      )
        return;
      const normalized = parseTarget(target);
      if (!normalized) return;
      const entry: NavigationEntry = {
        target: normalized,
        ...(callbacks.current.isConversationScoped?.(target.viewKey)
          ? { conversationId: callbacks.current.conversationId ?? null }
          : {}),
      };
      const stored = saved(scope);
      const previous = stored && isCurrent(stored) ? stored : { target: null };
      try {
        history.replaceState(
          { ...history.state, [stateKey]: { scope, ...previous } },
          '',
        );
        history.pushState(
          { ...history.state, [stateKey]: { scope, ...entry } },
          '',
        );
      } catch {
        /* Sandboxed embedders may disallow history writes. */
      }
      save(scope, entry);
    },
    [scope, enabled, isCurrent],
  );
  const forget = React.useCallback(
    (viewKey?: string) => {
      if (!enabled) return;
      if (viewKey && saved(scope)?.target?.viewKey !== viewKey) return;
      restored.current = scope;
      save(scope, null);
      try {
        history.replaceState(
          { ...history.state, [stateKey]: { scope, target: null } },
          '',
        );
      } catch {
        /* Keep closing usable when the embedder disallows history writes. */
      }
    },
    [scope, enabled],
  );
  return { remember, forget };
}
