// Adapted from Xpert ClawXpert shared file editors; preserve original Office package data.
import type JSZip from 'jszip';
import { type PptxShape, type PptxLineEnd } from './pptx-types';

export const EMU_PER_PX = 9525;

export const DEFAULT_FONT_SIZE = 18;

export const DEFAULT_TEXT_COLOR = rgbColor(31, 41, 55);

const DEFAULT_THEME: Record<string, string> = {
  dk1: rgbColor(0, 0, 0),
  lt1: rgbColor(255, 255, 255),
  dk2: rgbColor(31, 41, 55),
  lt2: rgbColor(243, 244, 246),
  accent1: rgbColor(68, 114, 196),
  accent2: rgbColor(237, 125, 49),
  accent3: rgbColor(165, 165, 165),
  accent4: rgbColor(255, 192, 0),
  accent5: rgbColor(91, 155, 213),
  accent6: rgbColor(112, 173, 71),
  hlink: rgbColor(5, 99, 193),
  folHlink: rgbColor(149, 79, 114),
};

function rgbColor(red: number, green: number, blue: number) {
  return `#${[red, green, blue].map((channel) => Math.max(0, Math.min(255, channel)).toString(16).padStart(2, '0')).join('')}`;
}

export type XmlElement = Element;

export type ThemeColors = Record<string, string>;

export type RelationshipMap = Map<string, string>;

export type ParentTransform = {
  x: number;
  y: number;
  scaleX: number;
  scaleY: number;
};

export type Transform = {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  flipH: boolean;
  flipV: boolean;
};

export function readFill(
  properties: XmlElement | null,
  node: XmlElement,
  theme: ThemeColors,
) {
  if (directChild(properties, 'noFill')) return null;
  const explicit = resolveColor(directChild(properties, 'solidFill'), theme);
  if (explicit) return explicit;
  const gradient = directChild(properties, 'gradFill');
  const firstStop = directChildren(directChild(gradient, 'gsLst'), 'gs')
    .map((stop) => resolveColor(stop, theme))
    .find((color): color is string => !!color);
  if (firstStop) return firstStop;
  const pattern = directChild(properties, 'pattFill');
  const patternColor = resolveColor(directChild(pattern, 'fgClr'), theme);
  if (patternColor) return patternColor;
  const fillRef = directChild(directChild(node, 'style'), 'fillRef');
  return Number(attr(fillRef, 'idx') ?? 0) > 0
    ? resolveColor(fillRef, theme)
    : null;
}

/**
 * Convert the common OOXML fill forms to a CSS paint. Keeping this separate from
 * `fill` lets the editor preserve the original XML while still showing gradients,
 * alpha and patterns accurately in the browser.
 */
export function readFillCss(
  properties: XmlElement | null,
  node: XmlElement,
  theme: ThemeColors,
): string | undefined {
  if (directChild(properties, 'noFill')) return undefined;
  const solid = directChild(properties, 'solidFill');
  const solidColor = resolveColor(solid, theme);
  if (solidColor) {
    const alpha = colorAlpha(solid);
    return alpha < 1 ? toRgba(solidColor, alpha) : solidColor;
  }
  const gradient = directChild(properties, 'gradFill');
  if (gradient) {
    const stops = directChildren(directChild(gradient, 'gsLst'), 'gs')
      .map((stop) => {
        const color = resolveColor(stop, theme);
        if (!color) return null;
        const position = Math.max(
          0,
          Math.min(100, readAttrNumber(stop, 'pos', 0) / 1000),
        );
        const alpha = colorAlpha(stop);
        return `${alpha < 1 ? toRgba(color, alpha) : color} ${position}%`;
      })
      .filter((value): value is string => !!value);
    if (stops.length >= 2) {
      const lin = directChild(gradient, 'lin');
      const rawAngle = lin ? readAttrNumber(lin, 'ang', 0) / 60000 : 90;
      // CSS's 0deg points up; OOXML's 0deg points left.
      const angle = (((rawAngle + 90) % 360) + 360) % 360;
      return `linear-gradient(${angle}deg, ${stops.join(', ')})`;
    }
  }
  const pattern = directChild(properties, 'pattFill');
  if (pattern) {
    const fg = resolveColor(directChild(pattern, 'fgClr'), theme);
    const bg = resolveColor(directChild(pattern, 'bgClr'), theme);
    if (fg && bg) return patternCss(attr(pattern, 'prst') || 'pct50', fg, bg);
  }
  const fillRef = directChild(directChild(node, 'style'), 'fillRef');
  const refColor =
    Number(attr(fillRef, 'idx') ?? 0) > 0 ? resolveColor(fillRef, theme) : null;
  return refColor ?? undefined;
}

