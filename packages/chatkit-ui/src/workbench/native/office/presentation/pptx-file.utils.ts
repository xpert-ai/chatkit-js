// Adapted from Xpert ClawXpert shared file editors; preserve original Office package data.
import type JSZip from 'jszip';
import { readSlideAnimations } from './pptx-animation.utils';
import { renderPptxChart } from './pptx-chart.utils';
import { relationshipPath, syncPresentationSlides } from './pptx-package.utils';
import {
  createBlankSlideXml,
  safeXmlId,
  updateSlideXml,
} from './pptx-slide-serialization.utils';
import { type PptxDeck, type PptxSlide, type PptxShape } from './pptx-types';
import {
  type XmlElement,
  requiredXml,
  parseXml,
  parseRelationships,
  loadTheme,
  readNumber,
  directChildren,
  directChild,
  attr,
  findRelationship,
  renderChildren,
  type ThemeColors,
  type RelationshipMap,
  type ParentTransform,
  localName,
  readGroupTransform,
  applyParent,
  readTransform,
  shapeIdOf,
  firstDescendant,
  geometryOf,
  readGeometryAdjust,
  readFill,
  readFillCss,
  readStroke,
  readAttrNumber,
  EMU_PER_PX,
  readLineEnd,
  imageEmbedId,
  loadImage,
  readImageCrop,
  readImageOpacity,
  resolveColor,
  DEFAULT_TEXT_COLOR,
  type Transform,
  DEFAULT_FONT_SIZE,
} from './pptx-xml.utils';
import { parseTable, readText } from './pptx-text.utils';
export type * from './pptx-types';

export const PPTX_MIME_TYPE =
  'application/vnd.openxmlformats-officedocument.presentationml.presentation';

export function isPptxEditorFile(filePath?: string | null) {
  return (filePath ?? '').split('.').pop()?.toLowerCase() === 'pptx';
}

export function createPptxFile(
  buffer: ArrayBuffer | Blob,
  fileName: string,
  mimeType = PPTX_MIME_TYPE,
) {
  return new File([buffer], fileName || 'presentation.pptx', {
    type: mimeType,
  });
}

const DEFAULT_SLIDE_WIDTH = 12192000;

const DEFAULT_SLIDE_HEIGHT = 6858000;

type PlaceholderInfo = { type: string; idx: string; node: XmlElement };

