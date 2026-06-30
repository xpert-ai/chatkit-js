import * as React from 'react';

import type { MessageNavigationItem } from '../../lib/message-navigation';
import { cn } from '../../lib/utils';

export type MessageNavigatorProps = {
  items: MessageNavigationItem[];
  viewportRef: React.RefObject<HTMLElement | null>;
  getAnchor: (item: MessageNavigationItem) => HTMLElement | null;
  onNavigate?: () => void;
  className?: string;
  label: string;
  tagsOverflowLabel: (count: number) => string;
};

const ACTIVE_OFFSET_PX = 12;

function getMarkerWidthClass(
  index: number,
  active: boolean,
  interactionIndex: number,
) {
  if (interactionIndex >= 0) {
    const distance = Math.abs(index - interactionIndex);
    if (distance === 0) return 'w-7';
    if (distance === 1) return 'w-5';
    if (distance === 2) return 'w-3.5';
    return 'w-2';
  }

  return active ? 'w-5' : 'w-2';
}

function getAnchorTop(viewport: HTMLElement, anchor: HTMLElement) {
  return anchor.offsetTop - viewport.offsetTop;
}

function resolveActiveItemId(
  items: MessageNavigationItem[],
  viewport: HTMLElement | null,
  getAnchor: (item: MessageNavigationItem) => HTMLElement | null,
) {
  if (!viewport || items.length === 0) return null;

  const targetTop = viewport.scrollTop + ACTIVE_OFFSET_PX;
  let activeId = items[0]?.id ?? null;

  for (const item of items) {
    const anchor = getAnchor(item);
    if (!anchor) continue;
    if (getAnchorTop(viewport, anchor) <= targetTop) {
      activeId = item.id;
      continue;
    }
    break;
  }

  return activeId;
}

function scrollToAnchor(viewport: HTMLElement, anchor: HTMLElement) {
  const top = Math.max(0, getAnchorTop(viewport, anchor) - ACTIVE_OFFSET_PX);
  if (typeof viewport.scrollTo === 'function') {
    viewport.scrollTo({ top, behavior: 'smooth' });
    return;
  }
  viewport.scrollTop = top;
}

export function MessageNavigator({
  items,
  viewportRef,
  getAnchor,
  onNavigate,
  className,
  label,
  tagsOverflowLabel,
}: MessageNavigatorProps) {
  const [hoveredId, setHoveredId] = React.useState<string | null>(null);
  const [focusedId, setFocusedId] = React.useState<string | null>(null);
  const [activeId, setActiveId] = React.useState<string | null>(null);

  const updateActiveItem = React.useCallback(() => {
    const viewport = viewportRef.current;
    setActiveId(resolveActiveItemId(items, viewport, getAnchor));
  }, [getAnchor, items, viewportRef]);

  React.useLayoutEffect(() => {
    updateActiveItem();
  }, [updateActiveItem]);

  React.useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    let frame: number | null = null;
    const scheduleUpdate = () => {
      if (frame !== null) return;
      frame = requestAnimationFrame(() => {
        frame = null;
        updateActiveItem();
      });
    };

    viewport.addEventListener('scroll', scheduleUpdate, { passive: true });
    window.addEventListener('resize', scheduleUpdate, { passive: true });

    const resizeObserver =
      typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(scheduleUpdate)
        : null;
    resizeObserver?.observe(viewport);

    return () => {
      if (frame !== null) {
        cancelAnimationFrame(frame);
      }
      viewport.removeEventListener('scroll', scheduleUpdate);
      window.removeEventListener('resize', scheduleUpdate);
      resizeObserver?.disconnect();
    };
  }, [updateActiveItem, viewportRef]);

  const handleNavigate = React.useCallback(
    (item: MessageNavigationItem) => {
      const viewport = viewportRef.current;
      const anchor = getAnchor(item);
      if (!viewport || !anchor) return;
      onNavigate?.();
      scrollToAnchor(viewport, anchor);
      setActiveId(item.id);
    },
    [getAnchor, onNavigate, viewportRef],
  );

  if (items.length === 0) return null;

  const interactionId = focusedId ?? hoveredId;
  const interactionIndex = interactionId
    ? items.findIndex((item) => item.id === interactionId)
    : -1;

  return (
    <nav
      aria-label={label}
      className={cn(
        'pointer-events-none sticky top-16 z-20 hidden h-0 w-0 shrink-0 self-start md:block',
        className,
      )}
      data-slot="chatkit-message-navigator"
    >
      <div className="group/nav relative h-[calc(100vh-9rem)] w-12">
        <div className="absolute left-2 top-1/2 flex max-h-full w-10 -translate-y-1/2 flex-col gap-0.5 py-1">
          {items.map((item, index) => {
            const isActive = item.id === activeId;
            const isPreviewed = item.id === hoveredId || item.id === focusedId;

            return (
              <div key={item.id} className="relative h-3.5 w-10 shrink-0">
                <button
                  type="button"
                  aria-label={`${item.title}: ${item.preview}`}
                  aria-current={isActive ? 'location' : undefined}
                  className={cn(
                    'pointer-events-auto flex h-3.5 w-10 items-center justify-start rounded-sm outline-none',
                    'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                  )}
                  onClick={() => handleNavigate(item)}
                  onMouseEnter={() => setHoveredId(item.id)}
                  onMouseLeave={() =>
                    setHoveredId((id) => (id === item.id ? null : id))
                  }
                  onFocus={() => setFocusedId(item.id)}
                  onBlur={() =>
                    setFocusedId((id) => (id === item.id ? null : id))
                  }
                >
                  <span
                    className={cn(
                      'block h-0.5 rounded-full bg-muted-foreground/25 transition-all duration-150',
                      getMarkerWidthClass(index, isActive, interactionIndex),
                      isActive && 'bg-foreground',
                      isPreviewed && 'bg-foreground',
                      interactionIndex >= 0 &&
                        !isActive &&
                        !isPreviewed &&
                        'bg-muted-foreground/35',
                    )}
                  />
                </button>

                {isPreviewed && (
                  <div
                    className={cn(
                      'pointer-events-none absolute left-9 top-1/2 z-30 w-80 max-w-[min(20rem,calc(100vw-6rem))] -translate-y-1/2',
                      'rounded-lg border border-border bg-background/95 p-3 text-left shadow-xl backdrop-blur',
                    )}
                  >
                    <div className="mb-1 truncate text-sm font-medium text-foreground">
                      {item.title}
                    </div>
                    <div className="line-clamp-2 text-sm leading-5 text-muted-foreground">
                      {item.preview}
                    </div>
                    {item.tags.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {item.tags.slice(0, 3).map((tag) => (
                          <span
                            key={tag}
                            className="max-w-[8rem] truncate rounded-md bg-muted px-1.5 py-0.5 text-[11px] leading-4 text-muted-foreground"
                          >
                            {tag}
                          </span>
                        ))}
                        {item.tags.length > 3 && (
                          <span className="rounded-md bg-muted px-1.5 py-0.5 text-[11px] leading-4 text-muted-foreground">
                            {tagsOverflowLabel(item.tags.length - 3)}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
