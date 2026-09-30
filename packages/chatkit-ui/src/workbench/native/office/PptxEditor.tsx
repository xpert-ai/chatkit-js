import * as React from 'react';
import {
  parsePptx,
  savePptx,
  createPptxFile,
  type PptxDeck,
  type PptxShape,
} from './pptx-file.utils';
import {
  createSlideCopy,
  createTextBoxShape,
  paragraphsForShapeText,
  cloneDeck,
} from './pptx-editor-model.utils';
import { PptxEditHistory } from './pptx-editor-history.utils';
import { PptxCanvas } from './PptxCanvas';
import type { BinaryEditorHandle, BinaryEditorProps } from '../file-types';
import { useChatkitTranslation } from '../../../i18n/useChatkitTranslation';

const PptxEditor = React.forwardRef<BinaryEditorHandle, BinaryEditorProps>(
  function PptxEditor({ blob, name, onDirty }, ref) {
    const { t } = useChatkitTranslation();
    const [deck, setDeck] = React.useState<PptxDeck | null>(null);
    const [slideIndex, setSlideIndex] = React.useState(0);
    const [selected, select] = React.useState<string | null>(null);
    const [error, setError] = React.useState('');
    const source = React.useRef<ArrayBuffer | null>(null);
    const history = React.useRef(new PptxEditHistory());
    React.useEffect(() => {
      let disposed = false;
      setDeck(null);
      setError('');
      history.current.reset();
      void blob
        .arrayBuffer()
        .then(async (buffer) => {
          const parsed = await parsePptx(buffer);
          if (!disposed) {
            source.current = buffer;
            setDeck(parsed);
            setSlideIndex(0);
            select(null);
          }
        })
        .catch((error: unknown) => {
          if (!disposed)
            setError(
              error instanceof Error
                ? error.message
                : t('workbench.files.failed'),
            );
        });
      return () => {
        disposed = true;
      };
    }, [blob, t]);
    React.useImperativeHandle(
      ref,
      () => ({
        exportFile: async () => {
          if (!deck || !source.current)
            throw new Error(t('workbench.files.loading'));
          return createPptxFile(
            await savePptx(cloneDeck(deck), source.current),
            name,
          );
        },
      }),
      [deck, name, t],
    );
    function edit(action: (next: PptxDeck) => void) {
      if (!deck) return;
      history.current.push(deck);
      const next = cloneDeck(deck);
      action(next);
      setDeck(next);
      onDirty();
    }
    function changeShape(action: (shape: PptxShape) => void) {
      edit((next) => {
        const shape = next.slides[slideIndex]?.shapes.find(
          (shape) => shape.id === selected,
        );
        if (shape?.editable) action(shape);
      });
    }
    const slide = deck?.slides[slideIndex];
    const shape = slide?.shapes.find(
      (item) => item.id === selected && item.editable && !item.deleted,
    );
    const button =
      'rounded-[var(--chat-item-radius)] px-2.5 py-1.5 text-xs hover:bg-muted disabled:opacity-40';
    if (error)
      return (
        <p role="alert" className="p-4 text-sm text-destructive">
          {error}
        </p>
      );
    if (!deck || !slide)
      return (
        <p role="status" className="p-4 text-sm text-muted-foreground">
          {t('workbench.files.loading')}
        </p>
      );
    return (
      <div className="flex h-full min-h-0 flex-col">
        <div
          role="toolbar"
          className="flex shrink-0 flex-wrap gap-1 border-b p-2"
        >
          {(['undo', 'redo'] as const).map((key) => (
            <button
              key={key}
              className={button}
              disabled={
                key === 'undo'
                  ? !history.current.canUndo
                  : !history.current.canRedo
              }
              onClick={() => {
                const next = history.current[key](deck);
                if (next) {
                  setDeck(next);
                  setSlideIndex((index) =>
                    Math.min(index, next.slides.length - 1),
                  );
                  onDirty();
                }
              }}
            >
              {t(`workbench.files.${key}`)}
            </button>
          ))}
          <button
            className={button}
            onClick={() => {
              edit((next) =>
                next.slides.splice(
                  slideIndex + 1,
                  0,
                  createSlideCopy(next, next.slides[slideIndex], true),
                ),
              );
              setSlideIndex(slideIndex + 1);
              select(null);
            }}
          >
            {t('workbench.files.addSlide')}
          </button>
          <button
            className={button}
            disabled={deck.slides.length < 2}
            onClick={() => {
              edit((next) => next.slides.splice(slideIndex, 1));
              setSlideIndex(Math.max(0, slideIndex - 1));
              select(null);
            }}
          >
            {t('workbench.files.deleteSlide')}
          </button>
          <button
            className={button}
            onClick={() => {
              const text = createTextBoxShape(deck);
              edit((next) => next.slides[slideIndex].shapes.push(text));
              select(text.id);
            }}
          >
            {t('workbench.files.addText')}
          </button>
          {shape && (
            <button
              className={button}
              onClick={() => {
                changeShape((shape) => {
                  shape.deleted = true;
                });
                select(null);
              }}
            >
              {t('workbench.files.delete')}
            </button>
          )}
        </div>
        <div className="flex min-h-0 flex-1">
          <div className="w-24 shrink-0 space-y-3 overflow-y-auto border-r p-2 sm:w-32">
            {deck.slides.map((item, index) => (
              <button
                key={item.path}
                aria-label={`${t('workbench.files.slide')} ${index + 1}`}
                aria-current={slideIndex === index ? 'page' : undefined}
                className={`w-full rounded-[var(--chat-item-radius)] p-1 text-left text-xs ${index === slideIndex ? 'bg-muted ring-1 ring-ring' : 'hover:bg-muted'}`}
                onClick={() => {
                  setSlideIndex(index);
                  select(null);
                }}
              >
                <PptxCanvas deck={deck} slide={item} />
                <span className="mt-1 block">{index + 1}</span>
              </button>
            ))}
          </div>
          <div className="min-w-0 flex-1 overflow-auto bg-muted/30 p-3 sm:p-5">
            <PptxCanvas
              deck={deck}
              slide={slide}
              selected={selected}
              onSelect={select}
              onMove={(id, x, y) =>
                edit((next) => {
                  const moved = next.slides[slideIndex].shapes.find(
                    (shape) => shape.id === id,
                  );
                  if (moved) {
                    moved.x = x;
                    moved.y = y;
                  }
                })
              }
            />
            {shape && (
              <div className="mt-4 space-y-3 rounded-[var(--chat-panel-radius)] bg-background p-3">
                {shape.kind === 'shape' && (
                  <>
                    <label className="block text-xs text-muted-foreground">
                      {t('workbench.files.text')}
                      <textarea
                        className="mt-2 min-h-20 w-full rounded-[var(--chat-item-radius)] border bg-background p-2 text-sm text-foreground"
                        value={shape.text}
                        onChange={(event) =>
                          changeShape((shape) => {
                            shape.text = event.target.value;
                            shape.paragraphs = paragraphsForShapeText(
                              shape,
                              shape.text,
                            );
                          })
                        }
                      />
                    </label>
                    <div className="flex flex-wrap items-center gap-2">
                      {(['bold', 'italic', 'underline'] as const).map((key) => (
                        <button
                          key={key}
                          aria-pressed={shape[key]}
                          className={`${button} ${shape[key] ? 'bg-muted' : ''}`}
                          onClick={() =>
                            changeShape((shape) => {
                              shape[key] = !shape[key];
                              shape.formatDirty = true;
                              shape.paragraphs = paragraphsForShapeText(
                                shape,
                                shape.text,
                              );
                            })
                          }
                        >
                          {t(`workbench.files.${key}`)}
                        </button>
                      ))}
                      <input
                        type="number"
                        aria-label={t('workbench.files.fontSize')}
                        className="w-16 rounded-[var(--chat-item-radius)] border bg-background p-1 text-sm"
                        min={1}
                        max={200}
                        value={shape.fontSizePt}
                        onChange={(event) =>
                          changeShape((shape) => {
                            shape.fontSizePt = Math.max(
                              1,
                              Math.min(200, Number(event.target.value)),
                            );
                            shape.formatDirty = true;
                            shape.paragraphs = paragraphsForShapeText(
                              shape,
                              shape.text,
                            );
                          })
                        }
                      />
                    </div>
                  </>
                )}
                {shape.table && (
                  <div className="overflow-auto">
                    <table className="w-full border-collapse">
                      <tbody>
                        {shape.table.rows.map((row, r) => (
                          <tr key={r}>
                            {row.map((cell, c) =>
                              cell.merged ? null : (
                                <td
                                  key={c}
                                  colSpan={cell.colSpan}
                                  rowSpan={cell.rowSpan}
                                  className="border p-1"
                                >
                                  <input
                                    aria-label={`${r + 1}, ${c + 1}`}
                                    className="w-full min-w-16 bg-background p-1 text-sm"
                                    value={cell.text}
                                    onChange={(event) =>
                                      changeShape((shape) => {
                                        if (shape.table) {
                                          shape.table.rows[r][c].text =
                                            event.target.value;
                                          shape.tableDirty = true;
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
              </div>
            )}
          </div>
        </div>
      </div>
    );
  },
);
export default PptxEditor;