export async function parsePptx(buffer: ArrayBuffer): Promise<PptxDeck> {
  const JSZip = (await import('jszip')).default;
  const zip = await JSZip.loadAsync(buffer);
  const presentationXml = await requiredXml(zip, 'ppt/presentation.xml');
  const presentation = parseXml(presentationXml);
  const presentationRels = parseRelationships(
    await requiredXml(zip, 'ppt/_rels/presentation.xml.rels'),
    'ppt/presentation.xml',
  );
  const theme = await loadTheme(zip, presentationRels);
  const width = readNumber(presentation, 'sldSz', 'cx', DEFAULT_SLIDE_WIDTH);
  const height = readNumber(presentation, 'sldSz', 'cy', DEFAULT_SLIDE_HEIGHT);
  const slides: PptxSlide[] = [];
  const imageCache = new Map<string, string>();

  for (const slideRef of directChildren(
    directChild(presentation, 'sldIdLst'),
    'sldId',
  )) {
    const relationId = attr(slideRef, 'r:id');
    const path = relationId ? presentationRels.get(relationId) : null;
    if (!path || !zip.file(path)) continue;
    const xml = await requiredXml(zip, path);
    const slide = parseXml(xml);
    const animations = readSlideAnimations(xml);
    const relsPath = `${path.split('/').slice(0, -1).join('/')}/_rels/${path.split('/').pop()}.rels`;
    const slideRels = zip.file(relsPath)
      ? parseRelationships(await requiredXml(zip, relsPath), path)
      : new Map<string, string>();
    const layoutPath = findRelationship(slideRels, 'slideLayout');
    const layoutXml =
      layoutPath && zip.file(layoutPath)
        ? await requiredXml(zip, layoutPath)
        : null;
    const layout = layoutXml ? parseXml(layoutXml) : null;
    const layoutRelsPath = layoutPath
      ? `${layoutPath.split('/').slice(0, -1).join('/')}/_rels/${layoutPath.split('/').pop()}.rels`
      : null;
    const layoutRels =
      layoutRelsPath && zip.file(layoutRelsPath)
        ? parseRelationships(
            await requiredXml(zip, layoutRelsPath),
            layoutPath as string,
          )
        : new Map<string, string>();
    const masterPath = layout
      ? findRelationship(layoutRels, 'slideMaster')
      : null;
    const masterXml =
      masterPath && zip.file(masterPath)
        ? await requiredXml(zip, masterPath)
        : null;
    const master = masterXml ? parseXml(masterXml) : null;
    const masterRelsPath = masterPath
      ? `${masterPath.split('/').slice(0, -1).join('/')}/_rels/${masterPath.split('/').pop()}.rels`
      : null;
    const masterRels =
      masterRelsPath && zip.file(masterRelsPath)
        ? parseRelationships(
            await requiredXml(zip, masterRelsPath),
            masterPath as string,
          )
        : new Map<string, string>();
    const slideTheme = master ? await loadTheme(zip, masterRels, theme) : theme;
    const placeholders = collectPlaceholders(layout, master);
    const ownTree = directChild(directChild(slide, 'cSld'), 'spTree');
    const shapes: PptxShape[] = [];

    for (const source of [master, layout]) {
      const tree = directChild(directChild(source, 'cSld'), 'spTree');
      for (const node of renderChildren(tree)) {
        if (placeholderOf(node)) continue;
        shapes.push(
          ...(await parseNode(node, {
            zip,
            theme: slideTheme,
            relationships: source === master ? masterRels : layoutRels,
            imageCache,
            fallback: null,
            editable: false,
          })),
        );
      }
    }
    for (const node of renderChildren(ownTree)) {
      const ph = placeholderOf(node);
      const fallback = ph
        ? (placeholders.get(placeholderKey(ph)) ??
          placeholders.get(`type:${ph.type}`))
        : null;
      shapes.push(
        ...(await parseNode(node, {
          zip,
          theme: slideTheme,
          relationships: slideRels,
          imageCache,
          fallback: fallback ?? null,
          editable: true,
        })),
      );
    }

    if (!shapes.length)
      throw new Error(
        'This presentation does not contain any renderable slides.',
      );
    const usedIds = new Set<string>();
    for (const shape of shapes) {
      const sourceId = shape.sourceId ?? shape.id;
      let renderId = sourceId;
      let suffix = 2;
      while (usedIds.has(renderId)) renderId = `${sourceId}-${suffix++}`;
      shape.sourceId = sourceId;
      shape.id = renderId;
      if (shape.editable) shape.animation = animations.get(sourceId) ?? null;
      usedIds.add(renderId);
    }
    slides.push({
      path,
      xml,
      shapes: shapes.filter((shape) =>
        shape.kind === 'line'
          ? shape.width > 0 || shape.height > 0
          : shape.width > 0 && shape.height > 0,
      ),
      background:
        readBackground(slide, slideTheme) ??
        readBackground(layout, slideTheme) ??
        readBackground(master, slideTheme),
      backgroundCss:
        readBackgroundCss(slide, slideTheme) ??
        readBackgroundCss(layout, slideTheme) ??
        readBackgroundCss(master, slideTheme),
      transition: transitionOf(slide),
      hidden: attr(slide, 'show') === '0',
    });
  }
  if (!slides.length)
    throw new Error('This presentation does not contain any slides.');
  return { width, height, slides };
}

export async function savePptx(
  deck: PptxDeck,
  sourceBuffer: ArrayBuffer,
): Promise<ArrayBuffer> {
  const JSZip = (await import('jszip')).default;
  const zip = await JSZip.loadAsync(sourceBuffer);
  for (const slide of deck.slides) {
    if (slide.created)
      await copySlideRelationships(
        zip,
        slide.sourcePath,
        slide.path,
        deck.slides,
      );
    await prepareCreatedImages(zip, slide);
    if (!slide.created) {
      zip.file(
        slide.path,
        updateSlideXml(
          slide.xml,
          slide.shapes,
          slide.transition,
          slide.transitionDirty,
          slide.background,
          slide.backgroundDirty,
          slide.hidden,
          slide.hiddenDirty,
          slide.animationDirty,
        ),
      );
      continue;
    }
    const sourceXml = slide.sourcePath
      ? await zip.file(slide.sourcePath)?.async('text')
      : null;
    zip.file(
      slide.path,
      updateSlideXml(
        sourceXml ?? createBlankSlideXml(),
        slide.shapes,
        slide.transition,
        slide.transitionDirty,
        slide.background,
        slide.backgroundDirty,
        slide.hidden,
        slide.hiddenDirty,
        slide.animationDirty,
      ),
    );
  }
  await syncPresentationSlides(zip, deck.slides, deck.width, deck.height);
  return zip.generateAsync({ type: 'arraybuffer', compression: 'DEFLATE' });
}

