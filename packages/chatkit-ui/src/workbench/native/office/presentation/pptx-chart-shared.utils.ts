// Adapted from Xpert ClawXpert shared file editors; preserve original Office package data.
export type XmlElement = Element;

export type ThemeColors = Record<string, string>;

export type ChartSeries = {
  name: string;
  categories: string[];
  values: number[];
  xValues: number[];
  color: string | null;
  pointColors: Map<number, string>;
  valueFormat: string | null;
  labelFormat: string | null;
  marker: string | null;
  markerSize: number | null;
  lineWidth: number | null;
  dash: string | null;
};

export const SVG_WIDTH = 1000;

export const SVG_HEIGHT = 600;

const DEFAULT_SERIES_COLORS = [
  [68, 114, 196],
  [237, 125, 49],
  [165, 165, 165],
  [255, 192, 0],
  [91, 155, 213],
  [112, 173, 71],
] as const;

export function chartAxisRange(
  axis: XmlElement | null,
  values: number[],
  zeroBaseline: boolean,
) {
  const scaling = directChild(axis, 'scaling');
  const authoredMinimum = optionalNumber(directChild(scaling, 'min'));
  const authoredMaximum = optionalNumber(directChild(scaling, 'max'));
  const dataMin = Math.min(...values);
  const dataMax = Math.max(...values);
  const span = Math.max(
    Math.abs(dataMax - dataMin),
    Math.abs(dataMax) * 0.1,
    1,
  );
  const minimum =
    authoredMinimum ??
    (zeroBaseline && dataMin >= 0 ? 0 : dataMin - span * 0.05);
  const rawMaximum = authoredMaximum ?? dataMax + span * 0.05;
  const majorUnit = numberValue(directChild(axis, 'majorUnit'), 0);
  const step =
    majorUnit > 0
      ? majorUnit
      : niceStep(Math.max(rawMaximum - minimum, Number.EPSILON));
  const maximum = authoredMaximum ?? Math.ceil(rawMaximum / step) * step;
  return {
    minimum,
    maximum,
    range: Math.max(Math.abs(maximum - minimum), Number.EPSILON),
    majorUnit,
  };
}

export function renderMarker(
  svg: string[],
  x: number,
  y: number,
  radius: number,
  color: string,
  symbol: string | null,
) {
  switch (symbol) {
    case 'square':
      svg.push(
        `<rect x="${x - radius}" y="${y - radius}" width="${radius * 2}" height="${radius * 2}" fill="${escapeAttribute(color)}"/>`,
      );
      break;
    case 'diamond':
      svg.push(
        `<polygon points="${x},${y - radius} ${x + radius},${y} ${x},${y + radius} ${x - radius},${y}" fill="${escapeAttribute(color)}"/>`,
      );
      break;
    case 'triangle':
    case 'triangleUp':
      svg.push(
        `<polygon points="${x},${y - radius} ${x + radius},${y + radius} ${x - radius},${y + radius}" fill="${escapeAttribute(color)}"/>`,
      );
      break;
    case 'x':
      svg.push(
        `<path d="M ${x - radius} ${y - radius} L ${x + radius} ${y + radius} M ${x + radius} ${y - radius} L ${x - radius} ${y + radius}" stroke="${escapeAttribute(color)}" stroke-width="${Math.max(2, radius / 2)}"/>`,
      );
      break;
    default:
      svg.push(
        `<circle cx="${x}" cy="${y}" r="${radius}" fill="${escapeAttribute(color)}"/>`,
      );
  }
}

export function svgDash(dash: string | null) {
  switch (dash) {
    case 'dash':
    case 'sysDash':
      return '12 8';
    case 'dashDot':
    case 'sysDashDot':
      return '12 6 2 6';
    case 'dot':
    case 'sysDot':
      return '2 6';
    case 'longDash':
    case 'sysLongDash':
      return '20 8';
    default:
      return '';
  }
}

