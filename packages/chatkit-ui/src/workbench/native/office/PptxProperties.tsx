import type { PptxShape } from './pptx-file.utils';
import { useChatkitTranslation } from '../../../i18n/useChatkitTranslation';
import { paragraphsForShapeText } from './pptx-editor-model.utils';

const inputClass =
  'w-full min-w-0 rounded-[var(--chat-item-radius)] border bg-background px-2 py-1 text-xs';
const buttonClass =
  'rounded-[var(--chat-item-radius)] border px-2 py-1 text-xs hover:bg-muted';
function colorValue(color: string | null) {
  if (/^#[0-9a-f]{6}$/i.test(color ?? '')) return color!;
  const channels = color?.match(/\d+/g)?.slice(0, 3);
  return channels?.length === 3
    ? '#' +
        channels.map((c) => Number(c).toString(16).padStart(2, '0')).join('')
    : '#000000';
}
export function PptxProperties({
  shape,
  change,
  layer,
  duplicate,
  remove,
}: {
  shape: PptxShape;
  change: (action: (shape: PptxShape) => void) => void;
  layer: (direction: 'front' | 'back') => void;
  duplicate: () => void;
  remove: () => void;
}) {
  const { t } = useChatkitTranslation();
  const label = (key: string) => t(`workbench.office.${key}`);
  function format(action: (shape: PptxShape) => void) {
    change((shape) => {
      action(shape);
      shape.formatDirty = true;
      shape.paragraphs = paragraphsForShapeText(shape, shape.text);
    });
  }
  return (
    <aside
      aria-label={label('properties')}
      className="w-56 shrink-0 space-y-4 overflow-y-auto border-l bg-background p-3"
    >
      <div className="text-sm font-medium">{label('properties')}</div>
      <p className="truncate text-xs text-muted-foreground" title={shape.name}>
        {shape.name}
      </p>
      <div className="grid grid-cols-2 gap-2">
        {(['x', 'y', 'width', 'height'] as const).map((key) => (
          <label key={key} className="text-xs text-muted-foreground">
            {label(key)} (cm)
            <input
              type="number"
              className={inputClass}
              step="0.1"
              min={key === 'width' || key === 'height' ? 0.1 : undefined}
              value={Number((shape[key] / 360000).toFixed(2))}
              onChange={(e) => {
                const value = e.target.valueAsNumber;
                if (Number.isFinite(value))
                  change((s) => {
                    s[key] = Math.round(
                      Math.max(
                        key === 'width' || key === 'height' ? 0.1 : -1000,
                        value,
                      ) * 360000,
                    );
                  });
              }}
            />
          </label>
        ))}
        <label className="text-xs text-muted-foreground">
          {label('rotation')}
          <input
            type="number"
            className={inputClass}
            value={shape.rotation}
            onChange={(e) => {
              if (Number.isFinite(e.target.valueAsNumber))
                change((s) => {
                  s.rotation = e.target.valueAsNumber;
                });
            }}
          />
        </label>
      </div>
      {shape.kind === 'shape' && (
        <>
          <p className="text-xs text-muted-foreground">{label('inlineHint')}</p>
          <label className="block text-xs">
            {label('font')}
            <input
              className={inputClass}
              value={shape.fontFamily ?? ''}
              onChange={(e) =>
                format((s) => {
                  s.fontFamily = e.target.value;
                })
              }
            />
          </label>
          <div className="flex items-center gap-1">
            <input
              type="number"
              className={inputClass}
              aria-label={t('workbench.files.fontSize')}
              min={1}
              max={200}
              value={shape.fontSizePt}
              onChange={(e) => {
                if (e.target.valueAsNumber > 0)
                  format((s) => {
                    s.fontSizePt = Math.min(200, e.target.valueAsNumber);
                  });
              }}
            />
            {(['bold', 'italic', 'underline'] as const).map((key, i) => (
              <button
                key={key}
                className={buttonClass}
                aria-label={t(`workbench.files.${key}`)}
                aria-pressed={shape[key]}
                onClick={() =>
                  format((s) => {
                    s[key] = !s[key];
                  })
                }
              >
                {['B', 'I', 'U'][i]}
              </button>
            ))}
          </div>
          <label className="block text-xs">
            {label('textAlign')}
            <select
              className={inputClass}
              value={shape.textAlign}
              onChange={(e) =>
                format((s) => {
                  s.textAlign = e.target.value as PptxShape['textAlign'];
                })
              }
            >
              {(['left', 'center', 'right', 'justify'] as const).map(
                (value) => (
                  <option key={value} value={value}>
                    {label(value)}
                  </option>
                ),
              )}
            </select>
          </label>
          <label className="block text-xs">
            {label('textColor')}
            <input
              type="color"
              className="ml-2 h-6 w-8 align-middle"
              value={colorValue(shape.textColor)}
              onChange={(e) =>
                format((s) => {
                  s.textColor = e.target.value;
                })
              }
            />
          </label>
        </>
      )}
      {(shape.kind === 'shape' || shape.kind === 'line') && (
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <label>
            {label('fill')}{' '}
            <input
              type="color"
              className="h-6 w-8 align-middle"
              value={colorValue(shape.fill)}
              onChange={(e) =>
                change((s) => {
                  s.fill = e.target.value;
                  delete s.fillCss;
                  s.shapeStyleDirty = true;
                })
              }
            />
          </label>
          <button
            className={buttonClass}
            onClick={() =>
              change((s) => {
                s.fill = null;
                delete s.fillCss;
                s.shapeStyleDirty = true;
              })
            }
          >
            {label('transparent')}
          </button>
          <label>
            {label('stroke')}{' '}
            <input
              type="color"
              className="h-6 w-8 align-middle"
              value={colorValue(shape.stroke)}
              onChange={(e) =>
                change((s) => {
                  s.stroke = e.target.value;
                  s.strokeWidth = Math.max(1, s.strokeWidth);
                  s.shapeStyleDirty = true;
                })
              }
            />
          </label>
        </div>
      )}
      {shape.table && (
        <div className="overflow-auto">
          <table className="w-full">
            <tbody>
              {shape.table.rows.map((row, r) => (
                <tr key={r}>
                  {row.map((cell, c) =>
                    cell.merged ? null : (
                      <td key={c} colSpan={cell.colSpan} rowSpan={cell.rowSpan}>
                        <input
                          className={inputClass}
                          aria-label={`${label('cell')} ${r + 1}, ${c + 1}`}
                          value={cell.text}
                          onChange={(e) =>
                            change((s) => {
                              if (s.table) {
                                s.table.rows[r][c].text = e.target.value;
                                s.tableDirty = true;
                              }
                            })
                          }
                        />
                      </td>
                    ),
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        <button className={buttonClass} onClick={() => layer('front')}>
          {label('front')}
        </button>
        <button className={buttonClass} onClick={() => layer('back')}>
          {label('back')}
        </button>
        <button className={buttonClass} onClick={duplicate}>
          {label('duplicate')}
        </button>
        <button className={buttonClass} onClick={remove}>
          {t('workbench.files.delete')}
        </button>
      </div>
    </aside>
  );
}