async function prepareCreatedImages(zip: JSZip, slide: PptxSlide) {
  const imageShapes = slide.shapes.filter(
    (shape) =>
      shape.created &&
      !shape.deleted &&
      shape.kind === 'image' &&
      shape.imageSrc?.startsWith('data:'),
  );
  if (!imageShapes.length) return;
  const relPath = relationshipPath(slide.path);
  let relXml = zip.file(relPath)
    ? await zip.file(relPath)!.async('text')
    : '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>';
  let next =
    Math.max(
      0,
      ...[...relXml.matchAll(/Id="rId(\d+)"/gi)].map((m) => Number(m[1])),
    ) + 1;
  for (const shape of imageShapes) {
    const match = shape.imageSrc!.match(/^data:([^;,]+);base64,(.+)$/);
    if (!match) continue;
    const ext = match[1].includes('svg')
      ? 'svg'
      : match[1].includes('webp')
        ? 'webp'
        : match[1].includes('jpeg') || match[1].includes('jpg')
          ? 'jpg'
          : 'png';
    const path = `ppt/media/editor-${safeXmlId(shape.id)}.${ext}`;
    const relId = `rId${next++}`;
    zip.file(path, match[2], { base64: true });
    shape.imagePath = path;
    shape.imageRelId = relId;
    relXml = relXml.replace(
      /<\/Relationships>/i,
      `<Relationship Id="${relId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/editor-${safeXmlId(shape.id)}.${ext}"/></Relationships>`,
    );
  }
  zip.file(relPath, relXml);
  const contentTypes = zip.file('[Content_Types].xml');
  if (contentTypes) {
    let xml = await contentTypes.async('text');
    if (!/<Default[^>]+Extension="png"/i.test(xml))
      xml = xml.replace(
        /<\/Types>/i,
        '<Default Extension="png" ContentType="image/png"/></Types>',
      );
    if (!/<Default[^>]+Extension="jpg"/i.test(xml))
      xml = xml.replace(
        /<\/Types>/i,
        '<Default Extension="jpg" ContentType="image/jpeg"/></Types>',
      );
    if (!/<Default[^>]+Extension="svg"/i.test(xml))
      xml = xml.replace(
        /<\/Types>/i,
        '<Default Extension="svg" ContentType="image/svg+xml"/></Types>',
      );
    if (!/<Default[^>]+Extension="webp"/i.test(xml))
      xml = xml.replace(
        /<\/Types>/i,
        '<Default Extension="webp" ContentType="image/webp"/></Types>',
      );
    zip.file('[Content_Types].xml', xml);
  }
}

async function copySlideRelationships(
  zip: JSZip,
  sourcePath: string | undefined,
  targetPath: string,
  slides: PptxSlide[],
) {
  const source = sourcePath ?? slides.find((slide) => !slide.created)?.path;
  if (!source) return;
  const sourceRels = relationshipPath(source);
  const targetRels = relationshipPath(targetPath);
  const relFile = zip.file(sourceRels);
  if (relFile) zip.file(targetRels, await relFile.async('text'));
}