export function renderBars(
  svg: string[],
  series: ChartSeries[],
  categoryCount: number,
  left: number,
  top: number,
  width: number,
  height: number,
  valueY: (value: number) => number,
  grouping: string,
  showValues: boolean,
  labelColor: string,
  labelSize: number,
  valueFormat: string | null,
) {
  const step = width / Math.max(categoryCount, 1);
  const groupWidth = step * 0.7;
  const barWidth =
    grouping === 'stacked' || grouping === 'percentStacked'
      ? groupWidth
      : groupWidth / series.length;
  const colors = series.map(
    (item, index) => item.color ?? fallbackSeriesColor(index),
  );
  for (let categoryIndex = 0; categoryIndex < categoryCount; categoryIndex++) {
    let stackedBase = 0;
    series.forEach((item, seriesIndex) => {
      const value = item.values[categoryIndex] ?? 0;
      const x =
        left +
        step * categoryIndex +
        (step - groupWidth) / 2 +
        (grouping === 'stacked' || grouping === 'percentStacked'
          ? 0
          : seriesIndex * barWidth);
      const base =
        grouping === 'stacked' || grouping === 'percentStacked'
          ? stackedBase
          : 0;
      const y = valueY(base + value);
      const bottom = valueY(base);
      const color = item.pointColors.get(categoryIndex) ?? colors[seriesIndex];
      svg.push(
        `<rect x="${x}" y="${Math.min(y, bottom)}" width="${Math.max(1, barWidth - 3)}" height="${Math.max(1, Math.abs(bottom - y))}" fill="${escapeAttribute(color)}"/>`,
      );
      if (showValues)
        svg.push(
          `<text x="${x + barWidth / 2 - 1.5}" y="${Math.max(labelSize + 2, Math.min(y, bottom) - 9)}" text-anchor="middle" fill="${escapeAttribute(labelColor)}" font-size="${labelSize}">${escapeXml(formatValue(value, valueFormat))}</text>`,
        );
      if (grouping === 'stacked' || grouping === 'percentStacked')
        stackedBase += value;
    });
  }
}

export function renderLines(
  svg: string[],
  series: ChartSeries[],
  categoryCount: number,
  left: number,
  top: number,
  width: number,
  height: number,
  valueY: (value: number) => number,
  showValues: boolean,
  labelColor: string,
  labelSize: number,
  valueFormat: string | null,
) {
  const step = width / Math.max(categoryCount, 1);
  series.forEach((item, seriesIndex) => {
    const color = item.color ?? fallbackSeriesColor(seriesIndex);
    const points = item.values
      .slice(0, categoryCount)
      .map((value, index) => `${left + step * (index + 0.5)},${valueY(value)}`)
      .join(' ');
    svg.push(
      `<polyline points="${points}" fill="none" stroke="${escapeAttribute(color)}" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>`,
    );
    item.values.slice(0, categoryCount).forEach((value, index) => {
      const x = left + step * (index + 0.5);
      const y = valueY(value);
      svg.push(
        `<circle cx="${x}" cy="${y}" r="10" fill="${escapeAttribute(color)}"/>`,
      );
      if (showValues)
        svg.push(
          `<text x="${x}" y="${Math.max(labelSize + 2, y - 14)}" text-anchor="middle" fill="${escapeAttribute(labelColor)}" font-size="${labelSize}">${escapeXml(formatValue(value, valueFormat))}</text>`,
        );
    });
  });
}

export function renderHorizontalBars(
  svg: string[],
  series: ChartSeries[],
  categoryCount: number,
  left: number,
  top: number,
  width: number,
  height: number,
  valueX: (value: number) => number,
  grouping: string,
  showValues: boolean,
  labelColor: string,
  labelSize: number,
  valueFormat: string | null,
  categoryAxisReversed: boolean,
) {
  const step = height / Math.max(categoryCount, 1);
  const groupHeight = step * 0.7;
  const barHeight =
    grouping === 'stacked' || grouping === 'percentStacked'
      ? groupHeight
      : groupHeight / series.length;
  const colors = series.map(
    (item, index) => item.color ?? fallbackSeriesColor(index),
  );
  for (let categoryIndex = 0; categoryIndex < categoryCount; categoryIndex++) {
    let stackedBase = 0;
    const rowIndex = categoryAxisReversed
      ? categoryIndex
      : categoryCount - 1 - categoryIndex;
    series.forEach((item, seriesIndex) => {
      const value = item.values[categoryIndex] ?? 0;
      const base =
        grouping === 'stacked' || grouping === 'percentStacked'
          ? stackedBase
          : 0;
      const x = valueX(base);
      const end = valueX(base + value);
      const y =
        top +
        step * rowIndex +
        (step - groupHeight) / 2 +
        (grouping === 'stacked' || grouping === 'percentStacked'
          ? 0
          : seriesIndex * barHeight);
      const color = item.pointColors.get(categoryIndex) ?? colors[seriesIndex];
      svg.push(
        `<rect x="${Math.min(x, end)}" y="${y}" width="${Math.max(1, Math.abs(end - x))}" height="${Math.max(1, barHeight - 3)}" fill="${escapeAttribute(color)}"/>`,
      );
      if (showValues)
        svg.push(
          `<text x="${Math.max(left + 4, Math.max(x, end) + 8)}" y="${y + barHeight / 2 + labelSize / 3}" text-anchor="start" fill="${escapeAttribute(labelColor)}" font-size="${labelSize}">${escapeXml(formatValue(value, valueFormat))}</text>`,
        );
      if (grouping === 'stacked' || grouping === 'percentStacked')
        stackedBase += value;
    });
  }
}

