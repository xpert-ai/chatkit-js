import * as React from 'react';
import type { PptxDeck, PptxShape } from './pptx-file.utils';
import {
  pptxParagraphOffset,
  pptxLineDashArray,
  pptxLineMarkerPath,
  pptxTextPadding,
  pptxRunFontSize,
  pptxRunTextDecoration,
  pptxParagraphLineHeight,
  pptxImageStyle,
  pptxConnectorPath,
} from './pptx-editor-view.utils';

export function PptxShapeContent({
  shape,
  deck,
}: {
  shape: PptxShape;
  deck: PptxDeck;
}) {
  const markerId = React.useId().replace(/:/g, '');
  if (shape.kind === 'image' && shape.imageSrc)
    return (
      <img
        src={shape.imageSrc}
        alt={shape.name}
        draggable={false}
        className="absolute max-w-none"
        style={pptxImageStyle(shape)}
      />
    );
  if (shape.kind === 'line')
    return (
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        className="h-full w-full overflow-visible"
      >
        <defs>
          {(['start', 'end'] as const).map((side) => (
            <marker
              key={side}
              id={`${markerId}-${side}`}
              markerWidth="6"
              markerHeight="6"
              refX={side === 'start' ? 0 : 6}
              refY="3"
              orient="auto-start-reverse"
              markerUnits="strokeWidth"
            >
              <path
                d={pptxLineMarkerPath(shape, side)}
                fill={shape.stroke ?? 'currentColor'}
              />
            </marker>
          ))}
        </defs>
        <path
          markerStart={
            shape.lineHeadEnd && shape.lineHeadEnd !== 'none'
              ? `url(#${markerId}-start)`
              : undefined
          }
          markerEnd={
            shape.lineTailEnd && shape.lineTailEnd !== 'none'
              ? `url(#${markerId}-end)`
              : undefined
          }
          strokeDasharray={pptxLineDashArray(shape) ?? undefined}
          d={pptxConnectorPath(shape)}
          fill="none"
          stroke={shape.stroke ?? 'currentColor'}
          strokeWidth={Math.max(1, shape.strokeWidth)}
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    );
  if (shape.kind === 'table' && shape.table)
    return (
      <table className="h-full w-full table-fixed border-collapse">
        <tbody>
          {shape.table.rows.map((row, r) => (
            <tr key={r}>
              {row.map((cell, c) =>
                cell.merged ? null : (
                  <td
                    key={c}
                    rowSpan={cell.rowSpan}
                    colSpan={cell.colSpan}
                    style={{
                      background: cell.fill ?? undefined,
                      color: cell.textColor,
                      fontSize: `${((cell.fontSizePt ?? shape.fontSizePt) * 12700 * 100) / deck.width}cqw`,
                      fontFamily: cell.fontFamily ?? undefined,
                      fontWeight: cell.bold ? 'bold' : undefined,
                      textAlign: cell.textAlign,
                      border: `${cell.borderWidth ?? 1}px solid ${cell.borderColor ?? 'currentColor'}`,
                    }}
                  >
                    {cell.text}
                  </td>
                ),
              )}
            </tr>
          ))}
        </tbody>
      </table>
    );
  return (
    <div
      className="flex h-full flex-col"
      style={{
        padding: pptxTextPadding(shape, deck),
        justifyContent:
          shape.verticalAlign === 'middle'
            ? 'center'
            : shape.verticalAlign === 'bottom'
              ? 'flex-end'
              : 'flex-start',
      }}
    >
      {shape.paragraphs.length
        ? shape.paragraphs.map((paragraph, index) => (
            <p
              key={index}
              style={{
                margin: 0,
                marginTop: pptxParagraphOffset(
                  paragraph.spaceBeforePt ?? 0,
                  deck,
                ),
                marginBottom: pptxParagraphOffset(
                  paragraph.spaceAfterPt ?? 0,
                  deck,
                ),
                marginLeft: pptxParagraphOffset(
                  paragraph.marginLeftPt ?? 0,
                  deck,
                ),
                textIndent: pptxParagraphOffset(paragraph.indentPt ?? 0, deck),
                minHeight: '1em',
                textAlign: paragraph.align,
                lineHeight: pptxParagraphLineHeight(paragraph, shape, deck),
              }}
            >
              {paragraph.bullet && <span>{paragraph.bullet} </span>}
              {paragraph.runs.map((run, r) => (
                <span
                  key={r}
                  style={{
                    fontSize: pptxRunFontSize(run, shape, deck),
                    color: run.color,
                    fontFamily: run.fontFamily ?? undefined,
                    fontWeight: run.bold ? 'bold' : 'normal',
                    fontStyle: run.italic ? 'italic' : 'normal',
                    textDecoration: pptxRunTextDecoration(run),
                  }}
                >
                  {run.text}
                </span>
              ))}
            </p>
          ))
        : shape.text}
    </div>
  );
}
