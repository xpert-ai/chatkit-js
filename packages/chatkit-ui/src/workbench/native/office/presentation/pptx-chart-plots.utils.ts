// Adapted from Xpert ClawXpert shared file editors; preserve original Office package data.
import {
  type XmlElement,
  type ChartSeries,
  type ThemeColors,
  descendant,
  readChartTitle,
  directChild,
  directChildren,
  attr,
  chartAxisRange,
  colorFrom,
  textRunSize,
  rgbColor,
  flag,
  textOf,
  isGeneralFormat,
  SVG_WIDTH,
  SVG_HEIGHT,
  roundCoordinate,
  tickValues,
  escapeAttribute,
  escapeXml,
  formatValue,
  fallbackSeriesColor,
  svgDash,
  renderMarker,
  renderLegend,
  svgDataUrl,
} from './pptx-chart-shared.utils';

export function renderScatterChart(
  root: XmlElement | null,
  chartSpace: XmlElement | null,
  chart: XmlElement,
  series: ChartSeries[],
  theme: ThemeColors,
) {
  const plotArea = descendant(root, 'plotArea');
  const title = readChartTitle(directChild(chartSpace, 'title'));
  const valAxes = directChildren(plotArea, 'valAx');
  const xAxis =
    valAxes.find((axis) =>
      ['b', 't'].includes(attr(directChild(axis, 'axPos'), 'val') ?? ''),
    ) ??
    valAxes[1] ??
    null;
  const yAxis =
    valAxes.find((axis) =>
      ['l', 'r'].includes(attr(directChild(axis, 'axPos'), 'val') ?? ''),
    ) ??
    valAxes[0] ??
    null;
  const points = series.map((item) =>
    item.values
      .map((value, index) => ({
        x: item.xValues[index] ?? index + 1,
        y: value,
        index,
      }))
      .filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y)),
  );
  const allX = points.flatMap((item) => item.map((point) => point.x));
  const allY = points.flatMap((item) => item.map((point) => point.y));
  if (!allX.length || !allY.length) return null;

  const xRange = chartAxisRange(xAxis, allX, false);
  const yRange = chartAxisRange(yAxis, allY, false);
  const background =
    colorFrom(directChild(directChild(root, 'spPr'), 'solidFill'), theme) ??
    'transparent';
  const plotBackground =
    colorFrom(directChild(directChild(plotArea, 'spPr'), 'solidFill'), theme) ??
    background;
  const xLabelSize = textRunSize(directChild(xAxis, 'txPr'), 13.5);
  const yLabelSize = textRunSize(directChild(yAxis, 'txPr'), 13.5);
  const xTextColor =
    colorFrom(descendant(directChild(xAxis, 'txPr'), 'solidFill'), theme) ??
    rgbColor(104, 123, 117);
  const yTextColor =
    colorFrom(descendant(directChild(yAxis, 'txPr'), 'solidFill'), theme) ??
    xTextColor;
  const xTitle = readChartTitle(directChild(xAxis, 'title'));
  const yTitle = readChartTitle(directChild(yAxis, 'title'));
  const labels = directChild(chart, 'dLbls');
  const showValues = flag(labels, 'showVal');
  const labelColor =
    colorFrom(descendant(directChild(labels, 'txPr'), 'solidFill'), theme) ??
    yTextColor;
  const labelSize = textRunSize(directChild(labels, 'txPr'), 13.5);
  const xFormat =
    attr(directChild(xAxis, 'numFmt'), 'formatCode') ??
    textOf(directChild(xAxis, 'numFmt'));
  const yFormat =
    attr(directChild(yAxis, 'numFmt'), 'formatCode') ??
    textOf(directChild(yAxis, 'numFmt'));
  const dataFormat =
    series.find(
      (item) => item.valueFormat && !isGeneralFormat(item.valueFormat),
    )?.valueFormat ?? yFormat;
  const left = 98;
  const right = 34;
  const top = title ? 58 : 28;
  const bottom = 88 + (xTitle ? 18 : 0);
  const plotWidth = SVG_WIDTH - left - right;
  const plotHeight = SVG_HEIGHT - top - bottom;
  const xOf = (value: number) =>
    roundCoordinate(
      left + ((value - xRange.minimum) / xRange.range) * plotWidth,
    );
  const yOf = (value: number) =>
    roundCoordinate(
      top + plotHeight - ((value - yRange.minimum) / yRange.range) * plotHeight,
    );
  const xTicks = tickValues(xRange.minimum, xRange.maximum, xRange.majorUnit);
  const yTicks = tickValues(yRange.minimum, yRange.maximum, yRange.majorUnit);
  const xGridColor =
    colorFrom(
      descendant(directChild(xAxis, 'majorGridlines'), 'solidFill'),
      theme,
    ) ?? rgbColor(215, 221, 213);
  const yGridColor =
    colorFrom(
      descendant(directChild(yAxis, 'majorGridlines'), 'solidFill'),
      theme,
    ) ?? xGridColor;
  const axisColor =
    colorFrom(descendant(directChild(yAxis, 'spPr'), 'solidFill'), theme) ??
    xGridColor;
  const svg: string[] = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SVG_WIDTH} ${SVG_HEIGHT}" preserveAspectRatio="none">`,
    `<rect width="${SVG_WIDTH}" height="${SVG_HEIGHT}" fill="${escapeAttribute(background)}"/>`,
    `<rect x="${left}" y="${top}" width="${plotWidth}" height="${plotHeight}" fill="${escapeAttribute(plotBackground)}"/>`,
  ];
  if (title)
    svg.push(
      `<text x="${SVG_WIDTH / 2}" y="30" text-anchor="middle" fill="${escapeAttribute(yTextColor)}" font-size="26" font-weight="600">${escapeXml(title)}</text>`,
    );
  for (const tick of yTicks) {
    const y = yOf(tick);
    svg.push(
      `<line x1="${left}" y1="${y}" x2="${left + plotWidth}" y2="${y}" stroke="${escapeAttribute(yGridColor)}" stroke-width="2"/>`,
    );
    svg.push(
      `<text x="${left - 10}" y="${y + 5}" text-anchor="end" fill="${escapeAttribute(yTextColor)}" font-size="${yLabelSize}">${escapeXml(formatValue(tick, yFormat))}</text>`,
    );
  }
  for (const tick of xTicks) {
    const x = xOf(tick);
    svg.push(
      `<line x1="${x}" y1="${top}" x2="${x}" y2="${top + plotHeight}" stroke="${escapeAttribute(xGridColor)}" stroke-width="2"/>`,
    );
    svg.push(
      `<text x="${x}" y="${top + plotHeight + 28}" text-anchor="middle" fill="${escapeAttribute(xTextColor)}" font-size="${xLabelSize}">${escapeXml(formatValue(tick, xFormat))}</text>`,
    );
  }
  svg.push(
    `<line x1="${left}" y1="${top + plotHeight}" x2="${left + plotWidth}" y2="${top + plotHeight}" stroke="${escapeAttribute(axisColor)}" stroke-width="2"/>`,
  );
  svg.push(
    `<line x1="${left}" y1="${top}" x2="${left}" y2="${top + plotHeight}" stroke="${escapeAttribute(axisColor)}" stroke-width="2"/>`,
  );
  if (xTitle)
    svg.push(
      `<text x="${left + plotWidth / 2}" y="${SVG_HEIGHT - 18}" text-anchor="middle" fill="${escapeAttribute(xTextColor)}" font-size="${xLabelSize}">${escapeXml(xTitle)}</text>`,
    );
  if (yTitle)
    svg.push(
      `<text x="18" y="${top + plotHeight / 2}" text-anchor="middle" fill="${escapeAttribute(yTextColor)}" font-size="${yLabelSize}" transform="rotate(-90 18 ${top + plotHeight / 2})">${escapeXml(yTitle)}</text>`,
    );

  const scatterStyle =
    attr(directChild(chart, 'scatterStyle'), 'val') ?? 'lineMarker';
  const hasLine =
    scatterStyle.startsWith('line') || scatterStyle.startsWith('smooth');
  const defaultMarker =
    scatterStyle !== 'line' &&
    scatterStyle !== 'smooth' &&
    scatterStyle !== 'none';
  series.forEach((item, seriesIndex) => {
    const color = item.color ?? fallbackSeriesColor(seriesIndex);
    const itemPoints = points[seriesIndex] ?? [];
    const orderedPoints = hasLine
      ? [...itemPoints].sort((a, b) => a.x - b.x)
      : itemPoints;
    if (hasLine && orderedPoints.length > 1) {
      const path = orderedPoints
        .map((point) => `${xOf(point.x)},${yOf(point.y)}`)
        .join(' ');
      const width = Math.max(2, (item.lineWidth ?? 1.5) * 2);
      const dash = svgDash(item.dash);
      svg.push(
        `<polyline points="${path}" fill="none" stroke="${escapeAttribute(color)}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"${dash ? ` stroke-dasharray="${dash}"` : ''}/>`,
      );
    }
    const showMarker = item.marker ? item.marker !== 'none' : defaultMarker;
    orderedPoints.forEach((point) => {
      const x = xOf(point.x);
      const y = yOf(point.y);
      if (showMarker)
        renderMarker(
          svg,
          x,
          y,
          Math.max(4, Math.min(12, (item.markerSize ?? 8) * 0.6)),
          color,
          item.marker,
        );
      if (showValues)
        svg.push(
          `<text x="${x}" y="${Math.max(labelSize + 2, y - 12)}" text-anchor="middle" fill="${escapeAttribute(labelColor)}" font-size="${labelSize}">${escapeXml(formatValue(point.y, dataFormat))}</text>`,
        );
    });
  });
  renderLegend(
    svg,
    chartSpace,
    series,
    xTextColor,
    xLabelSize,
    top + plotHeight + 54,
  );
  svg.push('</svg>');
  return svgDataUrl(svg.join(''));
}