export function renderPie(
  svg: string[],
  series: ChartSeries,
  left: number,
  top: number,
  width: number,
  height: number,
  doughnut: boolean,
  showValues: boolean,
  showPercent: boolean,
  labelColor: string,
  labelSize: number,
  valueFormat: string | null,
) {
  const values = series.values.map((value) => Math.max(0, value));
  const total = values.reduce((sum, value) => sum + value, 0);
  if (!total) return;
  const cx = left + width / 2;
  const cy = top + height / 2;
  const radius = Math.max(20, Math.min(width, height) * 0.38);
  const innerRadius = doughnut ? radius * 0.52 : 0;
  let angle = -Math.PI / 2;
  values.forEach((value, index) => {
    const sweep = (value / total) * Math.PI * 2;
    const nextAngle = angle + sweep;
    const color =
      series.pointColors.get(index) ??
      series.color ??
      fallbackSeriesColor(index);
    const outerStart = polarPoint(cx, cy, radius, angle);
    const outerEnd = polarPoint(cx, cy, radius, nextAngle);
    const largeArc = sweep > Math.PI ? 1 : 0;
    const path = innerRadius
      ? (() => {
          const innerEnd = polarPoint(cx, cy, innerRadius, nextAngle);
          const innerStart = polarPoint(cx, cy, innerRadius, angle);
          return `M ${outerStart.x} ${outerStart.y} A ${radius} ${radius} 0 ${largeArc} 1 ${outerEnd.x} ${outerEnd.y} L ${innerEnd.x} ${innerEnd.y} A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${innerStart.x} ${innerStart.y} Z`;
        })()
      : `M ${cx} ${cy} L ${outerStart.x} ${outerStart.y} A ${radius} ${radius} 0 ${largeArc} 1 ${outerEnd.x} ${outerEnd.y} Z`;
    svg.push(
      `<path d="${path}" fill="${escapeAttribute(color)}" stroke="${escapeAttribute(rgbColor(255, 255, 255))}" stroke-width="2"/>`,
    );
    if (showValues || showPercent) {
      const mid = angle + sweep / 2;
      const point = polarPoint(cx, cy, radius * 0.68, mid);
      const valueText = showPercent
        ? `${((value / total) * 100).toFixed(1)}%`
        : formatValue(value, valueFormat);
      svg.push(
        `<text x="${point.x}" y="${point.y}" text-anchor="middle" fill="${escapeAttribute(labelColor)}" font-size="${labelSize}">${escapeXml(valueText)}</text>`,
      );
    }
    angle = nextAngle;
  });
}

function polarPoint(cx: number, cy: number, radius: number, angle: number) {
  return { x: cx + Math.cos(angle) * radius, y: cy + Math.sin(angle) * radius };
}

export function renderLegend(
  svg: string[],
  chart: XmlElement | null,
  series: ChartSeries[],
  color: string,
  size: number,
  y: number,
) {
  const legend = directChild(chart, 'legend');
  if (!legend || series.length < 2) return;
  const itemWidth = SVG_WIDTH / series.length;
  series.forEach((item, index) => {
    const x = 120 + index * itemWidth;
    const seriesColor = item.color ?? fallbackSeriesColor(index);
    svg.push(
      `<rect x="${x}" y="${y - size + 2}" width="${size}" height="${size}" fill="${escapeAttribute(seriesColor)}"/>`,
    );
    svg.push(
      `<text x="${x + size + 8}" y="${y + 3}" fill="${escapeAttribute(color)}" font-size="${size}">${escapeXml(item.name || `Series ${index + 1}`)}</text>`,
    );
  });
}

