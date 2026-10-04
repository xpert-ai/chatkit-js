import type { PptxShape } from './pptx-file.utils';
export type ShapeBounds = Pick<PptxShape, 'x' | 'y' | 'width' | 'height'>;
export type ResizeCorner = 'nw' | 'ne' | 'sw' | 'se';

/** Resize in the shape's local axes while keeping the opposite corner fixed. */
export function resizeShape(
  shape: ShapeBounds & { rotation: number },
  corner: ResizeCorner,
  dx: number,
  dy: number,
): ShapeBounds {
  const angle = (shape.rotation * Math.PI) / 180;
  const cos = Math.cos(angle),
    sin = Math.sin(angle);
  const localX = dx * cos + dy * sin,
    localY = -dx * sin + dy * cos;
  const sx = corner.endsWith('e') ? 1 : -1,
    sy = corner.startsWith('s') ? 1 : -1;
  const width = Math.max(91440, shape.width + sx * localX);
  const height = Math.max(91440, shape.height + sy * localY);
  const cx = (sx * (width - shape.width)) / 2,
    cy = (sy * (height - shape.height)) / 2;
  return {
    x: Math.round(shape.x + (shape.width - width) / 2 + cx * cos - cy * sin),
    y: Math.round(shape.y + (shape.height - height) / 2 + cx * sin + cy * cos),
    width: Math.round(width),
    height: Math.round(height),
  };
}
