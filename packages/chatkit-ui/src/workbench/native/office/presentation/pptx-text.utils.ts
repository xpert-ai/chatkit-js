// Adapted from Xpert ClawXpert shared file editors; preserve original Office package data.
import {
  type PptxParagraph,
  type PptxRun,
  type PptxShape,
  type PptxTableCell,
} from './pptx-types';
import {
  type XmlElement,
  type ThemeColors,
  directChild,
  firstDescendant,
  directChildren,
  attr,
  localName,
  textOf,
  readAttrNumber,
  DEFAULT_FONT_SIZE,
  resolveColor,
  DEFAULT_TEXT_COLOR,
  EMU_PER_PX,
} from './pptx-xml.utils';

export function readText(
  body: XmlElement,
  theme: ThemeColors,
  fallbackBody: XmlElement | null,
  defaultColor: string,
) {
  const bodyPr =
    directChild(body, 'bodyPr') ??
    (fallbackBody ? directChild(fallbackBody, 'bodyPr') : null);
  const defaultRun = firstDescendant(directChild(body, 'lstStyle'), 'defRPr');
  const fallbackRun = firstDescendant(fallbackBody, 'defRPr');
  const paragraphs: PptxParagraph[] = [];
  for (const paragraph of directChildren(body, 'p')) {
    const pPr = directChild(paragraph, 'pPr');
    const level = Number(attr(pPr, 'lvl') ?? 0);
    const stylePPr = paragraphProperties(body, fallbackBody, level);
    const paragraphRun =
      directChild(pPr, 'defRPr') ??
      directChild(stylePPr, 'defRPr') ??
      defaultRun ??
      fallbackRun;
    const runs: PptxRun[] = [];
    for (const child of directChildren(paragraph)) {
      if (localName(child) === 'br') {
        runs.push(
          readRun(
            '\n',
            directChild(child, 'rPr'),
            paragraphRun,
            theme,
            defaultColor,
          ),
        );
        continue;
      }
      if (localName(child) === 'tab') {
        runs.push(
          readRun(
            '\t',
            directChild(child, 'rPr'),
            paragraphRun,
            theme,
            defaultColor,
          ),
        );
        continue;
      }
      if (!['r', 'fld'].includes(localName(child))) continue;
      const text = textOf(directChild(child, 't'));
      if (!text) continue;
      runs.push(
        readRun(
          text,
          directChild(child, 'rPr'),
          paragraphRun,
          theme,
          defaultColor,
        ),
      );
    }
    const lineSpacing =
      directChild(pPr, 'lnSpc') ?? directChild(stylePPr, 'lnSpc');
    const spacingBefore =
      directChild(pPr, 'spcBef') ?? directChild(stylePPr, 'spcBef');
    const spacingAfter =
      directChild(pPr, 'spcAft') ?? directChild(stylePPr, 'spcAft');
    const percentage = readAttrNumber(
      directChild(lineSpacing, 'spcPct'),
      'val',
      0,
    );
    const spacingPoints =
      readAttrNumber(directChild(lineSpacing, 'spcPts'), 'val', 0) / 100;
    const hasExplicitNoBullet = !!directChild(pPr, 'buNone');
    const bulletNode =
      directChild(pPr, 'buChar') ?? directChild(stylePPr, 'buChar');
    const bullet = hasExplicitNoBullet
      ? undefined
      : (attr(bulletNode, 'char') ??
        (directChild(pPr, 'buAutoNum') || directChild(stylePPr, 'buAutoNum')
          ? '•'
          : undefined));
    paragraphs.push({
      text: runs.map((run) => run.text).join(''),
      runs,
      align: paragraphAlign(attr(pPr, 'algn') ?? attr(stylePPr, 'algn')),
      level,
      lineHeight: percentage > 0 ? percentage / 100000 : undefined,
      lineSpacingPt: spacingPoints > 0 ? spacingPoints : undefined,
      spaceBeforePt:
        readAttrNumber(directChild(spacingBefore, 'spcPts'), 'val', 0) / 100,
      spaceAfterPt:
        readAttrNumber(directChild(spacingAfter, 'spcPts'), 'val', 0) / 100,
      marginLeftPt:
        readAttrNumber(pPr, 'marL', readAttrNumber(stylePPr, 'marL', 0)) /
        12700,
      indentPt:
        readAttrNumber(pPr, 'indent', readAttrNumber(stylePPr, 'indent', 0)) /
        12700,
      bullet,
    });
  }
  const firstRun = paragraphs.flatMap((paragraph) => paragraph.runs)[0];
  const anchor = attr(bodyPr, 'anchor');
  const normAutofit = directChild(bodyPr, 'normAutofit');
  const autoFit = normAutofit
    ? 'shrink'
    : directChild(bodyPr, 'spAutoFit')
      ? 'resize'
      : 'none';
  const fontScale = Math.min(
    1,
    Math.max(0.1, readAttrNumber(normAutofit, 'fontScale', 100000) / 100000),
  );
  return {
    text: paragraphs.map((paragraph) => paragraph.text).join('\n'),
    paragraphs,
    textColor: firstRun?.color ?? defaultColor,
    fontSizePt: firstRun?.fontSizePt ?? DEFAULT_FONT_SIZE,
    fontScale,
    fontFamily: firstRun?.fontFamily ?? null,
    bold: firstRun?.bold ?? false,
    italic: firstRun?.italic ?? false,
    underline: firstRun?.underline ?? false,
    strike: firstRun?.strike ?? false,
    superscript: firstRun?.superscript ?? false,
    subscript: firstRun?.subscript ?? false,
    textAlign: paragraphs[0]?.align ?? 'left',
    verticalAlign:
      anchor === 'ctr' ? 'middle' : anchor === 'b' ? 'bottom' : 'top',
    wrap: attr(bodyPr, 'wrap') !== 'none',
    autoFit,
    margin: {
      left: readAttrNumber(bodyPr, 'lIns', 91440),
      right: readAttrNumber(bodyPr, 'rIns', 91440),
      top: readAttrNumber(bodyPr, 'tIns', 45720),
      bottom: readAttrNumber(bodyPr, 'bIns', 45720),
    },
    sourceText: paragraphs.map((paragraph) => paragraph.text).join('\n'),
  };
}