export function renderRadarChart(
  root: XmlElement | null,
  chartSpace: XmlElement | null,
  chart: XmlElement,
  series: ChartSeries[],
  theme: ThemeColors,
) {
  const plotArea = descendant(root, 'plotArea');
  const categories =
    series.find((item) => item.categories.length)?.categories ?? [];
  const n = categories.length;
  if (n < 3) return null;
  const values = series.flatMap((item) => item.values).filter(Number.isFinite);
  if (!values.length) return null;
  const axis = directChild(plotArea, 'valAx');
  const range = chartAxisRange(axis, values, true);
  const title = readChartTitle(directChild(chartSpace, 'title'));
  const background =
    colorFrom(directChild(directChild(root, 'spPr'), 'solidFill'), theme) ??
    'transparent';
  const plotBackground =
    colorFrom(directChild(directChild(plotArea, 'spPr'), 'solidFill'), theme) ??
    background;
  const labelSize = textRunSize(directChild(axis, 'txPr'), 13.5);
  const labelColor =
    colorFrom(descendant(directChild(axis, 'txPr'), 'solidFill'), theme) ??
    rgbColor(104, 123, 117);
  const catAxis = directChild(plotArea, 'catAx');
  const categoryColor =
    colorFrom(descendant(directChild(catAxis, 'txPr'), 'solidFill'), theme) ??
    labelColor;
  const gridColor =
    colorFrom(
      descendant(directChild(axis, 'majorGridlines'), 'solidFill'),
      theme,
    ) ?? rgbColor(215, 221, 213);
  const left = 112;
  const right = 112;
  const top = title ? 58 : 28;
  const bottom = 82;
  const cx = left + (SVG_WIDTH - left - right) / 2;
  const cy = top + (SVG_HEIGHT - top - bottom) / 2;
  const radius = Math.max(
    24,
    Math.min((SVG_WIDTH - left - right) / 2, (SVG_HEIGHT - top - bottom) / 2),
  );
  const angleOf = (index: number) => -Math.PI / 2 + (index / n) * Math.PI * 2;
  const radiusOf = (value: number) =>
    radius * Math.max(0, Math.min(1, (value - range.minimum) / range.range));
  const pointAt = (index: number, value: number) => {
    const angle = angleOf(index);
    const distance = radiusOf(value);
    return {
      x: roundCoordinate(cx + Math.cos(angle) * distance),
      y: roundCoordinate(cy + Math.sin(angle) * distance),
    };
  };
  const svg: string[] = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SVG_WIDTH} ${SVG_HEIGHT}" preserveAspectRatio="none">`,
    `<rect width="${SVG_WIDTH}" height="${SVG_HEIGHT}" fill="${escapeAttribute(background)}"/>`,
    `<rect x="${left}" y="${top}" width="${SVG_WIDTH - left - right}" height="${SVG_HEIGHT - top - bottom}" fill="${escapeAttribute(plotBackground)}"/>`,
  ];
  if (title)
    svg.push(
      `<text x="${SVG_WIDTH / 2}" y="30" text-anchor="middle" fill="${escapeAttribute(labelColor)}" font-size="26" font-weight="600">${escapeXml(title)}</text>`,
    );
  for (const tick of tickValues(
    range.minimum,
    range.maximum,
    range.majorUnit,
  )) {
    if (tick === range.minimum) continue;
    const points = categories
      .map((_, index) => {
        const point = pointAt(index, tick);
        return `${point.x},${point.y}`;
      })
      .join(' ');
    svg.push(
      `<polygon points="${points}" fill="none" stroke="${escapeAttribute(gridColor)}" stroke-width="2"/>`,
    );
    const topPoint = pointAt(0, tick);
    svg.push(
      `<text x="${topPoint.x - 8}" y="${topPoint.y + 5}" text-anchor="end" fill="${escapeAttribute(labelColor)}" font-size="${labelSize}">${escapeXml(formatValue(tick, attr(directChild(axis, 'numFmt'), 'formatCode')))}</text>`,
    );
  }
  categories.forEach((category, index) => {
    const outer = pointAt(index, range.maximum);
    svg.push(
      `<line x1="${cx}" y1="${cy}" x2="${outer.x}" y2="${outer.y}" stroke="${escapeAttribute(gridColor)}" stroke-width="2"/>`,
    );
    const angle = angleOf(index);
    const x = cx + Math.cos(angle) * (radius + labelSize * 0.8);
    const y = cy + Math.sin(angle) * (radius + labelSize * 0.8);
    const anchor =
      Math.cos(angle) > 0.25
        ? 'start'
        : Math.cos(angle) < -0.25
          ? 'end'
          : 'middle';
    const baseline =
      Math.sin(angle) > 0.35
        ? labelSize * 0.35
        : Math.sin(angle) < -0.35
          ? 0
          : labelSize * 0.12;
    svg.push(
      `<text x="${x}" y="${y + baseline}" text-anchor="${anchor}" fill="${escapeAttribute(categoryColor)}" font-size="${labelSize}">${escapeXml(category)}</text>`,
    );
  });
  const radarStyle =
    attr(directChild(chart, 'radarStyle'), 'val') ?? 'standard';
  series.forEach((item, seriesIndex) => {
    const color = item.color ?? fallbackSeriesColor(seriesIndex);
    const points = categories
      .map((_, index) => {
        const value = item.values[index] ?? range.minimum;
        const point = pointAt(index, value);
        return `${point.x},${point.y}`;
      })
      .join(' ');
    const width = Math.max(2, (item.lineWidth ?? 1.5) * 2);
    const dash = svgDash(item.dash);
    svg.push(
      `<polygon points="${points}" fill="${escapeAttribute(color)}" fill-opacity="${radarStyle === 'filled' ? '0.28' : '0'}" stroke="${escapeAttribute(color)}" stroke-width="${width}" stroke-linejoin="round"${dash ? ` stroke-dasharray="${dash}"` : ''}/>`,
    );
    const showMarker = item.marker
      ? item.marker !== 'none'
      : radarStyle === 'marker';
    if (showMarker)
      categories.forEach((_, index) => {
        const point = pointAt(index, item.values[index] ?? range.minimum);
        renderMarker(
          svg,
          point.x,
          point.y,
          Math.max(4, Math.min(10, (item.markerSize ?? 7) * 0.6)),
          color,
          item.marker,
        );
      });
  });
  renderLegend(
    svg,
    chartSpace,
    series,
    categoryColor,
    labelSize,
    SVG_HEIGHT - 24,
  );
  svg.push('</svg>');
  return svgDataUrl(svg.join(''));
}
