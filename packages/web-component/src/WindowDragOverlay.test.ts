import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  parseWindowDragRegions,
  subtractWindowDragRect,
} from '@xpert-ai/chatkit-web-shared';
import { WindowDragOverlay } from './WindowDragOverlay';

afterEach(() => {
  document.body.replaceChildren();
  vi.unstubAllGlobals();
});
describe('native header drag overlay', () => {
  it('subtracts a button without losing the blank header space around it', () => {
    const areas = subtractWindowDragRect(
      { x: 0, y: 0, width: 600, height: 56 },
      { x: 520, y: 8, width: 32, height: 32 },
    );
    expect(areas.reduce((sum, rect) => sum + rect.width * rect.height, 0)).toBe(
      600 * 56 - 32 * 32,
    );
    expect(
      areas.every(
        (rect) =>
          rect.x + rect.width <= 520 ||
          rect.x >= 552 ||
          rect.y + rect.height <= 8 ||
          rect.y >= 40,
      ),
    ).toBe(true);
  });
  it('rejects malformed and out-of-header geometry at the frame boundary', () => {
    const payload = {
      width: 600,
      height: 800,
      regions: [{ x: 0, y: 0, width: 500, height: 56 }],
    };
    expect(parseWindowDragRegions(payload)).toEqual(payload);
    for (const rect of [
      { x: -1, y: 0, width: 500, height: 56 },
      { x: 0, y: 97, width: 500, height: 56 },
      { x: 0, y: 0, width: 601.1, height: 56 },
      { x: NaN, y: 0, width: 500, height: 56 },
      { x: 0, y: 0, width: 500, height: Infinity },
      { x: 0, y: 0, width: 0, height: 56 },
    ])
      expect(
        parseWindowDragRegions({ ...payload, regions: [rect] }),
      ).toBeNull();
    expect(
      parseWindowDragRegions({
        ...payload,
        regions: Array(129).fill(payload.regions[0]),
      }),
    ).toBeNull();
    expect(parseWindowDragRegions(null)).toBeNull();
  });
  it('requires opt-in, clears stale geometry on resize, preserves matching updates and cleans up', () => {
    let resize = () => {};
    const disconnect = vi.fn();
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
    const wrapper = document.createElement('div');
    Object.defineProperties(wrapper, {
      clientWidth: { value: 600, configurable: true },
      clientHeight: { value: 800 },
    });
    document.body.append(wrapper);
    let enabled = false;
    const overlay = new WindowDragOverlay(wrapper, () => enabled);
    const payload = {
      width: 600,
      height: 800,
      regions: [{ x: 0, y: 0, width: 500, height: 56 }],
    };
    overlay.update(payload);
    expect(wrapper.querySelector('[data-slot]')?.childElementCount).toBe(0);
    enabled = true;
    overlay.update(payload);
    resize();
    expect(wrapper.querySelector('[data-slot]')?.childElementCount).toBe(1);
    Object.defineProperty(wrapper, 'clientWidth', { value: 800 });
    resize();
    expect(wrapper.querySelector('[data-slot]')?.childElementCount).toBe(0);
    overlay.update(payload);
    expect(wrapper.querySelector('[data-slot]')?.childElementCount).toBe(0);
    overlay.update({ ...payload, width: 800 });
    expect(wrapper.querySelector('[data-slot]')?.childElementCount).toBe(1);
    overlay.destroy();
    expect(wrapper.childElementCount).toBe(0);
    expect(disconnect).toHaveBeenCalledOnce();
  });
});
