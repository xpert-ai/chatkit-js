import * as React from 'react';

/** Scroll the scaled image bounds so zoom keeps the point under the cursor in place. */
export function useImagePreviewGestures({
  viewport,
  imageBounds,
  scale,
  enabled,
  setZoom,
}: {
  viewport: React.RefObject<HTMLDivElement | null>;
  imageBounds: React.RefObject<HTMLDivElement | null>;
  scale: number;
  enabled: boolean;
  setZoom: React.Dispatch<React.SetStateAction<number | null>>;
}) {
  const [dragging, setDragging] = React.useState(false);
  const anchor = React.useRef<{
    x: number;
    y: number;
    imageX: number;
    imageY: number;
    scale: number;
  } | null>(null);
  const stopDrag = React.useRef<() => void>(() => {});

  React.useLayoutEffect(() => {
    const point = anchor.current;
    const element = viewport.current;
    const bounds = imageBounds.current;
    if (!point || !element || !bounds) return;
    anchor.current = null;
    const rect = bounds.getBoundingClientRect();
    element.scrollLeft += rect.left + point.imageX * scale - point.x;
    element.scrollTop += rect.top + point.imageY * scale - point.y;
  }, [scale, viewport, imageBounds]);

  React.useEffect(() => {
    const element = viewport.current;
    if (!element) return;
    const wheel = (event: WheelEvent) => {
      if (!enabled || !event.deltaY) return;
      event.preventDefault();
      stopDrag.current();
      const rect = imageBounds.current?.getBoundingClientRect();
      if (!rect) return;
      // Wheel devices report pixels, lines or pages; bound a single step for trackpads.
      const pixels =
        event.deltaY *
        (event.deltaMode === 1
          ? 16
          : event.deltaMode === 2
            ? element.clientHeight
            : 1);
      const previous = anchor.current?.scale ?? scale;
      const next = Math.min(
        4,
        Math.max(
          Math.min(0.1, previous),
          previous * Math.exp(-Math.max(-100, Math.min(100, pixels)) * 0.002),
        ),
      );
      if (next === previous) return;
      anchor.current = {
        x: event.clientX,
        y: event.clientY,
        imageX: (event.clientX - rect.left) / scale,
        imageY: (event.clientY - rect.top) / scale,
        scale: next,
      };
      setZoom(next);
    };
    // React's delegated wheel listener is passive and cannot suppress page scrolling.
    element.addEventListener('wheel', wheel, { passive: false });
    return () => element.removeEventListener('wheel', wheel);
  }, [enabled, scale, setZoom, viewport, imageBounds]);

  React.useEffect(() => () => stopDrag.current(), []);

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    const element = viewport.current;
    if (!enabled || !element || event.button !== 0 || event.isPrimary === false)
      return;
    if (
      element.scrollWidth <= element.clientWidth &&
      element.scrollHeight <= element.clientHeight
    )
      return;
    const rect = element.getBoundingClientRect();
    // Leave native scrollbars available for mouse and keyboard users.
    if (
      event.clientX >= rect.left + element.clientLeft + element.clientWidth ||
      event.clientY >= rect.top + element.clientTop + element.clientHeight
    )
      return;
    event.preventDefault();
    stopDrag.current();
    const { pointerId, clientX, clientY } = event;
    const left = element.scrollLeft;
    const top = element.scrollTop;
    element.setPointerCapture?.(pointerId);
    setDragging(true);
    const move = (event: PointerEvent) => {
      if (event.pointerId !== pointerId) return;
      element.scrollLeft = left + clientX - event.clientX;
      element.scrollTop = top + clientY - event.clientY;
    };
    const stop = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', end);
      window.removeEventListener('pointercancel', end);
      window.removeEventListener('blur', stop);
      window.removeEventListener('keydown', keyDown);
      element.removeEventListener('lostpointercapture', end);
      stopDrag.current = () => {};
      if (element.hasPointerCapture?.(pointerId))
        element.releasePointerCapture(pointerId);
      setDragging(false);
    };
    const end = (event: PointerEvent) => {
      if (event.pointerId === pointerId) stop();
    };
    const keyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') stop();
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);
    window.addEventListener('blur', stop);
    window.addEventListener('keydown', keyDown);
    element.addEventListener('lostpointercapture', end);
    stopDrag.current = stop;
  };
  return { dragging, onPointerDown };
}
