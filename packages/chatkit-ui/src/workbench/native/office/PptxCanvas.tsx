import * as React from 'react';
import type { PptxDeck, PptxShape, PptxSlide } from './pptx-file.utils';
import {
  pptxShapeStyle,
  pptxSlideBackground,
  pptxTextPadding,
  pptxRunFontSize,
  pptxRunTextDecoration,
  pptxParagraphLineHeight,
  pptxImageStyle,
  pptxConnectorPath,
} from './pptx-editor-view.utils';

export function PptxCanvas({
  deck,
  slide,
  selected,
  onSelect,
  onMove,
}: {
  deck: PptxDeck;
  slide: PptxSlide;
  selected?: string | null;
  onSelect?: (id: string) => void;
  onMove?: (id: string, x: number, y: number) => void;
}) {
  const canvas = React.useRef<HTMLDivElement>(null);
  const drag = React.useRef<{
    id: string;
    x: number;
    y: number;
    startX: number;
    startY: number;
    scaleX: number;
    scaleY: number;
  } | null>(null);
  const [offset, setOffset] = React.useState<{
    id: string;
    x: number;
    y: number;
  } | null>(null);
  return (
    <div
      ref={canvas}
      className="relative w-full overflow-hidden shadow-sm"
      style={{
        aspectRatio: `${deck.width} / ${deck.height}`,
        containerType: 'inline-size',
        background: pptxSlideBackground(slide),
      }}
      onPointerMove={(event) => {
        const current = drag.current;
        if (current)
          setOffset({
            id: current.id,
            x: current.x + (event.clientX - current.startX) * current.scaleX,
            y: current.y + (event.clientY - current.startY) * current.scaleY,
          });
      }}
      onPointerUp={() => {
        if (drag.current && offset && onMove)
          onMove(drag.current.id, offset.x, offset.y);
        drag.current = null;
        setOffset(null);
      }}
      onPointerCancel={() => {
        drag.current = null;
        setOffset(null);
      }}
    >
      {slide.shapes
        .filter((shape) => !shape.deleted)
        .map((original) => {
          const shape =
            offset?.id === original.id
              ? { ...original, x: offset.x, y: offset.y }
              : original;
          return (
            <div
              key={shape.id}
              role={onSelect && shape.editable ? 'button' : undefined}
              tabIndex={onSelect && shape.editable ? 0 : undefined}
              aria-label={shape.name}
              aria-pressed={
                onSelect && shape.editable ? selected === shape.id : undefined
              }
              className="absolute border-solid"
              style={{
                ...pptxShapeStyle(shape, deck),
                whiteSpace: shape.wrap ? 'pre-wrap' : 'pre',
                outline:
                  selected === shape.id ? '2px solid var(--ring)' : undefined,
                cursor: onSelect && shape.editable ? 'move' : undefined,
              }}
              onKeyDown={(event) => {
                if (
                  shape.editable &&
                  (event.key === 'Enter' || event.key === ' ')
                ) {
                  event.preventDefault();
                  onSelect?.(shape.id);
                }
              }}
              onPointerDown={(event) => {
                if (!shape.editable || !onSelect) return;
                event.stopPropagation();
                onSelect(shape.id);
                if (onMove && canvas.current) {
                  const bounds = canvas.current.getBoundingClientRect();
                  drag.current = {
                    id: shape.id,
                    x: shape.x,
                    y: shape.y,
                    startX: event.clientX,
                    startY: event.clientY,
                    scaleX: deck.width / bounds.width,
                    scaleY: deck.height / bounds.height,
                  };
                  event.currentTarget.setPointerCapture(event.pointerId);
                }
              }}
            >
              <ShapeContent shape={shape} deck={deck} />
            </div>
          );
        })}
    </div>
  );
}
function ShapeContent({ shape, deck }: { shape: PptxShape; deck: PptxDeck }) {
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
        <path
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
