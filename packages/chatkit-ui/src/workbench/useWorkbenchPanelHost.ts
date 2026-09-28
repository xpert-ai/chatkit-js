import * as React from 'react';

/**
 * Keep the panel's React tree alive while its desktop/drawer host changes.
 * Only the panel content is retained: a closed modal must unmount so Radix
 * releases its pointer lock, scroll lock and accessibility isolation.
 */
export function useWorkbenchPanelHost() {
  const [container] = React.useState(() => {
    if (typeof document === 'undefined') return null;
    const element = document.createElement('div');
    element.className = 'contents';
    return element;
  });
  const attach = React.useCallback(
    (host: HTMLDivElement | null) => {
      if (!container || !host) return;
      host.appendChild(container);
      return () => {
        // The exiting drawer may finish its animation after the desktop host
        // has already adopted the panel. Do not detach it from its new host.
        if (container.parentNode === host) container.remove();
      };
    },
    [container],
  );
  return { container, attach };
}
