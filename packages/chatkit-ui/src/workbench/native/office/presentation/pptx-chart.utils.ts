// Adapted from Xpert ClawXpert shared file editors; preserve original Office package data.
import {
  type ThemeColors,
  parseXml,
  descendant,
  directChild,
  readChartTitle,
  directChildren,
  readSeries,
  type ChartSeries,
  attr,
  colorFrom,
  optionalNumber,
  numberValue,
  niceStep,
  textOf,
  tickValues,
  SVG_WIDTH,
  SVG_HEIGHT,
  roundCoordinate,
  rgbColor,
  flag,
  textRunSize,
  isGeneralFormat,
  escapeAttribute,
  escapeXml,
  formatValue,
  renderPie,
  renderHorizontalBars,
  renderLines,
  renderBars,
  renderLegend,
  svgDataUrl,
} from './pptx-chart-shared.utils';
import { renderScatterChart, renderRadarChart } from './pptx-chart-plots.utils';

/**
 * Builds a lightweight SVG preview for classic OOXML charts. The original chart
 * part remains in the package, so this preview is only a view representation.
 */
export async function renderPptxChart(
  zip: { file(path: string): { async(type: 'text'): Promise<string> } | null },
  path: string,
  theme: ThemeColors = {},
) {
  const file = zip.file(path);
  if (!file) return null;
  const xml = await file.async('text');
  const root = parseXml(xml);
  const plotArea = descendant(root, 'plotArea');
  if (!plotArea) return null;

  const chartType = [
    'barChart',
    'lineChart',
    'areaChart',
    'pieChart',
    'doughnutChart',
    'scatterChart',
    'radarChart',
  ].find((type) => directChild(plotArea, type));
  if (!chartType) return null;
  const chart = directChild(plotArea, chartType);
  if (!chart) return null;
  const chartSpace = directChild(root, 'chart');
  const title = readChartTitle(directChild(chartSpace, 'title'));
  const scatter = chartType === 'scatterChart';
  const series = directChildren(chart, 'ser')
    .map((item) => readSeries(item, theme, scatter))
    .filter((item): item is ChartSeries => !!item);
  if (!series.length) return null;

  if (scatter)
    return renderScatterChart(root, chartSpace, chart, series, theme);
  if (chartType === 'radarChart')
    return renderRadarChart(root, chartSpace, chart, series, theme);

  const categories =
    series.find((item) => item.categories.length)?.categories ?? [];
  const values = series.flatMap((item) => item.values).filter(Number.isFinite);
  if (!categories.length || !values.length) return null;
  const firstSeries = series[0];
  if (!firstSeries) return null;

  const isLine = chartType === 'lineChart' || chartType === 'areaChart';
  const isPie = chartType === 'pieChart' || chartType === 'doughnutChart';
  const horizontalBars =
    chartType === 'barChart' &&
    attr(directChild(chart, 'barDir'), 'val') === 'bar';
  const grouping = attr(chart, 'grouping') ?? 'clustered';
  const background =
    colorFrom(directChild(directChild(root, 'spPr'), 'solidFill'), theme) ??
    'transparent';
  const plotBackground =
    colorFrom(directChild(directChild(plotArea, 'spPr'), 'solidFill'), theme) ??
    background;
  const axis = directChild(plotArea, 'valAx');
  const scaling = directChild(axis, 'scaling');
  const dataMin = Math.min(...values);
  const dataMax = Math.max(...values);
  const authoredMinimum = optionalNumber(directChild(scaling, 'min'));
  const minimum = authoredMinimum ?? (dataMin >= 0 ? 0 : dataMin * 1.12);
  const majorUnit = numberValue(directChild(axis, 'majorUnit'), 0);
  // Do not add one unit to an explicitly authored range. Percentage charts commonly
  // use a range such as 0.88–0.96, where that old fallback flattened the whole line.
  const authoredMaximum = optionalNumber(directChild(scaling, 'max'));
  const rawMaximum =
    authoredMaximum ??
    (dataMax === minimum
      ? minimum + Math.max(Math.abs(minimum) * 0.1, 1)
      : dataMax + Math.abs(dataMax - minimum) * 0.05);
  const automaticStep =
    majorUnit > 0 ? majorUnit : niceStep(rawMaximum - minimum);
  const maximum =
    authoredMaximum ?? Math.ceil(rawMaximum / automaticStep) * automaticStep;
  const range = Math.max(Math.abs(maximum - minimum), Number.EPSILON);
  const axisFormat =
    attr(directChild(axis, 'numFmt'), 'formatCode') ??
    textOf(directChild(axis, 'numFmt'));
  const ticks = tickValues(minimum, maximum, majorUnit);
  const left = horizontalBars ? 154 : 72;
  const right = 24;
  const top = title ? 58 : 24;
  const bottom = horizontalBars ? 62 : 74;
  const plotWidth = SVG_WIDTH - left - right;
  const plotHeight = SVG_HEIGHT - top - bottom;
  const valueY = (value: number) =>
    roundCoordinate(
      top + plotHeight - ((value - minimum) / range) * plotHeight,
    );
  const valueX = (value: number) =>
    roundCoordinate(left + ((value - minimum) / range) * plotWidth);
  const axisStyle = directChild(axis, 'spPr');
  const gridlines = directChild(axis, 'majorGridlines');
  const gridColor =
    colorFrom(descendant(gridlines, 'solidFill'), theme) ??
    colorFrom(descendant(axisStyle, 'solidFill'), theme) ??
    rgbColor(215, 221, 213);
  const textColor =
    colorFrom(descendant(directChild(axis, 'txPr'), 'solidFill'), theme) ??
    rgbColor(104, 123, 117);
  const labels = directChild(chart, 'dLbls');
  const showValues = flag(labels, 'showVal');
  const labelColor =
    colorFrom(descendant(directChild(labels, 'txPr'), 'solidFill'), theme) ??
    rgbColor(18, 61, 55);
  const labelSize = textRunSize(directChild(labels, 'txPr'), 16);
  const categoryAxis = directChild(plotArea, 'catAx');
  const categoryAxisReversed =
    attr(
      directChild(directChild(categoryAxis, 'scaling'), 'orientation'),
      'val',
    ) === 'maxMin';
  const categoryTextColor =
    colorFrom(
      descendant(directChild(categoryAxis, 'txPr'), 'solidFill'),
      theme,
    ) ?? textColor;
  const categorySize = textRunSize(directChild(categoryAxis, 'txPr'), 13.5);
  // PowerPoint resolves a data label's format from the series cache first, then
  // from the value axis.  A `General` label format means "use the source
  // value format" and must not hide a cache format such as `#,##0` or `0.0%`.
  const dataFormat =
    series.find(
      (item) => item.labelFormat && !isGeneralFormat(item.labelFormat),
    )?.labelFormat ??
    series.find(
      (item) => item.valueFormat && !isGeneralFormat(item.valueFormat),
    )?.valueFormat ??
    (axisFormat && !isGeneralFormat(axisFormat) ? axisFormat : null);
  const tickFormat =
    axisFormat?.includes('%') &&
    !axisFormat.includes('.') &&
    dataFormat?.includes('.')
      ? dataFormat
      : axisFormat;
  const svg: string[] = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SVG_WIDTH} ${SVG_HEIGHT}" preserveAspectRatio="none">`,
    `<rect width="${SVG_WIDTH}" height="${SVG_HEIGHT}" fill="${escapeAttribute(background)}"/>`,
    `<rect x="${left}" y="${top}" width="${plotWidth}" height="${plotHeight}" fill="${escapeAttribute(plotBackground)}"/>`,
  ];
  if (title) {
    svg.push(
      `<text x="${SVG_WIDTH / 2}" y="30" text-anchor="middle" fill="${escapeAttribute(textColor)}" font-size="26" font-weight="600">${escapeXml(title)}</text>`,
    );
  }

  for (const tick of isPie ? [] : ticks) {
    if (horizontalBars) {
      const x = valueX(tick);
      svg.push(
        `<line x1="${x}" y1="${top}" x2="${x}" y2="${top + plotHeight}" stroke="${escapeAttribute(gridColor)}" stroke-width="2"/>`,
      );
      svg.push(
        `<text x="${x}" y="${top + plotHeight + 28}" text-anchor="middle" fill="${escapeAttribute(textColor)}" font-size="${categorySize}">${escapeXml(formatValue(tick, tickFormat))}</text>`,
      );
    } else {
      const y = valueY(tick);
      svg.push(
        `<line x1="${left}" y1="${y}" x2="${left + plotWidth}" y2="${y}" stroke="${escapeAttribute(gridColor)}" stroke-width="2"/>`,
      );
      svg.push(
        `<text x="${left - 10}" y="${y + 5}" text-anchor="end" fill="${escapeAttribute(textColor)}" font-size="${categorySize}">${escapeXml(formatValue(tick, tickFormat))}</text>`,
      );
    }
  }

  if (isPie) {
    renderPie(
      svg,
      firstSeries,
      left,
      top,
      plotWidth,
      plotHeight,
      chartType === 'doughnutChart',
      showValues,
      flag(labels, 'showPercent'),
      labelColor,
      labelSize,
      dataFormat,
    );
  } else if (horizontalBars) {
    renderHorizontalBars(
      svg,
      series,
      categories.length,
      left,
      top,
      plotWidth,
      plotHeight,
      valueX,
      grouping,
      showValues,
      labelColor,
      labelSize,
      dataFormat,
      categoryAxisReversed,
    );
  } else if (isLine) {
    renderLines(
      svg,
      series,
      categories.length,
      left,
      top,
      plotWidth,
      plotHeight,
      valueY,
      showValues,
      labelColor,
      labelSize,
      dataFormat,
    );
  } else {
    renderBars(
      svg,
      series,
      categories.length,
      left,
      top,
      plotWidth,
      plotHeight,
      valueY,
      grouping,
      showValues,
      labelColor,
      labelSize,
      dataFormat,
    );
  }

  const categoryStep = plotHeight / Math.max(categories.length, 1);
  categories.forEach((category, index) => {
    if (isPie) return;
    if (horizontalBars) {
      const rowIndex = categoryAxisReversed
        ? index
        : categories.length - 1 - index;
      const y = top + categoryStep * (rowIndex + 0.5);
      svg.push(
        `<text x="${left - 12}" y="${y + 5}" text-anchor="end" fill="${escapeAttribute(categoryTextColor)}" font-size="${categorySize}">${escapeXml(category)}</text>`,
      );
    } else {
      const x =
        left + (plotWidth / Math.max(categories.length, 1)) * (index + 0.5);
      svg.push(
        `<text x="${x}" y="${top + plotHeight + 30}" text-anchor="middle" fill="${escapeAttribute(categoryTextColor)}" font-size="${categorySize}">${escapeXml(category)}</text>`,
      );
    }
  });
  if (!isPie) {
    svg.push(
      `<line x1="${left}" y1="${top + plotHeight}" x2="${left + plotWidth}" y2="${top + plotHeight}" stroke="${escapeAttribute(gridColor)}" stroke-width="2"/>`,
    );
  }
  renderLegend(
    svg,
    chartSpace,
    series,
    categoryTextColor,
    categorySize,
    top + plotHeight + (horizontalBars ? 48 : 54),
  );
  svg.push('</svg>');
  return svgDataUrl(svg.join(''));
}
