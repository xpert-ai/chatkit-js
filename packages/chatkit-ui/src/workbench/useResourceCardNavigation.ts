import * as React from 'react';
import {
  parseResourceCard,
  type ResourceCardOpenTarget,
} from '@xpert-ai/chatkit-types';

const stateKey = 'xpertResourceCard';
const storageKey = (scope: string) => `${stateKey}:${scope}`;
function parseTarget(value: unknown): ResourceCardOpenTarget | null {
  return (
    parseResourceCard({
      resource: { namespace: 'navigation', type: 'view', id: 'selection' },
      title: 'Selection',
      open: value,
    })?.open ?? null
  );
}
function saved(scope: string) {
  try {
    return parseTarget(
      JSON.parse(sessionStorage.getItem(storageKey(scope)) ?? 'null'),
    );
  } catch {
    return null;
  }
}
function save(scope: string, target: ResourceCardOpenTarget | null) {
  try {
    if (target)
      sessionStorage.setItem(storageKey(scope), JSON.stringify(target));
    else sessionStorage.removeItem(storageKey(scope));
  } catch {
    /* Navigation remains usable with storage disabled. */
  }
}

/** Only an explicit, successful card click creates restorable navigation. */
export function useResourceCardNavigation(options: {
  scope: string;
  enabled: boolean;
  ready: boolean;
  restore: (target: ResourceCardOpenTarget) => boolean;
  close: () => void;
}) {
  const { scope, enabled, ready } = options;
  const callbacks = React.useRef(options);
  callbacks.current = options;
  const restored = React.useRef<string | null>(null);
  React.useEffect(() => {
    if (!enabled || !ready || restored.current === scope) return;
    restored.current = scope;
    const target = saved(scope);
    if (target) callbacks.current.restore(target);
  }, [scope, enabled, ready]);
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
      const target = parseTarget(entry.target);
      save(scope, target);
      if (target) callbacks.current.restore(target);
      else callbacks.current.close();
    };
    window.addEventListener('popstate', receive);
    return () => window.removeEventListener('popstate', receive);
  }, [scope, enabled]);
  return React.useCallback(
    (target: ResourceCardOpenTarget) => {
      if (!enabled || target.target !== 'workbench.view') return;
      const previous = saved(scope);
      try {
        history.replaceState(
          { ...history.state, [stateKey]: { scope, target: previous } },
          '',
        );
        history.pushState(
          { ...history.state, [stateKey]: { scope, target } },
          '',
        );
      } catch {
        /* Sandboxed embedders may disallow history writes. */
      }
      save(scope, target);
    },
    [scope, enabled],
  );
}
