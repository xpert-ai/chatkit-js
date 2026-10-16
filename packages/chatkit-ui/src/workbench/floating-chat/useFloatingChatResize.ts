import * as React from 'react';
import type { useFloatingChatPosition } from './useFloatingChatPosition';

type Edge = 'left' | 'right';
type Position = ReturnType<typeof useFloatingChatPosition>;

/** Resize from either side, keeping the opposite edge fixed and inside the panel. */
export function useFloatingChatResize(
  active: boolean,
  position: Position,
  savedWidth?: React.RefObject<number | null>,
  defaultWidth = 640,
) {
  const localWidth = React.useRef<number | null>(null);
  const width = savedWidth ?? localWidth;
  const [, update] = React.useReducer((n: number) => n + 1, 0);
  const [resizing, setResizing] = React.useState(false);
  const [range, setRange] = React.useState({
    min: 320,
    max: defaultWidth,
    now: defaultWidth,
  });
  const { boundsRef, surfaceRef } = position;
  React.useLayoutEffect(() => {
    if (!active) return;
    const measure = () => {
      if (!boundsRef.current || !surfaceRef.current) return;
      const inset =
        parseFloat(getComputedStyle(boundsRef.current).paddingLeft) || 16;
      const max = Math.max(0, boundsRef.current.clientWidth - 2 * inset);
      const now = surfaceRef.current.offsetWidth;
      setRange((old) =>
        old.max === max && old.now === now
          ? old
          : { min: Math.min(320, max), max, now },
      );
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    if (boundsRef.current) observer.observe(boundsRef.current);
    if (surfaceRef.current) observer.observe(surfaceRef.current);
    return () => observer.disconnect();
  }, [active, boundsRef, surfaceRef, width]);
  const drag = React.useRef<{
    pointerId: number;
    edge: Edge;
    startX: number;
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);
  const readRect = () => {
    const bounds = position.boundsRef.current?.getBoundingClientRect();
    const surface = position.surfaceRef.current?.getBoundingClientRect();
    return bounds && surface
      ? {
          x: surface.left - bounds.left,
          y: surface.top - bounds.top,
          width: surface.width,
          height: surface.height,
        }
      : null;
  };
  const resize = (
    edge: Edge,
    delta: number,
    rect: NonNullable<ReturnType<typeof readRect>>,
  ) => {
    const bounds = position.boundsRef.current;
    if (!bounds) return;
    const inset = parseFloat(getComputedStyle(bounds).paddingLeft) || 16;
    const available = Math.max(0, bounds.clientWidth - 2 * inset);
    const min = Math.min(320, available);
    const max =
      edge === 'left'
        ? rect.x + rect.width - inset
        : bounds.clientWidth - rect.x - inset;
    const nextWidth = Math.min(
      max,
      Math.max(min, rect.width + (edge === 'left' ? -delta : delta)),
    );
    width.current = nextWidth;
    update();
    position.moveTo(
      {
        x: edge === 'left' ? rect.x + rect.width - nextWidth : rect.x,
        y: rect.y,
      },
      { width: nextWidth, height: rect.height },
    );
  };
  React.useEffect(() => {
    drag.current = null;
    setResizing(false);
  }, [active, width]);
  return {
    resizing,
    style: {
      width: `min(${width.current ?? defaultWidth}px, calc(100% - 2 * var(--floating-chat-inset)))`,
    },
    handleProps: (edge: Edge) => ({
      'aria-valuemin': range.min,
      'aria-valuemax': range.max,
      'aria-valuenow': range.now,
      onPointerDown: (event: React.PointerEvent<HTMLDivElement>) => {
        if (event.button !== 0) return;
        const rect = readRect();
        if (!rect) return;
        event.preventDefault();
        event.currentTarget.focus();
        event.currentTarget.setPointerCapture(event.pointerId);
        drag.current = {
          ...rect,
          edge,
          startX: event.clientX,
          pointerId: event.pointerId,
        };
        setResizing(true);
      },
      onPointerMove: (event: React.PointerEvent<HTMLDivElement>) => {
        const current = drag.current;
        if (current?.pointerId === event.pointerId)
          resize(current.edge, event.clientX - current.startX, current);
      },
      onPointerUp: (event: React.PointerEvent<HTMLDivElement>) => {
        if (event.currentTarget.hasPointerCapture(event.pointerId))
          event.currentTarget.releasePointerCapture(event.pointerId);
        drag.current = null;
        setResizing(false);
      },
      onPointerCancel: () => {
        drag.current = null;
        setResizing(false);
      },
      onLostPointerCapture: () => {
        drag.current = null;
        setResizing(false);
      },
      onKeyDown: (event: React.KeyboardEvent<HTMLDivElement>) => {
        if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
        const rect = readRect();
        if (!rect) return;
        event.preventDefault();
        resize(edge, event.key === 'ArrowLeft' ? -16 : 16, rect);
      },
    }),
  };
}
