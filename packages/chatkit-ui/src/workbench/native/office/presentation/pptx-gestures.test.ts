import { expect, it } from 'vitest';
import { resizeShape } from './pptx-gestures';

it('resizes a rotated shape around its opposite corner without flipping at minimum size', () => {
  const original = { x: 0, y: 0, width: 1000000, height: 500000, rotation: 90 };
  expect(resizeShape(original, 'se', -100000, 200000)).toEqual({
    x: -150000,
    y: 50000,
    width: 1200000,
    height: 600000,
  });
  const minimum = resizeShape(original, 'nw', 10000000, 10000000);
  expect(minimum.width).toBeGreaterThan(0);
  expect(minimum.height).toBeGreaterThan(0);
});
