import * as React from 'react';
import { resizeWorkbench } from './split-resize';

export function useWorkbenchResize({
  rootRef,
  isNarrow,
  resolvedPanelWidth,
  open,
  expanded,
  setPanelWidth,
  setExpanded,
}: {
  rootRef: React.RefObject<HTMLDivElement | null>;
  isNarrow: boolean;
  resolvedPanelWidth: number;
  open: boolean;
  expanded: boolean;
  setPanelWidth: React.Dispatch<React.SetStateAction<number | null>>;
  setExpanded: React.Dispatch<React.SetStateAction<boolean>>;
}) {
  const [resizing, setResizing] = React.useState(false);
  const resizeCleanup = React.useRef<() => void>(() => {});
  React.useEffect(() => () => resizeCleanup.current(), []);
  const startResize = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (isNarrow || event.button !== 0) return;
      event.preventDefault();
      const root = rootRef.current;
      if (!root) return;
      resizeCleanup.current();
      const rect = root.getBoundingClientRect();
      const startX = event.clientX;
      const pointerId = event.pointerId;
      const target = event.currentTarget;
      const startingWidth = resolvedPanelWidth;
      target.setPointerCapture?.(pointerId);
      setResizing(true);
      const cleanup = () => {
        window.removeEventListener('pointermove', handleMove);
        window.removeEventListener('pointerup', stop);
        window.removeEventListener('pointercancel', cancel);
        window.removeEventListener('blur', cancel);
        if (target.hasPointerCapture?.(pointerId))
          target.releasePointerCapture(pointerId);
      };
      const stop = () => {
        cleanup();
        setResizing(false);
      };
      const cancel = () => {
        setPanelWidth(startingWidth);
        stop();
      };
      const handleMove = (moveEvent: PointerEvent) => {
        if (moveEvent.pointerId !== pointerId) return;
        const chatWidth =
          rect.width - startingWidth + moveEvent.clientX - startX;
        const next = resizeWorkbench(chatWidth, rect.width);
        setPanelWidth(next.panelWidth);
        if (next.collapsed) {
          setExpanded(true);
          stop();
        }
      };
      window.addEventListener('pointermove', handleMove);
      window.addEventListener('pointerup', stop);
      window.addEventListener('pointercancel', cancel);
      window.addEventListener('blur', cancel);
      resizeCleanup.current = cleanup;
    },
    [isNarrow, resolvedPanelWidth, rootRef, setPanelWidth, setExpanded],
  );
  React.useEffect(() => {
    if (!open || expanded || isNarrow) {
      resizeCleanup.current();
      setResizing(false);
    }
  }, [open, expanded, isNarrow]);

  return { resizing, startResize };
}
