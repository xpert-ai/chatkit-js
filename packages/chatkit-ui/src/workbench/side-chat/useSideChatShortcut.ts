import { useEffect, type RefObject } from 'react';
export function useSideChatShortcut(
  root: RefObject<HTMLElement | null>,
  enabled: boolean,
  create: () => Promise<void>,
  onError: (message: string) => void,
) {
  useEffect(() => {
    const element = root.current;
    if (!element || !enabled) return;
    const listener = (event: KeyboardEvent) => {
      if (
        event.isComposing ||
        event.repeat ||
        !event.altKey ||
        !(event.metaKey || event.ctrlKey) ||
        event.code !== 'KeyS'
      )
        return;
      event.preventDefault();
      event.stopPropagation();
      void create().catch((cause: unknown) =>
        onError(cause instanceof Error ? cause.message : String(cause)),
      );
    };
    element.addEventListener('keydown', listener);
    return () => element.removeEventListener('keydown', listener);
  }, [root, enabled, create, onError]);
}
