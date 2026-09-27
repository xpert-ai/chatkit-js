import * as React from 'react';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WorkbenchTabs } from './WorkbenchTabs';

let resize: () => void;
const disconnect = vi.fn();
beforeEach(() => {
  vi.useFakeTimers();
  disconnect.mockClear();
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(callback: () => void) {
        resize = callback;
      }
      observe() {}
      disconnect = disconnect;
    },
  );
  vi.stubGlobal('PointerEvent', MouseEvent);
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function tabs(selected = 0) {
  return (
    <WorkbenchTabs activeKey={String(selected)}>
      {[0, 1, 2, 3].map((index) => (
        <div key={index}>
          <button role="tab" aria-selected={selected === index}>
            View {index}
          </button>
        </div>
      ))}
    </WorkbenchTabs>
  );
}
function setup(initialWidth = 300) {
  const rendered = render(tabs());
  const strip = screen.getByRole('tablist');
  const viewport = strip.parentElement!;
  const root = viewport.parentElement!;
  let width = initialWidth;
  let contentWidth = 800;
  const areaWidth = () =>
    width - (root.querySelectorAll('button[aria-controls]').length ? 64 : 0);
  const rect = (left: number, rectWidth: number) => ({
    x: left,
    y: 0,
    left,
    right: left + rectWidth,
    top: 0,
    bottom: 40,
    width: rectWidth,
    height: 40,
    toJSON() {},
  });
  Object.defineProperty(root, 'clientWidth', {
    configurable: true,
    get: () => width,
  });
  Object.defineProperty(strip, 'scrollWidth', {
    configurable: true,
    get: () => contentWidth,
  });
  vi.spyOn(viewport, 'getBoundingClientRect').mockImplementation(() =>
    rect(0, areaWidth()),
  );
  vi.spyOn(strip, 'getBoundingClientRect').mockImplementation(() =>
    rect(-viewport.scrollLeft, contentWidth),
  );
  for (const [index, tab] of screen.getAllByRole('tab').entries()) {
    const bounds = () => rect(index * 200 - viewport.scrollLeft, 200);
    vi.spyOn(tab, 'getBoundingClientRect').mockImplementation(bounds);
    vi.spyOn(tab.parentElement!, 'getBoundingClientRect').mockImplementation(
      bounds,
    );
  }
  viewport.scrollBy = vi.fn((options?: ScrollToOptions | number) => {
    const distance = typeof options === 'number' ? options : options?.left || 0;
    viewport.scrollLeft = Math.max(
      0,
      Math.min(contentWidth - areaWidth(), viewport.scrollLeft + distance),
    );
  });
  act(() => resize());
  return {
    ...rendered,
    viewport,
    resizeTo(nextWidth: number, nextContentWidth = contentWidth) {
      width = nextWidth;
      contentWidth = nextContentWidth;
      act(() => resize());
    },
  };
}

describe('Workbench view strip', () => {
  it('shows arrows only on overflow and disables the edge already reached', () => {
    const view = setup(1000);
    expect(
      screen.queryByRole('button', { name: 'Scroll views right' }),
    ).not.toBeInTheDocument();
    view.resizeTo(300);
    expect(
      screen.getByRole('button', { name: 'Scroll views left' }),
    ).toBeDisabled();
    const right = screen.getByRole('button', { name: 'Scroll views right' });
    fireEvent.click(right, { detail: 0 });
    expect(view.viewport.scrollLeft).toBe(128);
    expect(
      screen.getByRole('button', { name: 'Scroll views left' }),
    ).toBeEnabled();
    fireEvent.pointerDown(right, { button: 0 });
    act(() => vi.advanceTimersByTime(2000));
    expect(view.viewport.scrollLeft).toBe(564);
    expect(right).toBeDisabled();
    view.resizeTo(900);
    expect(
      screen.queryByRole('button', { name: 'Scroll views right' }),
    ).not.toBeInTheDocument();
  });

  it.each([
    'pointerup',
    'pointercancel',
    'blur',
    'visibilitychange',
    'pointerleave',
  ])(
    'stops held scrolling on %s and does not add a second step on pointer click',
    (event) => {
      const view = setup();
      const right = screen.getByRole('button', { name: 'Scroll views right' });
      fireEvent.pointerDown(right, { button: 0 });
      expect(view.viewport.scrollLeft).toBe(64);
      fireEvent.click(right, { detail: 1 });
      expect(view.viewport.scrollLeft).toBe(64);
      act(() => vi.advanceTimersByTime(400));
      expect(view.viewport.scrollLeft).toBeGreaterThan(64);
      if (event === 'pointerleave') fireEvent.pointerLeave(right);
      else
        fireEvent(
          event === 'visibilitychange' ? document : window,
          new Event(event),
        );
      const stopped = view.viewport.scrollLeft;
      act(() => vi.advanceTimersByTime(1000));
      expect(view.viewport.scrollLeft).toBe(stopped);
    },
  );

  it('keeps selected and keyboard-focused views visible without changing their selection', () => {
    const view = setup();
    view.rerender(tabs(3));
    expect(view.viewport.scrollLeft).toBe(564);
    fireEvent.focus(screen.getByRole('tab', { name: 'View 0' }));
    expect(view.viewport.scrollLeft).toBe(0);
    expect(screen.getByRole('tab', { name: 'View 3' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
  });

  it('cleans up an active press on unmount', () => {
    const view = setup();
    fireEvent.pointerDown(
      screen.getByRole('button', { name: 'Scroll views right' }),
      { button: 0 },
    );
    const stopped = view.viewport.scrollLeft;
    view.unmount();
    act(() => vi.advanceTimersByTime(1000));
    expect(view.viewport.scrollLeft).toBe(stopped);
    expect(disconnect).toHaveBeenCalled();
  });
});
