import * as React from 'react';

function reconcile(order: string[], available: string[]) {
  const present = new Set(available);
  const known = new Set(order);
  return [
    ...order.filter((key) => present.has(key)),
    ...available.filter((key) => !known.has(key)),
  ];
}

/** Tab position is independent of the type of content displayed inside it. */
export function useWorkbenchTabOrder(scope: string, available: string[]) {
  const [state, setState] = React.useState({ scope, keys: available });
  const keys = React.useMemo(
    () => reconcile(state.scope === scope ? state.keys : [], available),
    [state, scope, available],
  );
  React.useEffect(() => {
    setState((current) =>
      current.scope === scope &&
      current.keys.length === keys.length &&
      current.keys.every((key, index) => key === keys[index])
        ? current
        : { scope, keys },
    );
  }, [scope, keys]);

  const replace = React.useCallback(
    (from: string, to: string) => {
      setState((current) => {
        if (current.scope !== scope) return current;
        const order = current.keys;
        if (from === to || !order.includes(from)) return current;
        return {
          scope,
          // Reuse an existing tool without leaving a duplicate tab behind.
          keys: order
            .filter((key) => key !== to)
            .map((key) => (key === from ? to : key)),
        };
      });
    },
    [scope],
  );
  const insertBefore = React.useCallback(
    (key: string, nextKey: string | undefined) => {
      setState((current) => {
        if (current.scope !== scope) return current;
        const order = current.keys.filter((item) => item !== key);
        const index = nextKey ? order.indexOf(nextKey) : -1;
        order.splice(index < 0 ? order.length : index, 0, key);
        return { scope, keys: order };
      });
    },
    [scope],
  );
  return { keys, replace, insertBefore };
}
