import {
  act,
  createEvent,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { initI18n } from '../../i18n';
import { ImagePreview } from './ImagePreview';

beforeEach(async () => {
  await initI18n().changeLanguage('en-US');
  vi.stubGlobal(
    'PointerEvent',
    class extends MouseEvent {
      readonly pointerId: number;
      constructor(type: string, init: PointerEventInit = {}) {
        super(type, init);
        this.pointerId = init.pointerId ?? 1;
      }
    },
  );
});
afterEach(() => vi.unstubAllGlobals());

function setup() {
  const view = render(<ImagePreview src="/one.png" title="Picture" />);
  const image = screen.getByRole('img');
  const bounds = image.parentElement!;
  const viewport = bounds.parentElement!.parentElement!;
  Object.defineProperties(image, {
    naturalWidth: { value: 1000 },
    naturalHeight: { value: 500 },
  });
  Object.defineProperties(viewport, {
    clientWidth: { value: 400 },
    clientHeight: { value: 300 },
    scrollWidth: { value: 1032 },
    scrollHeight: { value: 532 },
  });
  vi.spyOn(viewport, 'getBoundingClientRect').mockReturnValue(
    new DOMRect(10, 20, 400, 300),
  );
  vi.spyOn(bounds, 'getBoundingClientRect').mockImplementation(
    () =>
      new DOMRect(
        26 - viewport.scrollLeft,
        36 - viewport.scrollTop,
        parseFloat(bounds.style.width),
        parseFloat(bounds.style.height),
      ),
  );
  fireEvent.load(image);
  return { ...view, image, bounds, viewport };
}

describe('image preview gestures', () => {
  it('zooms about the mouse position and prevents the wheel from scrolling the surrounding page', () => {
    const { viewport, bounds, image } = setup();
    viewport.scrollLeft = 100;
    viewport.scrollTop = 50;
    const before = bounds.getBoundingClientRect();
    const originalX = 180 - before.left;
    const originalY = 140 - before.top;
    const wheel = createEvent.wheel(viewport, {
      deltaY: -100,
      clientX: 180,
      clientY: 140,
      cancelable: true,
    });
    fireEvent(viewport, wheel);
    expect(wheel.defaultPrevented).toBe(true);
    const scale = parseFloat(bounds.style.width) / 1000;
    expect(scale).toBeCloseTo(Math.exp(0.2));
    expect(bounds.getBoundingClientRect().left + originalX * scale).toBeCloseTo(
      180,
    );
    expect(bounds.getBoundingClientRect().top + originalY * scale).toBeCloseTo(
      140,
    );
    expect(image.style.transform).toContain(`scale(${scale})`);
    fireEvent.wheel(viewport, { deltaY: 100, clientX: 180, clientY: 140 });
    expect(parseFloat(bounds.style.width)).toBeCloseTo(1000);
    expect(viewport.scrollLeft).toBeCloseTo(100);
  });

  it('handles wheel units, rapid wheel events, limits and zoom after rotation', () => {
    const { viewport, bounds, image } = setup();
    act(() => {
      viewport.dispatchEvent(
        new WheelEvent('wheel', { deltaY: -3, deltaMode: 1 }),
      );
      viewport.dispatchEvent(
        new WheelEvent('wheel', { deltaY: -3, deltaMode: 1 }),
      );
    });
    expect(parseFloat(bounds.style.width) / 1000).toBeCloseTo(Math.exp(0.192));
    for (let i = 0; i < 30; i++)
      fireEvent.wheel(viewport, { deltaY: -1, deltaMode: 2 });
    expect(screen.getByRole('button', { name: 'Zoom in' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Rotate right' }));
    fireEvent.wheel(viewport, { deltaY: 100 });
    expect(image.style.transform).toContain('rotate(90deg)');
    expect(parseFloat(bounds.style.height)).toBeGreaterThan(
      parseFloat(bounds.style.width),
    );
    for (let i = 0; i < 40; i++) fireEvent.wheel(viewport, { deltaY: 100 });
    expect(screen.getByRole('button', { name: 'Zoom out' })).toBeDisabled();
  });

  it('pans only with the active left pointer and stops when released outside the viewport', () => {
    const { viewport } = setup();
    viewport.scrollLeft = 120;
    viewport.scrollTop = 80;
    fireEvent.pointerDown(viewport, { button: 2, clientX: 200, clientY: 170 });
    fireEvent.pointerMove(window, { clientX: 100, clientY: 100 });
    expect(viewport.scrollLeft).toBe(120);
    fireEvent.pointerDown(viewport, {
      button: 0,
      clientX: 200,
      clientY: 170,
      pointerId: 1,
    });
    expect(viewport).toHaveClass('cursor-grabbing');
    fireEvent.pointerMove(window, { clientX: 160, clientY: 140, pointerId: 2 });
    expect(viewport.scrollLeft).toBe(120);
    fireEvent.pointerMove(window, { clientX: 160, clientY: 140, pointerId: 1 });
    expect(viewport.scrollLeft).toBe(160);
    expect(viewport.scrollTop).toBe(110);
    fireEvent.pointerUp(window, { pointerId: 1 });
    fireEvent.pointerMove(window, { clientX: 80, clientY: 80, pointerId: 1 });
    expect(viewport.scrollLeft).toBe(160);
    expect(viewport).not.toHaveClass('cursor-grabbing');
  });

  it.each(['cancel', 'blur', 'escape', 'lostcapture', 'unmount'] as const)(
    'cleans up drag listeners on %s',
    (reason) => {
      const { viewport, unmount } = setup();
      fireEvent.pointerDown(viewport, {
        button: 0,
        clientX: 200,
        clientY: 170,
        pointerId: 1,
      });
      if (reason === 'cancel')
        fireEvent.pointerCancel(window, { pointerId: 1 });
      else if (reason === 'blur') fireEvent.blur(window);
      else if (reason === 'escape')
        fireEvent.keyDown(window, { key: 'Escape' });
      else if (reason === 'lostcapture')
        fireEvent.lostPointerCapture(viewport, { pointerId: 1 });
      else unmount();
      fireEvent.pointerMove(window, {
        clientX: 100,
        clientY: 70,
        pointerId: 1,
      });
      expect(viewport.scrollLeft).toBe(0);
      expect(viewport.scrollTop).toBe(0);
    },
  );
});
