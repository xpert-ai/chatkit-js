import * as React from 'react';

type Point = { x: number; y: number };
type Size = { width: number; height: number };

export function clampFloatingChatPosition(
  point: Point,
  bounds: Size,
  size: Size,
  inset: number,
): Point {
  return {
    x: Math.max(inset, Math.min(point.x, bounds.width - size.width - inset)),
    y: Math.max(inset, Math.min(point.y, bounds.height - size.height - inset)),
  };
}

export function useFloatingChatPosition<T extends HTMLElement = HTMLDivElement>(
  active: boolean,
  savedPosition?: React.RefObject<Point | null>,
  anchor: 'center' | 'right' = 'center',
  sharedBoundsRef?: React.RefObject<HTMLDivElement | null>,
  verticalAnchor: 'top' | 'bottom' = 'top',
) {
  const localBoundsRef = React.useRef<HTMLDivElement>(null);
  const boundsRef = sharedBoundsRef ?? localBoundsRef;
  const surfaceRef = React.useRef<T>(null);
  const localPosition = React.useRef<Point | null>(null);
  const position = savedPosition ?? localPosition;
  const [offset, setOffset] = React.useState<Point | null>(null);
  const [dragging, setDragging] = React.useState(false);
  const suppressClick = React.useRef(false);
  const drag = React.useRef<{
    pointerId: number;
    start: Point;
    origin: Point;
  } | null>(null);
  const constrain = React.useCallback(
    (point?: Point, size?: Size) => {
      const bounds = boundsRef.current;
      const surface = surfaceRef.current;
      if (!bounds || !surface || !bounds.clientWidth || !surface.offsetWidth)
        return;
      const inset = parseFloat(getComputedStyle(bounds).paddingLeft) || 16;
      const dimensions = size ?? {
        width: surface.offsetWidth,
        height: surface.offsetHeight,
      };
      // Pointer/resize callers use top coordinates; saved positions and CSS
      // use the selected edge so content can grow without moving that edge.
      const anchoredPoint = point && {
        x: point.x,
        y:
          verticalAnchor === 'bottom'
            ? bounds.clientHeight - point.y - dimensions.height
            : point.y,
      };
      const next = clampFloatingChatPosition(
        anchoredPoint ??
          position.current ?? {
            x:
              anchor === 'right'
                ? bounds.clientWidth - surface.offsetWidth - inset
                : (bounds.clientWidth - surface.offsetWidth) / 2,
            y:
              verticalAnchor === 'bottom'
                ? inset
                : bounds.clientHeight - dimensions.height - inset,
          },
        { width: bounds.clientWidth, height: bounds.clientHeight },
        dimensions,
        inset,
      );
      // Keep the default bottom anchor until the user chooses a position.
      if (point || position.current) position.current = next;
      setOffset((old) => (old?.x === next.x && old.y === next.y ? old : next));
    },
    [anchor, boundsRef, position, verticalAnchor],
  );
  React.useLayoutEffect(() => {
    if (!active) return;
    constrain();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => constrain());
    if (boundsRef.current) observer.observe(boundsRef.current);
    if (surfaceRef.current) observer.observe(surfaceRef.current);
    return () => observer.disconnect();
  }, [active, boundsRef, constrain]);
  React.useEffect(() => {
    if (!active) {
      drag.current = null;
      setDragging(false);
    }
  }, [active]);
  return {
    boundsRef,
    surfaceRef,
    dragging,
    moveTo: constrain,
    style: offset
      ? {
          left: offset.x,
          top: verticalAnchor === 'top' ? offset.y : 'auto',
          right: 'auto',
          bottom: verticalAnchor === 'bottom' ? offset.y : 'auto',
          transform: 'none',
        }
      : undefined,
    handleProps: {
      onPointerDown: (event: React.PointerEvent<HTMLElement>) => {
        if (event.button !== 0) return;
        suppressClick.current = false;
        const bounds = boundsRef.current?.getBoundingClientRect();
        const surface = surfaceRef.current?.getBoundingClientRect();
        if (!bounds || !surface) return;
        event.preventDefault();
        event.currentTarget.focus();
        event.currentTarget.setPointerCapture(event.pointerId);
        drag.current = {
          pointerId: event.pointerId,
          start: { x: event.clientX, y: event.clientY },
          origin: {
            x: surface.left - bounds.left,
            y: surface.top - bounds.top,
          },
        };
      },
      onPointerMove: (event: React.PointerEvent<HTMLElement>) => {
        const current = drag.current;
        if (!current || current.pointerId !== event.pointerId) return;
        const dx = event.clientX - current.start.x;
        const dy = event.clientY - current.start.y;
        if (!suppressClick.current && Math.hypot(dx, dy) < 4) return;
        suppressClick.current = true;
        setDragging(true);
        constrain({
          x: current.origin.x + dx,
          y: current.origin.y + dy,
        });
      },
      onClickCapture: (event: React.MouseEvent<HTMLElement>) => {
        // Pointer activation follows pointerup even after a drag. Keyboard
        // activation (detail = 0) should always remain available.
        if (suppressClick.current && event.detail !== 0) {
          event.preventDefault();
          event.stopPropagation();
          suppressClick.current = false;
        }
      },
      onPointerCancel: () => {
        drag.current = null;
        setDragging(false);
      },
      onLostPointerCapture: () => {
        drag.current = null;
        setDragging(false);
      },
      onPointerUp: (event: React.PointerEvent<HTMLElement>) => {
        if (event.currentTarget.hasPointerCapture(event.pointerId))
          event.currentTarget.releasePointerCapture(event.pointerId);
        drag.current = null;
        setDragging(false);
      },
      onKeyDown: (event: React.KeyboardEvent<HTMLElement>) => {
        const delta: Record<string, Point> = {
          ArrowLeft: { x: -16, y: 0 },
          ArrowRight: { x: 16, y: 0 },
          ArrowUp: { x: 0, y: -16 },
          ArrowDown: { x: 0, y: 16 },
        };
        const step = delta[event.key];
        if (!step || !offset) return;
        event.preventDefault();
        const top =
          verticalAnchor === 'bottom'
            ? (boundsRef.current?.clientHeight ?? 0) -
              (surfaceRef.current?.offsetHeight ?? 0) -
              offset.y
            : offset.y;
        constrain({ x: offset.x + step.x, y: top + step.y });
      },
    },
  };
}
