import { useEffect } from 'react';
import {
  subtractWindowDragRect,
  type WindowDragRect,
} from '@xpert-ai/chatkit-web-shared';
import { useParentMessenger } from './useParentMessenger';

const headers =
  '[data-slot="chatkit-chat-header-container"], [data-slot="chatkit-workbench-header"]';
const floatingNoDrag = '[data-window-no-drag]';
const controls =
  'button, a, input, textarea, select, [role="button"], [role="tab"], [tabindex], [contenteditable="true"], [data-window-no-drag]';
const overlays =
  '[role="dialog"], [role="alertdialog"], [role="menu"], [role="listbox"], [data-radix-popper-content-wrapper]';

// Subframe app-regions do not reliably reach Electron's top-level window.
// Report layout through the existing authenticated frame channel; the host
// projects only these non-interactive rectangles into its own document.
export function useWindowDragRegions(enabled: boolean) {
  const { sendEvent } = useParentMessenger();
  useEffect(() => {
    if (!enabled) return;
    let frame = 0;
    let previous = '';
    const visible = (element: Element) =>
      element.getClientRects().length > 0 &&
      getComputedStyle(element).visibility !== 'hidden';
    const report = () => {
      frame = 0;
      const width = window.innerWidth;
      const height = window.innerHeight;
      const blocked = Array.from(document.querySelectorAll(overlays)).some(
        visible,
      );
      const regions: WindowDragRect[] = [];
      const floatingSurfaces = document.querySelectorAll(floatingNoDrag);
      if (!blocked)
        for (const header of document.querySelectorAll(headers)) {
          if (!visible(header)) continue;
          const box = header.getBoundingClientRect();
          const x = Math.max(0, box.left);
          const y = Math.max(0, box.top);
          let areas = [
            {
              x,
              y,
              width: Math.min(width, box.right) - x,
              height: Math.min(height, 96, box.bottom) - y,
            },
          ].filter((rect) => rect.width > 0 && rect.height > 0);
          // The character can share the header's grid row without being a
          // descendant of its drag surface. Keep overlapping controls clickable.
          const scope = header.closest('[data-window-drag-scope]') ?? header;
          // Persistent floating panels live outside the header scope. Exclude
          // their entire surface from the host's native drag overlay as well.
          const exclusions = new Set([
            ...scope.querySelectorAll(controls),
            ...floatingSurfaces,
          ]);
          for (const control of exclusions) {
            if (!visible(control)) continue;
            const rect = control.getBoundingClientRect();
            areas = areas.flatMap((area) =>
              subtractWindowDragRect(area, {
                x: rect.left - 1,
                y: rect.top - 1,
                width: rect.width + 2,
                height: rect.height + 2,
              }),
            );
          }
          regions.push(...areas);
        }
      const value = {
        width,
        height,
        regions: regions.length > 128 ? [] : regions,
      };
      const serialized = JSON.stringify(value);
      if (serialized !== previous) {
        previous = serialized;
        sendEvent('window_drag_regions', value);
      }
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(report);
    };
    const resize = new ResizeObserver(schedule);
    const observe = () => {
      resize.disconnect();
      resize.observe(document.documentElement);
      document
        .querySelectorAll(`${headers}, ${floatingNoDrag}`)
        .forEach((surface) => resize.observe(surface));
      schedule();
    };
    const mutations = new MutationObserver(observe);
    mutations.observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      characterData: true,
    });
    window.addEventListener('resize', schedule);
    document.addEventListener('scroll', schedule, true);
    // CSS split-pane transitions can move a header without resizing it.
    document.addEventListener('transitionend', schedule);
    observe();
    return () => {
      cancelAnimationFrame(frame);
      mutations.disconnect();
      resize.disconnect();
      window.removeEventListener('resize', schedule);
      document.removeEventListener('scroll', schedule, true);
      document.removeEventListener('transitionend', schedule);
      sendEvent('window_drag_regions', {
        width: window.innerWidth,
        height: window.innerHeight,
        regions: [],
      });
    };
  }, [enabled, sendEvent]);
}
