import * as React from 'react';

/** The editor is a portal sibling in React, so observe focus in the DOM. */
export function useFloatingChatFocus(
  surface: React.RefObject<HTMLDivElement | null>,
  active: boolean,
) {
  const [focused, setFocused] = React.useState(false);
  React.useLayoutEffect(() => {
    if (!active) {
      setFocused(false);
      return;
    }
    const sync = () => {
      setFocused(!!surface.current?.contains(document.activeElement));
    };
    const focusOut = (event: FocusEvent) =>
      setFocused(
        event.relatedTarget instanceof Node &&
          !!surface.current?.contains(event.relatedTarget),
      );
    const blur = () => setFocused(false);
    const pointerDown = (event: PointerEvent) => {
      if (
        event.target instanceof Element &&
        !surface.current?.contains(event.target) &&
        !event.target.closest('[data-floating-chat-menu]')
      )
        setFocused(false);
    };
    sync();
    document.addEventListener('focusin', sync);
    document.addEventListener('focusout', focusOut);
    document.addEventListener('pointerdown', pointerDown, true);
    window.addEventListener('blur', blur);
    window.addEventListener('focus', sync);
    return () => {
      document.removeEventListener('focusin', sync);
      document.removeEventListener('focusout', focusOut);
      document.removeEventListener('pointerdown', pointerDown, true);
      window.removeEventListener('blur', blur);
      window.removeEventListener('focus', sync);
    };
  }, [active, surface]);
  return focused;
}