function colorAlpha(node: XmlElement | null) {
  const color = node
    ? directChildren(node).find((child) =>
        ['srgbClr', 'schemeClr', 'sysClr', 'prstClr'].includes(
          localName(child),
        ),
      )
    : null;
  const alpha = color ? directChild(color, 'alpha') : null;
  const alphaMod = color ? directChild(color, 'alphaModFix') : null;
  const value = alpha
    ? readAttrNumber(alpha, 'val', 100000)
    : alphaMod
      ? readAttrNumber(alphaMod, 'amt', 100000)
      : 100000;
  return Math.max(0, Math.min(1, value / 100000));
}

function toRgba(color: string, alpha: number) {
  const hex = color.slice(-6);
  const red = parseInt(hex.slice(0, 2), 16);
  const green = parseInt(hex.slice(2, 4), 16);
  const blue = parseInt(hex.slice(4, 6), 16);
  return `rgba(${red}, ${green}, ${blue}, ${Math.round(alpha * 1000) / 1000})`;
}

function patternCss(preset: string, foreground: string, background: string) {
  const grid = patternGrid(preset);
  const pixels = grid
    .map((row, y) =>
      row
        .map(
          (isForeground, x) =>
            `<rect x="${x}" y="${y}" width="1" height="1" fill="${isForeground ? escapeXml(foreground) : escapeXml(background)}"/>`,
        )
        .join(''),
    )
    .join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8" viewBox="0 0 8 8" shape-rendering="crispEdges">${pixels}</svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

/** GenOffice and PowerPoint use the classic 8x8 GDI hatch masks for pattFill. */
function patternGrid(preset: string): boolean[][] {
  const bayer = [
    [0, 32, 8, 40, 2, 34, 10, 42],
    [48, 16, 56, 24, 50, 18, 58, 26],
    [12, 44, 4, 36, 14, 46, 6, 38],
    [60, 28, 52, 20, 62, 30, 54, 22],
    [3, 35, 11, 43, 1, 33, 9, 41],
    [51, 19, 59, 27, 49, 17, 57, 25],
    [15, 47, 7, 39, 13, 45, 5, 37],
    [63, 31, 55, 23, 61, 29, 53, 21],
  ];
  const percentages: Record<string, number> = {
    pct5: 5,
    pct10: 10,
    pct20: 20,
    pct25: 25,
    pct30: 30,
    pct40: 40,
    pct50: 50,
    pct60: 60,
    pct70: 70,
    pct75: 75,
    pct80: 80,
    pct90: 90,
  };
  const density = percentages[preset];
  if (density != null) {
    const threshold = (density / 100) * 64;
    return bayer.map((row) => row.map((value) => value < threshold));
  }
  const masks: Record<string, number[]> = {
    horz: [0xff, 0, 0, 0, 0xff, 0, 0, 0],
    vert: [0x88, 0x88, 0x88, 0x88, 0x88, 0x88, 0x88, 0x88],
    ltHorz: [0xff, 0, 0, 0, 0, 0, 0, 0],
    ltVert: [0x80, 0x80, 0x80, 0x80, 0x80, 0x80, 0x80, 0x80],
    dkHorz: [0xff, 0xff, 0, 0, 0xff, 0xff, 0, 0],
    dkVert: [0xcc, 0xcc, 0xcc, 0xcc, 0xcc, 0xcc, 0xcc, 0xcc],
    narHorz: [0xff, 0, 0xff, 0, 0xff, 0, 0xff, 0],
    narVert: [0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa],
    dashHorz: [0xf0, 0, 0, 0, 0x0f, 0, 0, 0],
    dashVert: [0x80, 0x80, 0x80, 0x80, 0x08, 0x08, 0x08, 0x08],
    cross: [0xff, 0x80, 0x80, 0x80, 0x80, 0x80, 0x80, 0x80],
    dnDiag: [0x88, 0x44, 0x22, 0x11, 0x88, 0x44, 0x22, 0x11],
    upDiag: [0x11, 0x22, 0x44, 0x88, 0x11, 0x22, 0x44, 0x88],
    ltDnDiag: [0x80, 0x40, 0x20, 0x10, 0x08, 0x04, 0x02, 0x01],
    ltUpDiag: [0x01, 0x02, 0x04, 0x08, 0x10, 0x20, 0x40, 0x80],
    dkDnDiag: [0xcc, 0x66, 0x33, 0x99, 0xcc, 0x66, 0x33, 0x99],
    dkUpDiag: [0x33, 0x66, 0xcc, 0x99, 0x33, 0x66, 0xcc, 0x99],
    wdDnDiag: [0xe1, 0xf0, 0x78, 0x3c, 0x1e, 0x0f, 0x87, 0xc3],
    wdUpDiag: [0x87, 0x0f, 0x1e, 0x3c, 0x78, 0xf0, 0xe1, 0xc3],
    dashDnDiag: [0x80, 0x40, 0x20, 0x10, 0, 0, 0, 0],
    dashUpDiag: [0x01, 0x02, 0x04, 0x08, 0, 0, 0, 0],
    diagCross: [0x99, 0x66, 0x66, 0x99, 0x99, 0x66, 0x66, 0x99],
    smCheck: [0xcc, 0xcc, 0x33, 0x33, 0xcc, 0xcc, 0x33, 0x33],
    lgCheck: [0xf0, 0xf0, 0xf0, 0xf0, 0x0f, 0x0f, 0x0f, 0x0f],
    smGrid: [0xff, 0x88, 0x88, 0x88, 0xff, 0x88, 0x88, 0x88],
    lgGrid: [0xff, 0x80, 0x80, 0x80, 0x80, 0x80, 0x80, 0x80],
    dotGrid: [0xaa, 0, 0x80, 0, 0x80, 0, 0x80, 0],
    smConfetti: [0x01, 0x10, 0x02, 0x40, 0x08, 0x80, 0x04, 0x20],
    lgConfetti: [0x8c, 0x31, 0x03, 0xc6, 0x18, 0x63, 0x30, 0xc4],
    horzBrick: [0xff, 0x80, 0x80, 0x80, 0xff, 0x08, 0x08, 0x08],
    diagBrick: [0x80, 0x40, 0x20, 0x10, 0x08, 0x14, 0x22, 0x41],
    solidDmnd: [0x10, 0x38, 0x7c, 0xfe, 0x7c, 0x38, 0x10, 0],
    openDmnd: [0x10, 0x28, 0x44, 0x82, 0x44, 0x28, 0x10, 0],
    dotDmnd: [0x10, 0, 0x44, 0, 0x10, 0, 0, 0],
    plaid: [0xaa, 0x55, 0xaa, 0x55, 0xf0, 0xf0, 0xf0, 0xf0],
    sphere: [0x38, 0x44, 0x92, 0xaa, 0x92, 0x44, 0x38, 0],
    weave: [0x88, 0x54, 0x22, 0x45, 0x88, 0x15, 0x22, 0x51],
    divot: [0x08, 0x14, 0, 0, 0x80, 0x41, 0, 0],
    shingle: [0x80, 0x40, 0x20, 0xe0, 0x02, 0x04, 0x08, 0x07],
    wave: [0, 0x60, 0x99, 0x06, 0, 0x60, 0x99, 0x06],
    trellis: [0xff, 0x55, 0xff, 0x55, 0xff, 0x55, 0xff, 0x55],
    zigZag: [0x11, 0x22, 0x44, 0x88, 0x88, 0x44, 0x22, 0x11],
  };
  const mask = masks[preset] ?? masks.cross;
  return mask.map((row) =>
    Array.from({ length: 8 }, (_, column) => !!(row & (1 << (7 - column)))),
  );
}

function escapeXml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function readStroke(properties: XmlElement | null, theme: ThemeColors) {
  return resolveColor(
    directChild(directChild(properties, 'ln'), 'solidFill'),
    theme,
  );
}

export function geometryOf(
  properties: XmlElement | null,
): PptxShape['geometry'] {
  const preset = attr(directChild(properties, 'prstGeom'), 'prst');
  return preset || 'rect';
}

export function readGeometryAdjust(properties: XmlElement | null) {
  const avLst = directChild(directChild(properties, 'prstGeom'), 'avLst');
  const result: Record<string, number> = {};
  for (const guide of directChildren(avLst, 'gd')) {
    const name = attr(guide, 'name');
    const formula = attr(guide, 'fmla');
    const match = formula?.match(/(?:^|\s)val\s+(-?\d+(?:\.\d+)?)/i);
    if (name && match) result[name] = Number(match[1]);
  }
  return Object.keys(result).length ? result : undefined;
}

export function readLineEnd(node: XmlElement | null): PptxLineEnd | undefined {
  const type = attr(node, 'type');
  if (!type || type === 'none') return type === 'none' ? 'none' : undefined;
  if (
    type === 'triangle' ||
    type === 'stealth' ||
    type === 'diamond' ||
    type === 'oval' ||
    type === 'open'
  )
    return type;
  return undefined;
}

export function readImageCrop(blipFill: XmlElement | null) {
  const crop = directChild(blipFill, 'srcRect');
  return crop
    ? {
        left: Number(attr(crop, 'l') ?? 0) / 100000,
        top: Number(attr(crop, 't') ?? 0) / 100000,
        right: Number(attr(crop, 'r') ?? 0) / 100000,
        bottom: Number(attr(crop, 'b') ?? 0) / 100000,
      }
    : null;
}

export function readTransform(xfrm: XmlElement | null): Transform {
  const off = directChild(xfrm, 'off');
  const ext = directChild(xfrm, 'ext');
  return {
    x: readAttrNumber(off, 'x', 0),
    y: readAttrNumber(off, 'y', 0),
    width: readAttrNumber(ext, 'cx', 0),
    height: readAttrNumber(ext, 'cy', 0),
    rotation: Number(attr(xfrm, 'rot') ?? 0) / 60000,
    flipH: attr(xfrm, 'flipH') === '1',
    flipV: attr(xfrm, 'flipV') === '1',
  };
}

export function readGroupTransform(xfrm: XmlElement | null) {
  const off = directChild(xfrm, 'off');
  const ext = directChild(xfrm, 'ext');
  const childOff = directChild(xfrm, 'chOff');
  const childExt = directChild(xfrm, 'chExt');
  const childWidth = Math.max(1, readAttrNumber(childExt, 'cx', 1));
  const childHeight = Math.max(1, readAttrNumber(childExt, 'cy', 1));
  return {
    x: readAttrNumber(off, 'x', 0),
    y: readAttrNumber(off, 'y', 0),
    childX: readAttrNumber(childOff, 'x', 0),
    childY: readAttrNumber(childOff, 'y', 0),
    scaleX: readAttrNumber(ext, 'cx', childWidth) / childWidth,
    scaleY: readAttrNumber(ext, 'cy', childHeight) / childHeight,
  };
}

export function applyParent(
  rect: Transform,
  parent: ParentTransform,
): Transform {
  return {
    ...rect,
    x: parent.x + rect.x * parent.scaleX,
    y: parent.y + rect.y * parent.scaleY,
    width: rect.width * parent.scaleX,
    height: rect.height * parent.scaleY,
  };
}

export function parseRelationships(
  xml: string,
  source: string,
): RelationshipMap {
  const result = new Map<string, string>();
  const document = parseXml(xml);
  for (const relationship of directChildren(document)) {
    const id = attr(relationship, 'Id');
    const target = attr(relationship, 'Target');
    if (id && target && attr(relationship, 'TargetMode') !== 'External')
      result.set(id, resolveZipPath(source, target));
  }
  return result;
}

export function findRelationship(relationships: RelationshipMap, type: string) {
  const folder =
    type === 'slideLayout'
      ? 'slideLayouts'
      : type === 'slideMaster'
        ? 'slideMasters'
        : type;
  for (const path of relationships.values())
    if (path.includes(`/${folder}/`)) return path;
  return null;
}

export async function loadTheme(
  zip: JSZip,
  relationships: RelationshipMap,
  fallback: ThemeColors = DEFAULT_THEME,
) {
  const themePath = [...relationships.values()].find((path) =>
    path.includes('/theme/'),
  );
  if (!themePath || !zip.file(themePath)) return fallback;
  const scheme = firstDescendant(
    parseXml(await requiredXml(zip, themePath)),
    'clrScheme',
  );
  const colors = { ...fallback };
  for (const child of directChildren(scheme)) {
    const color = resolveColor(child, fallback);
    if (color) colors[localName(child)] = color;
  }
  return colors;
}

export async function loadImage(
  zip: JSZip,
  path: string,
  cache: Map<string, string>,
) {
  const cached = cache.get(path);
  if (cached) return cached;
  const file = zip.file(path);
  if (!file) return null;
  const base64 = await file.async('base64');
  const extension = path.split('.').pop()?.toLowerCase() ?? 'png';
  const mime =
    extension === 'jpg' || extension === 'jpeg'
      ? 'image/jpeg'
      : extension === 'svg'
        ? 'image/svg+xml'
        : `image/${extension}`;
  const value = `data:${mime};base64,${base64}`;
  cache.set(path, value);
  return value;
}

export function imageEmbedId(blip: XmlElement | null) {
  const direct = attr(blip, 'r:embed');
  if (direct) return direct;
  const extList = directChild(blip, 'extLst');
  for (const extension of directChildren(extList, 'ext')) {
    for (const child of directChildren(extension)) {
      if (localName(child).endsWith('svgBlip')) {
        const embed = attr(child, 'r:embed');
        if (embed) return embed;
      }
    }
  }
  return null;
}

export function readImageOpacity(blip: XmlElement | null) {
  const alpha = directChild(blip, 'alphaModFix');
  if (!alpha) return undefined;
  return Math.max(
    0,
    Math.min(1, readAttrNumber(alpha, 'amt', 100000) / 100000),
  );
}

export function resolveColor(
  node: XmlElement | null,
  theme: ThemeColors,
): string | null {
  if (!node) return null;
  const color = directChildren(node).find((child) =>
    ['srgbClr', 'schemeClr', 'sysClr', 'prstClr'].includes(localName(child)),
  );
  if (!color) return null;
  const raw =
    localName(color) === 'srgbClr' || localName(color) === 'sysClr'
      ? (attr(color, 'lastClr') ?? attr(color, 'val'))
      : localName(color) === 'schemeClr'
        ? theme[attr(color, 'val') ?? '']
        : presetColor(attr(color, 'val'));
  const normalized = raw ? normalizeHex(raw) : null;
  return normalized ? applyColorModifiers(normalized, color) : null;
}

function applyColorModifiers(color: string, node: XmlElement) {
  const hex = color.slice(-6);
  let red = parseInt(hex.slice(0, 2), 16);
  let green = parseInt(hex.slice(2, 4), 16);
  let blue = parseInt(hex.slice(4, 6), 16);
  const modifier = (name: string) => {
    const child = directChild(node, name);
    return child
      ? Math.max(0, Math.min(100000, readAttrNumber(child, 'val', 100000))) /
          100000
      : null;
  };
  const tint = modifier('tint');
  const shade = modifier('shade');
  const lumMod = modifier('lumMod');
  const lumOff = modifier('lumOff');
  if (tint != null) {
    red += (255 - red) * tint;
    green += (255 - green) * tint;
    blue += (255 - blue) * tint;
  }
  if (shade != null) {
    red *= shade;
    green *= shade;
    blue *= shade;
  }
  if (lumMod != null || lumOff != null) {
    const mod = lumMod ?? 1;
    const off = lumOff ?? 0;
    red = red * mod + 255 * off;
    green = green * mod + 255 * off;
    blue = blue * mod + 255 * off;
  }
  return rgbColor(Math.round(red), Math.round(green), Math.round(blue));
}

function presetColor(value: string | null) {
  const colors: Record<string, string> = {
    black: rgbColor(0, 0, 0),
    white: rgbColor(255, 255, 255),
    red: rgbColor(255, 0, 0),
    green: rgbColor(0, 128, 0),
    blue: rgbColor(0, 0, 255),
    yellow: rgbColor(255, 255, 0),
    cyan: rgbColor(0, 255, 255),
    magenta: rgbColor(255, 0, 255),
    gray: rgbColor(128, 128, 128),
    orange: rgbColor(255, 165, 0),
    purple: rgbColor(128, 0, 128),
    transparent: rgbColor(255, 255, 255),
  };
  return value ? (colors[value] ?? null) : null;
}

function normalizeHex(value: string) {
  const hex = value.replace('#', '').slice(-6);
  return /^[0-9a-f]{6}$/i.test(hex) ? `#${hex}` : DEFAULT_TEXT_COLOR;
}

export function parseXml(xml: string): XmlElement {
  const document = new DOMParser().parseFromString(xml, 'application/xml');
  if (document.getElementsByTagName('parsererror').length)
    throw new Error('Invalid Office XML.');
  return document.documentElement;
}

export function directChild(
  node: XmlElement | null | undefined,
  name: string | null,
): XmlElement | null {
  return name
    ? (directChildren(node).find((child) => localName(child) === name) ?? null)
    : null;
}

export function directChildren(
  node: XmlElement | null | undefined,
  name?: string,
): XmlElement[] {
  return node
    ? Array.from(node.children).filter(
        (child) => !name || localName(child) === name,
      )
    : [];
}

/** OOXML may wrap a renderable shape in mc:AlternateContent. Prefer the first
 * Choice (modern Office markup) and use Fallback when a choice is absent. */
export function renderChildren(
  node: XmlElement | null | undefined,
): XmlElement[] {
  const result: XmlElement[] = [];
  for (const child of directChildren(node)) {
    if (localName(child) !== 'AlternateContent') {
      result.push(child);
      continue;
    }
    const branch =
      directChild(child, 'Choice') ?? directChild(child, 'Fallback');
    result.push(...directChildren(branch));
  }
  return result;
}

export function firstDescendant(
  node: XmlElement | null | undefined,
  name: string,
): XmlElement | null {
  return node
    ? localName(node) === name
      ? node
      : (Array.from(node.getElementsByTagName('*')).find(
          (child) => localName(child) === name,
        ) ?? null)
    : null;
}

export function textOf(node: XmlElement | null) {
  return node?.textContent ?? '';
}

export function localName(node: Element | null | undefined) {
  return node?.localName || node?.tagName?.split(':').pop() || '';
}

export function attr(node: XmlElement | null | undefined, name: string) {
  return node?.getAttribute(name) ?? null;
}

export function readAttrNumber(
  node: XmlElement | null | undefined,
  name: string,
  fallback: number,
) {
  const raw = attr(node, name);
  if (raw == null || raw === '') return fallback;
  const value = Number(raw);
  return Number.isFinite(value) ? value : fallback;
}

export function readNumber(
  document: XmlElement,
  elementName: string,
  attribute: string,
  fallback: number,
) {
  const element = Array.from(document.getElementsByTagName('*')).find(
    (node) => localName(node) === elementName,
  );
  return readAttrNumber(element, attribute, fallback);
}

export function shapeIdOf(node: XmlElement | null) {
  return (
    attr(directChild(directChild(node, 'nvSpPr'), 'cNvPr'), 'id') ??
    attr(directChild(directChild(node, 'nvCxnSpPr'), 'cNvPr'), 'id') ??
    attr(directChild(directChild(node, 'nvPicPr'), 'cNvPr'), 'id') ??
    attr(directChild(directChild(node, 'nvGraphicFramePr'), 'cNvPr'), 'id')
  );
}

function resolveZipPath(source: string, target: string) {
  // Office relationship targets may be package-root absolute paths (for
  // example `/ppt/slides/charts/chart1.xml`) as well as paths relative to the
  // relationship part. Root targets must not inherit the source directory.
  if (target.startsWith('/')) {
    return target.replace(/^\/+/, '').split('/').filter(Boolean).join('/');
  }
  const parts = source.split('/');
  parts.pop();
  for (const part of target.split('/')) {
    if (!part || part === '.') continue;
    if (part === '..') parts.pop();
    else parts.push(part);
  }
  return parts.join('/');
}

export async function requiredXml(zip: JSZip, path: string) {
  const file = zip.file(path);
  if (!file) throw new Error(`Presentation package is missing ${path}.`);
  return file.async('text');
}