async function parseNode(
  node: XmlElement,
  context: {
    zip: JSZip;
    theme: ThemeColors;
    relationships: RelationshipMap;
    imageCache: Map<string, string>;
    fallback: PlaceholderInfo | null;
    editable: boolean;
  },
  parent: ParentTransform = { x: 0, y: 0, scaleX: 1, scaleY: 1 },
): Promise<PptxShape[]> {
  const kind = localName(node);
  if (kind === 'AlternateContent') {
    const choice = directChild(node, 'Choice') ?? directChild(node, 'Fallback');
    const result: PptxShape[] = [];
    for (const child of directChildren(choice))
      result.push(...(await parseNode(child, context, parent)));
    return result;
  }
  if (kind === 'grpSp') {
    const group = readGroupTransform(
      directChild(directChild(node, 'grpSpPr'), 'xfrm'),
    );
    const nextParent = {
      x: parent.x + (group.x - group.childX) * parent.scaleX,
      y: parent.y + (group.y - group.childY) * parent.scaleY,
      scaleX: parent.scaleX * group.scaleX,
      scaleY: parent.scaleY * group.scaleY,
    };
    const result: PptxShape[] = [];
    for (const child of renderChildren(node)) {
      if (['nvGrpSpPr', 'grpSpPr'].includes(localName(child))) continue;
      result.push(...(await parseNode(child, context, nextParent)));
    }
    return result;
  }
  if (!['sp', 'pic', 'cxnSp', 'graphicFrame'].includes(kind)) return [];
  const fallbackNode = context.fallback?.node ?? null;
  const xfrm =
    directChild(
      directChild(
        node,
        kind === 'pic' ? 'spPr' : kind === 'graphicFrame' ? null : 'spPr',
      ),
      'xfrm',
    ) ??
    (kind === 'graphicFrame' ? directChild(node, 'xfrm') : null) ??
    (fallbackNode
      ? directChild(directChild(fallbackNode, 'spPr'), 'xfrm')
      : null);
  const rect = applyParent(readTransform(xfrm), parent);
  const id = shapeIdOf(node) ?? `shape-${directChildren(node).length}`;
  const nonVisualProperties = directChild(
    directChild(
      node,
      kind === 'pic'
        ? 'nvPicPr'
        : kind === 'graphicFrame'
          ? 'nvGraphicFramePr'
          : kind === 'cxnSp'
            ? 'nvCxnSpPr'
            : 'nvSpPr',
    ),
    'cNvPr',
  );
  const name = attr(nonVisualProperties, 'name') ?? '';
  const shape = baseShape(id, name, rect, context.editable);
  if (attr(nonVisualProperties, 'descr') === 'xpert:ink')
    shape.editorKind = 'ink';
  if (kind === 'graphicFrame') {
    const table = parseTable(
      directChild(directChild(node, 'graphic'), 'graphicData'),
      context.theme,
    );
    if (table) {
      const gridWidth =
        table.columns.reduce((sum, width) => sum + Math.max(0, width), 0) *
        parent.scaleX;
      const gridHeight =
        (table.rowHeights ?? []).reduce(
          (sum, height) => sum + Math.max(0, height),
          0,
        ) * parent.scaleY;
      return [
        {
          ...shape,
          kind: 'table',
          table,
          geometry: 'none',
          width: gridWidth > 0 ? gridWidth : shape.width,
          height: gridHeight > 0 ? gridHeight : shape.height,
        },
      ];
    }
    const chartNode = firstDescendant(node, 'chart');
    const chartRelation = attr(chartNode, 'r:id');
    const chartPath = chartRelation
      ? context.relationships.get(chartRelation)
      : null;
    const chartSrc = chartPath
      ? await renderPptxChart(context.zip, chartPath, context.theme)
      : null;
    return chartSrc
      ? [
          {
            ...shape,
            kind: 'image',
            imageSrc: chartSrc,
            imageCrop: null,
            fill: null,
            stroke: null,
            paragraphs: [],
            text: '',
          },
        ]
      : [];
  }
  const properties =
    directChild(node, 'spPr') ??
    (fallbackNode ? directChild(fallbackNode, 'spPr') : null);
  const style =
    directChild(node, 'style') ??
    (fallbackNode ? directChild(fallbackNode, 'style') : null);
  shape.kind = kind === 'pic' ? 'image' : kind === 'cxnSp' ? 'line' : 'shape';
  const parsedGeometry = geometryOf(properties);
  shape.geometry =
    kind === 'cxnSp' && parsedGeometry === 'rect' ? 'line' : parsedGeometry;
  shape.geometryAdjust = readGeometryAdjust(properties);
  shape.fill = readFill(properties, node, context.theme);
  shape.fillCss = readFillCss(properties, node, context.theme);
  shape.stroke = readStroke(properties, context.theme);
  // Keep stroke widths in CSS pixels.  A few earlier editor builds wrote the
  // pixel value as if it were EMUs; clamping protects those files from
  // producing multi-thousand-pixel borders when reopened.
  shape.strokeWidth = Math.min(
    24,
    readAttrNumber(directChild(properties, 'ln'), 'w', 0) / EMU_PER_PX,
  );
  if (shape.kind === 'line') {
    const line = directChild(properties, 'ln');
    shape.lineHeadEnd = readLineEnd(directChild(line, 'headEnd'));
    shape.lineTailEnd = readLineEnd(directChild(line, 'tailEnd'));
    shape.lineDash = attr(directChild(line, 'prstDash'), 'val') ?? undefined;
  }
  if (kind === 'pic') {
    const blipFill = directChild(node, 'blipFill');
    const blip = directChild(blipFill, 'blip');
    const embed = imageEmbedId(blip);
    const imagePath = embed ? context.relationships.get(embed) : null;
    shape.imageSrc = imagePath
      ? await loadImage(context.zip, imagePath, context.imageCache)
      : null;
    shape.imageCrop = readImageCrop(blipFill);
    shape.opacity = readImageOpacity(blip);
  } else {
    const blipFill = directChild(properties, 'blipFill');
    const blip = directChild(blipFill, 'blip');
    const embed = imageEmbedId(blip);
    const imagePath = embed ? context.relationships.get(embed) : null;
    if (imagePath) {
      shape.kind = 'image';
      shape.imageSrc = await loadImage(
        context.zip,
        imagePath,
        context.imageCache,
      );
      shape.imageCrop = readImageCrop(blipFill);
      shape.opacity = readImageOpacity(blip);
    }
  }
  const textBody = directChild(node, 'txBody');
  if (textBody)
    Object.assign(
      shape,
      readText(
        textBody,
        context.theme,
        fallbackNode ? directChild(fallbackNode, 'txBody') : null,
        resolveColor(directChild(style, 'fontRef'), context.theme) ??
          DEFAULT_TEXT_COLOR,
      ),
    );
  return [shape];
}