export function readSeries(
  series: XmlElement,
  theme: ThemeColors,
  scatter = false,
): ChartSeries | null {
  const name =
    textCache(directChild(directChild(series, 'tx'), 'strRef'))[0] ??
    textOf(directChild(directChild(series, 'tx'), 'v'));
  const categories = scatter ? [] : textCache(directChild(series, 'cat'));
  const valuesNode = directChild(series, scatter ? 'yVal' : 'val');
  const rawValues = numberCache(valuesNode);
  const rawXValues = scatter ? numberCache(directChild(series, 'xVal')) : [];
  const values =
    scatter && rawXValues.length
      ? rawValues.slice(0, Math.min(rawValues.length, rawXValues.length))
      : rawValues;
  const xValues =
    scatter && rawXValues.length ? rawXValues.slice(0, values.length) : [];
  if ((!scatter && !categories.length) || !values.length) return null;
  const pointColors = new Map<number, string>();
  directChildren(series, 'dPt').forEach((point) => {
    const index = Number(attr(directChild(point, 'idx'), 'val'));
    const color = colorFrom(
      directChild(directChild(point, 'spPr'), 'solidFill'),
      theme,
    );
    if (Number.isFinite(index) && color) pointColors.set(index, color);
  });
  const valueFormat =
    textOf(descendant(directChild(series, 'val'), 'formatCode')) || null;
  const scatterValueFormat =
    textOf(descendant(valuesNode, 'formatCode')) || null;
  const labelFormat = attr(
    directChild(directChild(series, 'dLbls'), 'numFmt'),
    'formatCode',
  );
  const marker = attr(
    directChild(directChild(series, 'marker'), 'symbol'),
    'val',
  );
  const markerSizeRaw = Number(
    attr(directChild(directChild(series, 'marker'), 'size'), 'val'),
  );
  const line = directChild(series, 'spPr')
    ? directChild(directChild(series, 'spPr'), 'ln')
    : null;
  const lineWidthRaw = Number(attr(line, 'w'));
  const lineWidth = Number.isFinite(lineWidthRaw) ? lineWidthRaw : null;
  const dash = attr(directChild(line, 'prstDash'), 'val');
  return {
    name,
    categories,
    values,
    xValues,
    color: seriesColor(series, theme),
    pointColors,
    valueFormat: scatterValueFormat || valueFormat,
    labelFormat,
    marker,
    markerSize: Number.isFinite(markerSizeRaw) ? markerSizeRaw : null,
    lineWidth: lineWidth != null ? lineWidth / 12700 : null,
    dash,
  };
}

function seriesColor(series: XmlElement, theme: ThemeColors) {
  const shapeProperties = directChild(series, 'spPr');
  return (
    colorFrom(directChild(shapeProperties, 'solidFill'), theme) ??
    colorFrom(descendant(shapeProperties, 'solidFill'), theme)
  );
}

export function readChartTitle(title: XmlElement | null) {
  if (!title) return '';
  const tx = directChild(title, 'tx');
  const rich = directChild(tx, 'rich');
  const paragraphs = directChildren(rich, 'p');
  const text = paragraphs.length
    ? paragraphs
        .map((paragraph) =>
          directChildren(paragraph, 'r')
            .map((run) => textOf(directChild(run, 't')))
            .join(''),
        )
        .join('\n')
    : textOf(directChild(tx, 'v'));
  return text.trim();
}

function textCache(node: XmlElement | null): string[] {
  // PptxGenJS also writes single-level categories as multiLvlStrCache. The
  // first level holds the leaf labels aligned with the series' value indexes.
  const cache = node
    ? (descendant(node, 'strCache') ??
      directChild(descendant(node, 'multiLvlStrCache'), 'lvl'))
    : null;
  return directChildren(cache, 'pt')
    .sort((a, b) => Number(attr(a, 'idx')) - Number(attr(b, 'idx')))
    .map((point) => textOf(directChild(point, 'v')));
}

function numberCache(node: XmlElement | null): number[] {
  const cache = node ? descendant(node, 'numCache') : null;
  return directChildren(cache, 'pt')
    .sort((a, b) => Number(attr(a, 'idx')) - Number(attr(b, 'idx')))
    .map((point) => Number(textOf(directChild(point, 'v'))))
    .filter(Number.isFinite);
}

export function tickValues(
  minimum: number,
  maximum: number,
  majorUnit: number,
) {
  const step = majorUnit > 0 ? majorUnit : niceStep(maximum - minimum);
  const values: number[] = [];
  for (
    let value = minimum;
    value <= maximum + step * 0.01 && values.length < 10;
    value += step
  )
    values.push(value);
  if (values.length < 2) values.push(maximum);
  return values;
}

export function niceStep(value: number) {
  const magnitude =
    10 ** Math.floor(Math.log10(Math.max(value, Number.EPSILON)));
  const normalized = value / magnitude;
  // PowerPoint's automatic vertical axis uses the 1/2/5 ladder against the
  // full range. For example, an 8,064 range resolves to 1,000-unit ticks and
  // an automatic maximum of 8,000.
  const base = normalized >= 5 ? 1 : normalized >= 2 ? 0.5 : 0.2;
  return base * magnitude;
}

