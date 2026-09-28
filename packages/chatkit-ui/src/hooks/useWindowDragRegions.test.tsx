import { act, renderHook, cleanup } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const sendEvent = vi.hoisted(() => vi.fn());
vi.mock('./useParentMessenger', () => ({
  useParentMessenger: () => ({ sendEvent }),
}));
import { useWindowDragRegions } from './useWindowDragRegions';

function box(
  element: Element,
  x: number,
  y: number,
  width: number,
  height: number,
) {
  const rect = {
    x,
    y,
    width,
    height,
    left: x,
    top: y,
    right: x + width,
    bottom: y + height,
    toJSON: () => ({}),
  };
  vi.spyOn(element, 'getBoundingClientRect').mockReturnValue(rect);
  vi.spyOn(element, 'getClientRects').mockReturnValue({
    0: rect,
    length: 1,
    item: () => rect,
    [Symbol.iterator]: () => [rect].values(),
  });
}
beforeEach(() => {
  vi.useFakeTimers();
  sendEvent.mockClear();
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      disconnect() {}
    },
  );
  document.body.innerHTML =
    '<header data-slot="chatkit-chat-header-container"><button>Settings</button></header>';
  box(document.querySelector('header')!, 0, 0, 500, 56);
  box(document.querySelector('button')!, 450, 8, 32, 32);
});
afterEach(() => {
  cleanup();
  document.body.replaceChildren();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
describe('frame header hit regions', () => {
  it('includes both gutters around a centered chat column without covering controls or another pane', async () => {
    document.body.innerHTML = `
      <header data-slot="chatkit-chat-header-container">
        <div data-slot="chatkit-chat-header"><button>Settings</button></div>
      </header>`;
    box(document.querySelector('header')!, 100, 0, 800, 56);
    box(
      document.querySelector('[data-slot="chatkit-chat-header"]')!,
      300,
      0,
      400,
      56,
    );
    box(document.querySelector('button')!, 660, 8, 32, 32);
    renderHook(() => useWindowDragRegions(true));
    await act(() => vi.advanceTimersByTimeAsync(32));
    const regions = sendEvent.mock.calls.at(-1)![1].regions;
    const draggable = (x: number, y: number) =>
      regions.some(
        (rect: { x: number; y: number; width: number; height: number }) =>
          x >= rect.x &&
          x < rect.x + rect.width &&
          y >= rect.y &&
          y < rect.y + rect.height,
      );
    expect(draggable(150, 24)).toBe(true);
    expect(draggable(850, 24)).toBe(true);
    expect(draggable(450, 24)).toBe(true);
    expect(draggable(676, 24)).toBe(false);
    expect(draggable(50, 24)).toBe(false);
    expect(draggable(950, 24)).toBe(false);
    expect(draggable(450, 80)).toBe(false);
  });

  it('leaves interactive controls usable and suspends native hit regions while a menu is open', async () => {
    renderHook(() => useWindowDragRegions(true));
    await act(() => vi.advanceTimersByTimeAsync(32));
    const data = sendEvent.mock.calls.at(-1)![1];
    expect(data.regions.length).toBeGreaterThan(0);
    expect(
      data.regions.some(
        (rect: { x: number; y: number; width: number; height: number }) =>
          rect.x <= 466 &&
          rect.x + rect.width >= 466 &&
          rect.y <= 24 &&
          rect.y + rect.height >= 24,
      ),
    ).toBe(false);
    const menu = document.createElement('div');
    menu.role = 'menu';
    box(menu, 400, 10, 100, 200);
    document.body.append(menu);
    await act(() => vi.advanceTimersByTimeAsync(32));
    expect(sendEvent.mock.calls.at(-1)![1].regions).toEqual([]);
    menu.remove();
    await act(() => vi.advanceTimersByTimeAsync(32));
    expect(sendEvent.mock.calls.at(-1)![1].regions.length).toBeGreaterThan(0);
  });
  it('does nothing for ordinary web embeds and clears regions on unmount', async () => {
    const { rerender, unmount } = renderHook(
      ({ enabled }) => useWindowDragRegions(enabled),
      { initialProps: { enabled: false } },
    );
    await act(() => vi.advanceTimersByTimeAsync(32));
    expect(sendEvent).not.toHaveBeenCalled();
    rerender({ enabled: true });
    await act(() => vi.advanceTimersByTimeAsync(32));
    expect(sendEvent).toHaveBeenCalled();
    unmount();
    expect(sendEvent.mock.calls.at(-1)![1].regions).toEqual([]);
  });
});
