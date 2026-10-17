import * as React from 'react';

function sidebarBounds(containerWidth: number) {
  // Keep space for the diff when docked, or a dismissal gutter when overlaid.
  const max =
    containerWidth > 0
      ? Math.max(
          0,
          Math.min(
            520,
            Math.floor(containerWidth - (containerWidth >= 600 ? 320 : 32)),
          ),
        )
      : 520;
  return { min: Math.min(200, max), max };
}

export function clampFileSidebarWidth(width: number, containerWidth: number) {
  const { min, max } = sidebarBounds(containerWidth);
  return Math.min(max, Math.max(min, Math.round(width)));
}

export function ResizableFileSidebar({
  children,
  label,
  className = '',
  contentClassName = '',
  resizerClassName = '',
  overlayClassName = '',
  containerWidth,
  width,
  onWidthChange,
}: {
  children: React.ReactNode;
  label: string;
  className?: string;
  contentClassName?: string;
  resizerClassName?: string;
  overlayClassName?: string;
  containerWidth: number;
  width: number;
  onWidthChange: (width: number) => void;
}) {
  const contentId = React.useId();
  const { min, max } = sidebarBounds(containerWidth);
  const [resizing, setResizing] = React.useState(false);
  const resizeCleanup = React.useRef<() => void>(() => {});
  const drag = React.useRef<{
    pointerId: number;
    startX: number;
    startWidth: number;
    target: HTMLDivElement;
  } | null>(null);
  const finishResize = React.useCallback(
    (cancel = false) => {
      const current = drag.current;
      if (!current) return;
      drag.current = null;
      resizeCleanup.current();
      if (cancel) onWidthChange(current.startWidth);
      if (current.target.hasPointerCapture?.(current.pointerId))
        current.target.releasePointerCapture(current.pointerId);
      setResizing(false);
    },
    [onWidthChange],
  );

  React.useEffect(() => {
    finishResize();
  }, [containerWidth, finishResize]);
  React.useEffect(() => () => resizeCleanup.current(), []);
  React.useEffect(() => {
    if (!resizing) return;
    const cancel = () => finishResize(true);
    const keyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        cancel();
      }
    };
    window.addEventListener('blur', cancel);
    window.addEventListener('keydown', keyDown);
    return () => {
      window.removeEventListener('blur', cancel);
      window.removeEventListener('keydown', keyDown);
    };
  }, [resizing, finishResize]);

  const resizeTo = (nextWidth: number) =>
    onWidthChange(clampFileSidebarWidth(nextWidth, containerWidth));
  return (
    <div
      className={`relative min-h-0 shrink-0 border-l bg-background ${className} ${containerWidth < 600 ? overlayClassName : ''}`}
      style={{ width, flexBasis: width }}
    >
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label={label}
        aria-controls={contentId}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={width}
        tabIndex={0}
        className={`absolute inset-y-0 -left-1 z-30 w-2 cursor-col-resize touch-none select-none outline-none after:absolute after:inset-y-0 after:left-[3px] after:w-px after:bg-border hover:after:w-0.5 hover:after:bg-primary focus-visible:after:w-0.5 focus-visible:after:bg-primary data-[resizing=true]:after:w-0.5 data-[resizing=true]:after:bg-primary ${resizerClassName}`}
        data-resizing={resizing || undefined}
        onPointerDown={(event) => {
          if (event.button !== 0 || drag.current) return;
          event.preventDefault();
          drag.current = {
            pointerId: event.pointerId,
            startX: event.clientX,
            startWidth: width,
            target: event.currentTarget,
          };
          event.currentTarget.setPointerCapture?.(event.pointerId);
          const pointerId = event.pointerId;
          const move = (moveEvent: PointerEvent) => {
            const current = drag.current;
            if (!current || moveEvent.pointerId !== pointerId) return;
            resizeTo(current.startWidth + current.startX - moveEvent.clientX);
          };
          const stop = (upEvent: PointerEvent) => {
            if (upEvent.pointerId === pointerId) finishResize();
          };
          const cancel = (cancelEvent: PointerEvent) => {
            if (cancelEvent.pointerId === pointerId) finishResize(true);
          };
          window.addEventListener('pointermove', move);
          window.addEventListener('pointerup', stop);
          window.addEventListener('pointercancel', cancel);
          resizeCleanup.current = () => {
            window.removeEventListener('pointermove', move);
            window.removeEventListener('pointerup', stop);
            window.removeEventListener('pointercancel', cancel);
          };
          setResizing(true);
        }}
        onDoubleClick={() => resizeTo(260)}
        onKeyDown={(event) => {
          if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key))
            return;
          event.preventDefault();
          resizeTo(
            event.key === 'Home'
              ? min
              : event.key === 'End'
                ? max
                : width + (event.key === 'ArrowLeft' ? 16 : -16),
          );
        }}
      />
      <div
        id={contentId}
        className={`h-full min-h-0 ${contentClassName}`}
      >
        {children}
      </div>
    </div>
  );
}