function paragraphProperties(
  body: XmlElement,
  fallbackBody: XmlElement | null,
  level: number,
) {
  const levelName = `lvl${Math.min(9, Math.max(1, level + 1))}pPr`;
  const find = (source: XmlElement | null) =>
    directChild(directChild(source, 'lstStyle'), levelName);
  return find(body) ?? find(fallbackBody);
}

function readRun(
  text: string,
  props: XmlElement | null,
  fallback: XmlElement | null,
  theme: ThemeColors,
  defaultColor: string,
): PptxRun {
  const latin =
    directChild(props, 'latin') ??
    directChild(props, 'ea') ??
    directChild(props, 'cs') ??
    directChild(fallback, 'latin') ??
    directChild(fallback, 'ea') ??
    directChild(fallback, 'cs');
  return {
    text,
    fontSizePt:
      readAttrNumber(
        props,
        'sz',
        readAttrNumber(fallback, 'sz', DEFAULT_FONT_SIZE * 100),
      ) / 100,
    fontFamily: attr(latin, 'typeface') || null,
    color:
      resolveColor(directChild(props, 'solidFill'), theme) ??
      resolveColor(directChild(fallback, 'solidFill'), theme) ??
      defaultColor,
    bold: booleanAttribute(props, fallback, 'b'),
    italic: booleanAttribute(props, fallback, 'i'),
    underline: (attr(props, 'u') ?? attr(fallback, 'u') ?? 'none') !== 'none',
    strike: booleanAttribute(props, fallback, 'strike'),
    superscript:
      Number(attr(props, 'baseline') ?? attr(fallback, 'baseline') ?? 0) > 0,
    subscript:
      Number(attr(props, 'baseline') ?? attr(fallback, 'baseline') ?? 0) < 0,
  };
}

function booleanAttribute(
  node: XmlElement | null,
  fallback: XmlElement | null,
  name: string,
) {
  const value = attr(node, name) ?? attr(fallback, name);
  return value === '1' || value === 'true';
}