function baseShape(
  id: string,
  name: string,
  rect: Transform,
  editable: boolean,
): PptxShape {
  return {
    id,
    sourceId: id,
    name,
    kind: 'shape',
    text: '',
    paragraphs: [],
    x: rect.x,
    y: rect.y,
    width: rect.width,
    height: rect.height,
    rotation: rect.rotation,
    flipH: rect.flipH,
    flipV: rect.flipV,
    fill: null,
    stroke: null,
    strokeWidth: 0,
    geometry: 'rect',
    imageSrc: null,
    imageCrop: null,
    textColor: DEFAULT_TEXT_COLOR,
    fontSizePt: DEFAULT_FONT_SIZE,
    fontScale: 1,
    fontFamily: null,
    bold: false,
    italic: false,
    underline: false,
    strike: false,
    superscript: false,
    subscript: false,
    textAlign: 'left',
    verticalAlign: 'top',
    wrap: true,
    autoFit: 'none',
    margin: { left: 91440, right: 91440, top: 45720, bottom: 45720 },
    editable,
    table: null,
    sourceText: '',
    formatDirty: false,
  };
}

function collectPlaceholders(
  layout: XmlElement | null,
  master: XmlElement | null,
) {
  const result = new Map<string, PlaceholderInfo>();
  for (const source of [master, layout]) {
    const tree = directChild(directChild(source, 'cSld'), 'spTree');
    for (const node of directChildren(tree)) {
      const ph = placeholderOf(node);
      if (!ph) continue;
      const info = { ...ph, node };
      result.set(placeholderKey(ph), info);
      if (!result.has(`type:${ph.type}`)) result.set(`type:${ph.type}`, info);
    }
  }
  return result;
}

function placeholderOf(
  node: XmlElement | null,
): { type: string; idx: string } | null {
  const ph =
    firstDescendant(directChild(node, 'nvPr'), 'ph') ??
    firstDescendant(node, 'ph');
  return ph
    ? { type: attr(ph, 'type') ?? 'body', idx: attr(ph, 'idx') ?? '0' }
    : null;
}

function placeholderKey(ph: { type: string; idx: string }) {
  return `${ph.type}:${ph.idx}`;
}

function readBackground(
  source: XmlElement | null,
  theme: ThemeColors,
): string | null {
  const cSld = directChild(source, 'cSld');
  return resolveColor(
    directChild(directChild(directChild(cSld, 'bg'), 'bgPr'), 'solidFill'),
    theme,
  );
}

function readBackgroundCss(
  source: XmlElement | null,
  theme: ThemeColors,
): string | undefined {
  const cSld = directChild(source, 'cSld');
  const bg = directChild(cSld, 'bg');
  const bgPr = directChild(bg, 'bgPr');
  if (bgPr) return readFillCss(bgPr, source ?? bgPr, theme);
  return resolveColor(directChild(bg, 'bgRef'), theme) ?? undefined;
}

function transitionOf(slide: XmlElement) {
  const transition = firstDescendant(slide, 'transition');
  if (!transition) return 'none' as const;
  if (firstDescendant(transition, 'morph')) return 'morph' as const;
  const kinds = [
    'fade',
    'push',
    'wipe',
    'split',
    'circle',
    'cover',
    'pull',
    'dissolve',
    'zoom',
    'random',
  ] as const;
  return kinds.find((kind) => directChild(transition, kind)) ?? 'none';
}