export function formatValue(value: number, formatCode: string | null = null) {
  if (formatCode?.includes('%')) {
    const decimals = (formatCode.split('.')[1]?.split('%')[0] ?? '').replace(
      /[^0#]/g,
      '',
    ).length;
    return `${(value * 100).toFixed(decimals)}%`;
  }
  const decimals = formatCode?.includes('.')
    ? (formatCode.split('.')[1] ?? '').replace(/[^0#]/g, '').length
    : 0;
  return decimals > 0
    ? value.toFixed(decimals)
    : Number.isInteger(value)
      ? value.toLocaleString()
      : value.toFixed(1).replace(/\.0$/, '');
}

export function isGeneralFormat(formatCode: string | null) {
  return !formatCode || formatCode.trim().toLowerCase() === 'general';
}

export function fallbackSeriesColor(index: number) {
  const color = DEFAULT_SERIES_COLORS[index % DEFAULT_SERIES_COLORS.length];
  return rgbColor(color[0], color[1], color[2]);
}

export function colorFrom(
  node: XmlElement | null,
  theme: ThemeColors = {},
): string | null {
  const color = node
    ? directChildren(node).find((child) =>
        ['srgbClr', 'schemeClr', 'sysClr'].includes(localName(child)),
      )
    : null;
  if (!color) return null;
  const rawValue = attr(color, 'lastClr') ?? attr(color, 'val');
  if (!rawValue) return null;
  const value = /^[0-9a-f]{6}$/i.test(rawValue)
    ? rawValue
    : (theme[rawValue] ??
      theme[rawValue.toLowerCase()] ??
      theme[
        rawValue === 'tx1' ? 'dk1' : rawValue === 'bg1' ? 'lt1' : rawValue
      ] ??
      theme[
        rawValue === 'tx2' ? 'dk2' : rawValue === 'bg2' ? 'lt2' : rawValue
      ] ??
      null);
  if (!value) return null;
  const hex = value.replace(/^#/, '');
  return /^[0-9a-f]{6}$/i.test(hex) ? `#${hex}` : null;
}

export function rgbColor(red: number, green: number, blue: number) {
  return `#${[red, green, blue]
    .map((channel) =>
      Math.max(0, Math.min(255, channel)).toString(16).padStart(2, '0'),
    )
    .join('')}`;
}

export function roundCoordinate(value: number) {
  return Math.round(value * 1000) / 1000;
}

export function parseXml(xml: string) {
  const document = new DOMParser().parseFromString(xml, 'application/xml');
  if (document.getElementsByTagName('parsererror').length) return null;
  return document.documentElement;
}

export function directChild(node: XmlElement | null | undefined, name: string) {
  return (
    directChildren(node).find((child) => localName(child) === name) ?? null
  );
}

export function directChildren(
  node: XmlElement | null | undefined,
  name?: string,
) {
  return node
    ? Array.from(node.children).filter(
        (child) => !name || localName(child) === name,
      )
    : [];
}

export function descendant(node: XmlElement | null | undefined, name: string) {
  if (!node) return null;
  if (localName(node) === name) return node;
  return (
    Array.from(node.getElementsByTagName('*')).find(
      (child) => localName(child) === name,
    ) ?? null
  );
}

function localName(node: Element | null | undefined) {
  return node?.localName || node?.tagName?.split(':').pop() || '';
}

export function attr(node: XmlElement | null | undefined, name: string) {
  return node?.getAttribute(name) ?? null;
}

export function flag(node: XmlElement | null, name: string) {
  return (
    attr(node, name) === '1' || attr(directChild(node, name), 'val') === '1'
  );
}

export function textOf(node: XmlElement | null) {
  return node?.textContent?.trim() ?? '';
}

export function numberValue(node: XmlElement | null, fallback: number) {
  const value = Number(attr(node, 'val') ?? textOf(node));
  return Number.isFinite(value) ? value : fallback;
}

export function optionalNumber(node: XmlElement | null) {
  if (!node) return null;
  const raw = attr(node, 'val') ?? textOf(node);
  if (!raw.trim()) return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

export function textRunSize(txPr: XmlElement | null, fallbackPt: number) {
  const size = Number(attr(descendant(txPr, 'defRPr'), 'sz'));
  // SVG uses the fixed 1000-unit viewBox. These values produce PowerPoint-sized
  // labels after the chart image is scaled to its slide frame.
  return Number.isFinite(size) && size > 0
    ? Math.max(18, Math.min(48, (size / 100) * 1.65))
    : fallbackPt * 1.65;
}

export function escapeXml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function escapeAttribute(value: string) {
  return escapeXml(value);
}

export function svgDataUrl(svg: string) {
  const bytes = new TextEncoder().encode(svg);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return `data:image/svg+xml;base64,${btoa(binary)}`;
}
