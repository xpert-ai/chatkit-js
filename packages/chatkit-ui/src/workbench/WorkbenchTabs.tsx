import * as React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useChatkitTranslation } from '../i18n/useChatkitTranslation';

export function WorkbenchTabs({
  activeKey,
  children,
}: {
  activeKey: string | null;
  children: React.ReactNode;
}) {
  const { t } = useChatkitTranslation();
  const id = React.useId();
  const root = React.useRef<HTMLDivElement>(null);
  const viewport = React.useRef<HTMLDivElement>(null);
  const content = React.useRef<HTMLDivElement>(null);
  const animation = React.useRef<number | null>(null);
  const [edges, setEdges] = React.useState({
    overflow: false,
    left: false,
    right: false,
  });

  const stop = React.useCallback(() => {
    if (animation.current !== null) cancelAnimationFrame(animation.current);
    animation.current = null;
  }, []);
  const measure = React.useCallback(() => {
    const area = viewport.current;
    const strip = content.current;
    if (!area || !strip || !root.current) return;
    const outer = area.getBoundingClientRect();
    const inner = strip.getBoundingClientRect();
    const next = {
      overflow: strip.scrollWidth > root.current.clientWidth + 1,
      left: inner.left < outer.left - 1,
      right: inner.right > outer.right + 1,
    };
    setEdges((previous) =>
      previous.overflow === next.overflow &&
      previous.left === next.left &&
      previous.right === next.right
        ? previous
        : next,
    );
  }, []);
  const move = React.useCallback(
    (distance: number) => {
      const area = viewport.current;
      if (!area) return false;
      const previous = area.scrollLeft;
      area.scrollBy({ left: distance, behavior: 'instant' });
      measure();
      return area.scrollLeft !== previous;
    },
    [measure],
  );
  const start = (direction: number) => {
    stop();
    if (!move(direction * 64)) return;
    const repeatAfter = performance.now() + 250;
    let previous = repeatAfter;
    const tick = (now: number) => {
      if (now >= repeatAfter) {
        const elapsed = Math.min(now - previous, 48);
        previous = now;
        if (!move(direction * elapsed * 0.45)) {
          stop();
          return;
        }
      }
      animation.current = requestAnimationFrame(tick);
    };
    animation.current = requestAnimationFrame(tick);
  };
  const reveal = React.useCallback(
    (element: HTMLElement) => {
      const area = viewport.current?.getBoundingClientRect();
      if (!area) return;
      const item = element.getBoundingClientRect();
      if (item.left < area.left) move(item.left - area.left);
      else if (item.right > area.right) move(item.right - area.right);
    },
    [move],
  );

  React.useLayoutEffect(() => {
    const observer =
      typeof ResizeObserver === 'undefined'
        ? null
        : new ResizeObserver(measure);
    for (const element of [root.current, viewport.current, content.current]) {
      if (element) observer?.observe(element);
    }
    measure();
    window.addEventListener('resize', measure);
    window.addEventListener('pointerup', stop);
    window.addEventListener('pointercancel', stop);
    window.addEventListener('blur', stop);
    document.addEventListener('visibilitychange', stop);
    return () => {
      stop();
      observer?.disconnect();
      window.removeEventListener('resize', measure);
      window.removeEventListener('pointerup', stop);
      window.removeEventListener('pointercancel', stop);
      window.removeEventListener('blur', stop);
      document.removeEventListener('visibilitychange', stop);
    };
  }, [measure, stop]);
  React.useLayoutEffect(() => {
    const selected = content.current?.querySelector<HTMLElement>(
      '[role="tab"][aria-selected="true"]',
    );
    if (selected) reveal(selected.parentElement ?? selected);
  }, [activeKey, edges.overflow, reveal]);

  const arrow = (direction: -1 | 1) => {
    const label = t(
      direction === -1
        ? 'workbench.scrollViewsLeft'
        : 'workbench.scrollViewsRight',
    );
    const Icon = direction === -1 ? ChevronLeft : ChevronRight;
    return (
      <button
        type="button"
        aria-label={label}
        title={label}
        aria-controls={id}
        disabled={direction === -1 ? !edges.left : !edges.right}
        className="flex size-7 shrink-0 touch-none select-none items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default disabled:opacity-30"
        onPointerDown={(event) => {
          if (event.button !== 0) return;
          event.preventDefault();
          event.currentTarget.focus({ preventScroll: true });
          start(direction);
        }}
        onPointerUp={stop}
        onPointerCancel={stop}
        onPointerLeave={stop}
        onBlur={stop}
        onClick={(event) => {
          // Keyboard and assistive-technology activation have no pointer press.
          if (event.detail === 0) move(direction * 128);
        }}
      >
        <Icon size={16} aria-hidden="true" />
      </button>
    );
  };

  return (
    <div ref={root} className="flex min-w-0 flex-initial items-center gap-1">
      {edges.overflow && arrow(-1)}
      <div
        ref={viewport}
        className="min-w-0 flex-1 overflow-x-auto overflow-y-hidden [scrollbar-width:none]! [&::-webkit-scrollbar]:hidden"
        onScroll={measure}
        onFocusCapture={(event) => reveal(event.target)}
      >
        <div
          ref={content}
          id={id}
          role="tablist"
          aria-label={t('workbench.views')}
          className="flex w-max min-w-full items-center gap-1"
        >
          {children}
        </div>
      </div>
      {edges.overflow && arrow(1)}
    </div>
  );
}
