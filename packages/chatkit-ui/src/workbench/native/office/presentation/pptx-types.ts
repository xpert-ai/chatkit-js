// Adapted from Xpert ClawXpert shared file editors; preserve original Office package data.

export type PptxRun = {
  text: string;
  fontSizePt: number;
  fontFamily: string | null;
  color: string;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  strike: boolean;
  superscript: boolean;
  subscript: boolean;
};

export type PptxParagraph = {
  text: string;
  runs: PptxRun[];
  align: 'left' | 'center' | 'right' | 'justify';
  level: number;
  lineHeight?: number;
  lineSpacingPt?: number;
  spaceBeforePt?: number;
  spaceAfterPt?: number;
  /** Paragraph left margin from a:pPr/@marL, in points. */
  marginLeftPt?: number;
  indentPt?: number;
  bullet?: string;
};

export type PptxTableCell = {
  text: string;
  colSpan: number;
  rowSpan: number;
  merged?: boolean;
  fill?: string | null;
  textColor?: string;
  fontSizePt?: number;
  fontFamily?: string | null;
  bold?: boolean;
  italic?: boolean;
  textAlign?: PptxParagraph['align'];
  verticalAlign?: 'top' | 'middle' | 'bottom';
  borderColor?: string | null;
  borderWidth?: number;
  borderTopColor?: string | null;
  borderTopWidth?: number;
  borderRightColor?: string | null;
  borderRightWidth?: number;
  borderBottomColor?: string | null;
  borderBottomWidth?: number;
  borderLeftColor?: string | null;
  borderLeftWidth?: number;
  /** Cell text insets from a:tcPr/@marL/@marR/@marT/@marB, in EMUs. */
  margin?: { left: number; right: number; top: number; bottom: number };
};

export type PptxAnimationEffect =
  | 'appear'
  | 'fade'
  | 'flyIn'
  | 'wipe'
  | 'zoom'
  | 'pulse'
  | 'spin'
  | 'disappear'
  | 'fadeOut';

export type PptxAnimationTrigger = 'onClick' | 'withPrev' | 'afterPrev';

export type PptxShapeAnimation = {
  effect: PptxAnimationEffect;
  trigger: PptxAnimationTrigger;
  durationMs: number;
  delayMs: number;
};

export type PptxTransition =
  | 'none'
  | 'morph'
  | 'fade'
  | 'push'
  | 'wipe'
  | 'split'
  | 'circle'
  | 'cover'
  | 'pull'
  | 'dissolve'
  | 'zoom'
  | 'random';

export type PptxLineEnd =
  | 'none'
  | 'triangle'
  | 'stealth'
  | 'diamond'
  | 'oval'
  | 'open';

export type PptxShape = {
  id: string;
  /** Original OOXML cNvPr id. Render ids are made unique across master/layout/slide layers. */
  sourceId?: string;
  name: string;
  kind: 'shape' | 'image' | 'line' | 'table';
  text: string;
  paragraphs: PptxParagraph[];
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  flipH: boolean;
  flipV: boolean;
  fill: string | null;
  stroke: string | null;
  strokeWidth: number;
  /** OOXML preset geometry. Unknown presets are kept so the source shape can still be
   * rendered with a useful approximation and serialized without being rewritten. */
  geometry:
    | 'rect'
    | 'roundRect'
    | 'ellipse'
    | 'diamond'
    | 'triangle'
    | 'hexagon'
    | 'none'
    | (string & {});
  /** Named OOXML adjustment values from a preset geometry's avLst. */
  geometryAdjust?: Record<string, number>;
  /** Connector endpoint decorations from a:headEnd/a:tailEnd. */
  lineHeadEnd?: PptxLineEnd;
  lineTailEnd?: PptxLineEnd;
  /** OOXML preset dash name for connector and shape outlines. */
  lineDash?: string;
  imageSrc: string | null;
  imagePath?: string;
  imageRelId?: string;
  imageCrop: {
    left: number;
    top: number;
    right: number;
    bottom: number;
  } | null;
  /** Alpha applied by a:blip/a:alphaModFix to a picture. */
  opacity?: number;
  /** CSS representation for read-only gradient/pattern fills. `fill` remains the first
   * solid color used by the edit serializer when a user changes the fill. */
  fillCss?: string;
  editorKind?: 'ink';
  animation?: PptxShapeAnimation | null;
  textColor: string;
  fontSizePt: number;
  fontScale: number;
  fontFamily: string | null;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  strike: boolean;
  superscript: boolean;
  subscript: boolean;
  textAlign: 'left' | 'center' | 'right' | 'justify';
  verticalAlign: 'top' | 'middle' | 'bottom';
  wrap: boolean;
  autoFit: 'none' | 'shrink' | 'resize';
  margin: { left: number; right: number; top: number; bottom: number };
  editable: boolean;
  table: {
    columns: number[];
    rows: PptxTableCell[][];
    rowHeights?: number[];
    rtl?: boolean;
  } | null;
  /** Text as it was read from the package. Used to distinguish formatting-only edits. */
  sourceText?: string;
  /** Text properties were changed through the ribbon. */
  formatDirty?: boolean;
  /** Shape fill, outline, or geometry was changed through the ribbon. */
  shapeStyleDirty?: boolean;
  /** Existing table cell content was edited. */
  tableDirty?: boolean;
  animationDirty?: boolean;
  /** Shape was inserted by the editor and is not present in the source slide XML. */
  created?: boolean;
  /** Keep deleted source shapes in the model so savePptx can remove them from XML. */
  deleted?: boolean;
};

export type PptxSlide = {
  path: string;
  xml: string;
  shapes: PptxShape[];
  background: string | null;
  /** CSS paint for an untouched gradient or pattern slide background. */
  backgroundCss?: string;
  /** New slides are serialized together with their presentation relationships. */
  created?: boolean;
  sourcePath?: string;
  transition?: PptxTransition;
  transitionDirty?: boolean;
  hidden?: boolean;
  hiddenDirty?: boolean;
  animationDirty?: boolean;
  backgroundDirty?: boolean;
};

export type PptxDeck = { width: number; height: number; slides: PptxSlide[] };
