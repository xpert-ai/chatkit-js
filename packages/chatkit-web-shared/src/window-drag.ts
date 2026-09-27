/** Frame-relative CSS pixels. Only non-interactive header space may be draggable. */
export type WindowDragRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};
export type WindowDragRegions = {
  width: number;
  height: number;
  regions: WindowDragRect[];
};

export function subtractWindowDragRect(
  area: WindowDragRect,
  hole: WindowDragRect,
): WindowDragRect[] {
  const left = Math.max(area.x, hole.x);
  const top = Math.max(area.y, hole.y);
  const right = Math.min(area.x + area.width, hole.x + hole.width);
  const bottom = Math.min(area.y + area.height, hole.y + hole.height);
  if (right <= left || bottom <= top) return [area];
  return [
    { x: area.x, y: area.y, width: area.width, height: top - area.y },
    {
      x: area.x,
      y: bottom,
      width: area.width,
      height: area.y + area.height - bottom,
    },
    { x: area.x, y: top, width: left - area.x, height: bottom - top },
    {
      x: right,
      y: top,
      width: area.x + area.width - right,
      height: bottom - top,
    },
  ].filter((rect) => rect.width > 0 && rect.height > 0);
}

export function parseWindowDragRegions(
  value: unknown,
): WindowDragRegions | null {
  if (
    !value ||
    typeof value !== 'object' ||
    !('width' in value) ||
    typeof value.width !== 'number' ||
    !Number.isFinite(value.width) ||
    value.width <= 0 ||
    !('height' in value) ||
    typeof value.height !== 'number' ||
    !Number.isFinite(value.height) ||
    value.height <= 0 ||
    !('regions' in value) ||
    !Array.isArray(value.regions) ||
    value.regions.length > 128
  )
    return null;
  const regions: WindowDragRect[] = [];
  for (const rect of value.regions) {
    if (
      !rect ||
      typeof rect !== 'object' ||
      typeof rect.x !== 'number' ||
      !Number.isFinite(rect.x) ||
      rect.x < 0 ||
      typeof rect.y !== 'number' ||
      !Number.isFinite(rect.y) ||
      rect.y < 0 ||
      typeof rect.width !== 'number' ||
      !Number.isFinite(rect.width) ||
      rect.width <= 0 ||
      typeof rect.height !== 'number' ||
      !Number.isFinite(rect.height) ||
      rect.height <= 0 ||
      rect.x + rect.width > value.width + 1 ||
      rect.y + rect.height > Math.min(value.height, 96) + 1
    )
      return null;
    regions.push({
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height,
    });
  }
  return { width: value.width, height: value.height, regions };
}