export function parseTable(
  graphicData: XmlElement | null,
  theme: ThemeColors,
): PptxShape['table'] {
  const table = directChild(graphicData, 'tbl');
  if (!table) return null;
  const columns = directChildren(directChild(table, 'tblGrid'), 'gridCol').map(
    (column) => readAttrNumber(column, 'w', 0),
  );
  const rowNodes = directChildren(table, 'tr');
  const rows: PptxTableCell[][] = [];
  for (const row of rowNodes)
    rows.push(
      directChildren(row, 'tc').map((cell) => {
        const body = directChild(cell, 'txBody');
        const text = body
          ? readText(body, theme, null, DEFAULT_TEXT_COLOR)
          : null;
        const cellProperties = directChild(cell, 'tcPr');
        const cellAnchor = attr(cellProperties, 'anchor');
        const borderFor = (side: 'T' | 'R' | 'B' | 'L') =>
          directChild(cellProperties, `ln${side}`);
        const border = borderFor('T') ?? borderFor('B');
        const borderColor = (side: 'T' | 'R' | 'B' | 'L') =>
          resolveColor(directChild(borderFor(side), 'solidFill'), theme);
        const borderWidth = (side: 'T' | 'R' | 'B' | 'L') =>
          readAttrNumber(borderFor(side), 'w', 0) / EMU_PER_PX;
        return {
          text: text?.text ?? '',
          colSpan: Number(attr(cell, 'gridSpan') ?? 1),
          rowSpan: Number(attr(cell, 'rowSpan') ?? 1),
          merged: attr(cell, 'hMerge') === '1' || attr(cell, 'vMerge') === '1',
          fill: resolveColor(directChild(cellProperties, 'solidFill'), theme),
          textColor: text?.textColor ?? DEFAULT_TEXT_COLOR,
          fontSizePt: text?.fontSizePt ?? DEFAULT_FONT_SIZE,
          fontFamily: text?.fontFamily ?? null,
          bold: text?.bold ?? false,
          italic: text?.italic ?? false,
          textAlign: text?.textAlign ?? 'left',
          verticalAlign: (cellAnchor === 'ctr'
            ? 'middle'
            : cellAnchor === 'b'
              ? 'bottom'
              : cellAnchor === 't'
                ? 'top'
                : (text?.verticalAlign ?? 'middle')) as
            | 'top'
            | 'middle'
            | 'bottom',
          borderColor: resolveColor(directChild(border, 'solidFill'), theme),
          borderWidth: readAttrNumber(border, 'w', 0) / EMU_PER_PX,
          borderTopColor: borderColor('T'),
          borderTopWidth: borderWidth('T'),
          borderRightColor: borderColor('R'),
          borderRightWidth: borderWidth('R'),
          borderBottomColor: borderColor('B'),
          borderBottomWidth: borderWidth('B'),
          borderLeftColor: borderColor('L'),
          borderLeftWidth: borderWidth('L'),
          margin: {
            left: readAttrNumber(cellProperties, 'marL', 91440),
            right: readAttrNumber(cellProperties, 'marR', 91440),
            top: readAttrNumber(cellProperties, 'marT', 45720),
            bottom: readAttrNumber(cellProperties, 'marB', 45720),
          },
        };
      }),
    );
  // A number of producers omit tcPr borders and rely on the table style's grid
  // defaults. Keep a visible grid in that case so the table does not disappear
  // while preserving explicit noFill/no-border cells.
  const hasBorderDefinition = rowNodes.some((row) =>
    directChildren(row, 'tc').some((cell) => {
      const properties = directChild(cell, 'tcPr');
      return (['T', 'R', 'B', 'L'] as const).some(
        (side) => !!directChild(properties, `ln${side}`),
      );
    }),
  );
  const hasExplicitBorder = rows.some((row) =>
    row.some((cell) =>
      [
        cell.borderTopWidth,
        cell.borderRightWidth,
        cell.borderBottomWidth,
        cell.borderLeftWidth,
      ].some((width) => (width ?? 0) > 0),
    ),
  );
  if (!hasBorderDefinition && !hasExplicitBorder) {
    const gridColor = theme.dk2 ?? theme.tx1 ?? DEFAULT_TEXT_COLOR;
    for (const row of rows)
      for (const cell of row) {
        cell.borderColor ??= gridColor;
        cell.borderWidth ??= 1;
        cell.borderTopColor ??= gridColor;
        cell.borderRightColor ??= gridColor;
        cell.borderBottomColor ??= gridColor;
        cell.borderLeftColor ??= gridColor;
        cell.borderTopWidth ??= 1;
        cell.borderRightWidth ??= 1;
        cell.borderBottomWidth ??= 1;
        cell.borderLeftWidth ??= 1;
      }
  }
  return {
    columns,
    rows,
    rowHeights: rowNodes.map((row) => readAttrNumber(row, 'h', 0)),
    rtl:
      attr(directChild(table, 'tblPr'), 'rtl') === '1' ||
      attr(directChild(table, 'tblPr'), 'rtl') === 'true',
  };
}

function paragraphAlign(value: string | null): PptxParagraph['align'] {
  return value === 'ctr'
    ? 'center'
    : value === 'r'
      ? 'right'
      : value === 'just'
        ? 'justify'
        : 'left';
}
