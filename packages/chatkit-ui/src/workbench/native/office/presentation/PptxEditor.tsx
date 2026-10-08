import * as React from 'react';
import {
  Plus,
  Copy,
  ChevronUp,
  ChevronDown,
  ImagePlus,
  Table2,
  Type,
  Shapes,
  Play,
  SlidersHorizontal,
  Undo2,
  Redo2,
  Trash2,
} from 'lucide-react';
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
  createPresetShape,
  createTableShape,
  copyShapeForSlide,
  moveShapeLayer,
} from './pptx-editor-model.utils';
import { PptxEditHistory } from './pptx-editor-history.utils';
import { PptxCanvas } from './PptxCanvas';
import { PptxProperties } from './PptxProperties';
import { PptxSlideshow } from './PptxSlideshow';
import type {
  BinaryEditorHandle,
  BinaryEditorProps,
} from '../../../../lib/files/file-types';
import { useChatkitTranslation } from '../../../../i18n/useChatkitTranslation';

const button =
  'inline-flex items-center gap-1.5 rounded-[var(--chat-item-radius)] px-2 py-1.5 text-xs hover:bg-muted disabled:opacity-40';
const PptxEditor = React.forwardRef<BinaryEditorHandle, BinaryEditorProps>(
  function PptxEditor({ blob, name, onDirty }, ref) {
    const { t } = useChatkitTranslation();
    const label = (key: string) => t(`workbench.office.${key}`);
    const [deck, setDeck] = React.useState<PptxDeck | null>(null);
    const [slideIndex, setSlideIndex] = React.useState(0);
    const [selected, select] = React.useState<string | null>(null);
    const [error, setError] = React.useState('');
    const [zoom, setZoom] = React.useState(100);
    const [properties, setProperties] = React.useState(true);
    const [presenting, setPresenting] = React.useState(false);
    const [rows, setRows] = React.useState(3);
    const [columns, setColumns] = React.useState(3);
    const imageInput = React.useRef<HTMLInputElement>(null);
    const source = React.useRef<ArrayBuffer | null>(null);
    const history = React.useRef(new PptxEditHistory());
    const editGroup = React.useRef<string | undefined>(undefined);
    const currentDeck = React.useRef(deck);
    currentDeck.current = deck;
    React.useEffect(() => {
      let disposed = false;
      setDeck(null);
      setError('');
      history.current.reset();
      editGroup.current = undefined;
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
          if (!currentDeck.current || !source.current)
            throw new Error(t('workbench.files.loading'));
          return createPptxFile(
            await savePptx(cloneDeck(currentDeck.current), source.current),
            name,
          );
        },
        markSaved: () => {
          history.current.markSaved();
          editGroup.current = undefined;
        },
      }),
      [name, t],
    );
    function edit(action: (next: PptxDeck) => void, group?: string) {
      const current = currentDeck.current;
      if (!current) return;
      const next = cloneDeck(current);
      action(next);
      if (!group || group !== editGroup.current) history.current.push(current);
      editGroup.current = group;
      currentDeck.current = next;
      setDeck(next);
      onDirty(history.current.dirty);
    }
    function changeShape(action: (shape: PptxShape) => void) {
      edit((next) => {
        const shape = next.slides[slideIndex]?.shapes.find(
          (s) => s.id === selected,
        );
        if (shape?.editable) action(shape);
      });
    }
    function travel(key: 'undo' | 'redo') {
      if (!currentDeck.current) return;
      const next = history.current[key](currentDeck.current);
      if (next) {
        currentDeck.current = next;
        setDeck(next);
        setSlideIndex((i) => Math.min(i, next.slides.length - 1));
        select(null);
        editGroup.current = undefined;
        onDirty(history.current.dirty);
      }
    }
    const slide = deck?.slides[slideIndex];
    const shape = slide?.shapes.find(
      (s) => s.id === selected && s.editable && !s.deleted,
    );
    function addShape(item: PptxShape) {
      item.id = `editor-${crypto.randomUUID()}`;
      edit((next) => next.slides[slideIndex].shapes.push(item));
      select(item.id);
    }
    function addSlide(blank: boolean) {
      if (!deck || !slide) return;
      const copy = createSlideCopy(deck, slide, blank);
      copy.path = `ppt/slides/editor-${crypto.randomUUID()}.xml`;
      edit((next) => next.slides.splice(slideIndex + 1, 0, copy));
      setSlideIndex(slideIndex + 1);
      select(null);
    }
    function removeShape() {
      changeShape((s) => {
        s.deleted = true;
      });
      select(null);
    }
    function duplicateShape() {
      if (shape && deck) addShape(copyShapeForSlide(shape, deck));
    }
    function moveSlide(delta: number) {
      if (
        !deck ||
        slideIndex + delta < 0 ||
        slideIndex + delta >= deck.slides.length
      )
        return;
      edit((next) => {
        const [moved] = next.slides.splice(slideIndex, 1);
        next.slides.splice(slideIndex + delta, 0, moved);
      });
      setSlideIndex(slideIndex + delta);
    }
    async function insertImage(file: File) {
      if (!deck) return;
      const targetSlide = slide?.path;
      try {
        if (
          !['image/png', 'image/jpeg', 'image/webp'].includes(file.type) ||
          file.size > 10 * 1024 * 1024
        )
          throw new Error(label('imageLimit'));
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () =>
            typeof reader.result === 'string'
              ? resolve(reader.result)
              : reject(new Error(label('imageLimit')));
          reader.onerror = () => reject(reader.error);
          reader.readAsDataURL(file);
        });
        const image = new Image();
        image.src = dataUrl;
        await image.decode();
        const item = createTextBoxShape(deck);
        item.id = `image-${crypto.randomUUID()}`;
        item.name = file.name;
        item.kind = 'image';
        item.text = '';
        item.paragraphs = [];
        item.width = Math.round(
          Math.min(
            deck.width * 0.6,
            (deck.height * 0.6 * image.width) / image.height,
          ),
        );
        item.height = Math.round((item.width * image.height) / image.width);
        item.imageSrc = dataUrl;
        edit((next) =>
          next.slides.find((s) => s.path === targetSlide)?.shapes.push(item),
        );
        select(item.id);
        setError('');
      } catch (error) {
        setError(
          error instanceof Error ? error.message : t('workbench.files.failed'),
        );
      }
    }
    if (!deck || !slide)
      return (
        <p role={error ? 'alert' : 'status'} className="p-4 text-sm">
          {error || t('workbench.files.loading')}
        </p>
      );
    return (
      <div
        className="flex h-full min-h-0 flex-col"
        onKeyDown={(event) => {
          const target = event.target;
          if (
            target instanceof HTMLElement &&
            (target.isContentEditable ||
              /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))
          )
            return;
          if (
            (event.ctrlKey || event.metaKey) &&
            event.key.toLowerCase() === 'z'
          ) {
            event.preventDefault();
            travel(event.shiftKey ? 'redo' : 'undo');
          } else if (
            (event.ctrlKey || event.metaKey) &&
            event.key.toLowerCase() === 'd'
          ) {
            event.preventDefault();
            shape ? duplicateShape() : addSlide(false);
          } else if (
            (event.key === 'Delete' || event.key === 'Backspace') &&
            shape
          ) {
            event.preventDefault();
            removeShape();
          } else if (
            shape &&
            ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(
              event.key,
            )
          ) {
            event.preventDefault();
            const step = event.shiftKey ? 95250 : 9525;
            changeShape((s) => {
              if (event.key === 'ArrowUp') s.y -= step;
              if (event.key === 'ArrowDown') s.y += step;
              if (event.key === 'ArrowLeft') s.x -= step;
              if (event.key === 'ArrowRight') s.x += step;
            });
          }
        }}
      >
        <div
          role="toolbar"
          aria-label={label('slideTools')}
          className="flex shrink-0 flex-wrap items-center gap-1 border-b px-2 py-1.5"
        >
          <button
            className={button}
            aria-label={t('workbench.files.undo')}
            disabled={!history.current.canUndo}
            onClick={() => travel('undo')}
          >
            <Undo2 size={16} />
          </button>
          <button
            className={button}
            aria-label={t('workbench.files.redo')}
            disabled={!history.current.canRedo}
            onClick={() => travel('redo')}
          >
            <Redo2 size={16} />
          </button>
          <span className="mx-1 h-5 border-l" />
          <button className={button} onClick={() => addSlide(true)}>
            <Plus size={15} />
            {t('workbench.files.addSlide')}
          </button>
          <button
            className={button}
            aria-label={label('duplicateSlide')}
            onClick={() => addSlide(false)}
          >
            <Copy size={15} />
          </button>
          <button
            className={button}
            aria-label={t('workbench.files.deleteSlide')}
            disabled={deck.slides.length < 2}
            onClick={() => {
              edit((next) => next.slides.splice(slideIndex, 1));
              setSlideIndex(Math.max(0, slideIndex - 1));
              select(null);
            }}
          >
            <Trash2 size={15} />
          </button>
          <span className="mx-1 h-5 border-l" />
          <button
            className={button}
            onClick={() => {
              const text = createTextBoxShape(deck);
              text.text = label('newText');
              text.paragraphs = paragraphsForShapeText(text, text.text);
              addShape(text);
            }}
          >
            <Type size={15} />
            {t('workbench.files.addText')}
          </button>
          <button
            className={button}
            onClick={() => imageInput.current?.click()}
          >
            <ImagePlus size={15} />
            {label('image')}
          </button>
          <input
            ref={imageInput}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void insertImage(file);
              e.target.value = '';
            }}
          />
          <label className={button}>
            <Shapes size={15} />
            <select
              aria-label={label('shape')}
              className="max-w-24 bg-transparent"
              value=""
              onChange={(e) => {
                if (e.target.value)
                  addShape(createPresetShape(deck, e.target.value));
              }}
            >
              <option value="">{label('shape')}</option>
              {['rect', 'roundRect', 'ellipse', 'triangle', 'diamond'].map(
                (g) => (
                  <option key={g} value={g}>
                    {label(g)}
                  </option>
                ),
              )}
            </select>
          </label>
          <details className="relative">
            <summary className={`${button} cursor-pointer list-none`}>
              <Table2 size={15} />
              {label('table')}
            </summary>
            <div className="absolute left-0 z-20 w-44 space-y-2 rounded-[var(--chat-panel-radius)] border bg-background p-3 shadow-lg">
              <label className="block text-xs">
                {label('rows')}
                <input
                  className="ml-2 w-16 rounded-[var(--chat-item-radius)] border"
                  type="number"
                  min={1}
                  max={20}
                  value={rows}
                  onChange={(e) =>
                    setRows(
                      Math.max(1, Math.min(20, e.target.valueAsNumber || 1)),
                    )
                  }
                />
              </label>
              <label className="block text-xs">
                {label('columns')}
                <input
                  className="ml-2 w-16 rounded-[var(--chat-item-radius)] border"
                  type="number"
                  min={1}
                  max={10}
                  value={columns}
                  onChange={(e) =>
                    setColumns(
                      Math.max(1, Math.min(10, e.target.valueAsNumber || 1)),
                    )
                  }
                />
              </label>
              <button
                className={button}
                onClick={(e) => {
                  const table = createTableShape(deck, rows, columns);
                  table.table?.rows.forEach((row) =>
                    row.forEach((cell) => {
                      cell.text = '';
                    }),
                  );
                  addShape(table);
                  e.currentTarget.closest('details')?.removeAttribute('open');
                }}
              >
                {label('insert')}
              </button>
            </div>
          </details>
          <div className="flex-1" />
          <button className={button} onClick={() => setPresenting(true)}>
            <Play size={15} />
            {label('present')}
          </button>
          <button
            className={button}
            aria-label={label('properties')}
            aria-pressed={properties}
            onClick={() => setProperties(!properties)}
          >
            <SlidersHorizontal size={15} />
          </button>
        </div>
        {error && (
          <p role="alert" className="px-3 py-1 text-xs text-destructive">
            {error}
          </p>
        )}
        <div className="flex min-h-0 flex-1">
          <div className="flex w-24 shrink-0 flex-col border-r sm:w-32">
            <div className="flex justify-center border-b p-1">
              <button
                className={button}
                aria-label={label('moveUp')}
                disabled={slideIndex === 0}
                onClick={() => moveSlide(-1)}
              >
                <ChevronUp size={14} />
              </button>
              <button
                className={button}
                aria-label={label('moveDown')}
                disabled={slideIndex === deck.slides.length - 1}
                onClick={() => moveSlide(1)}
              >
                <ChevronDown size={14} />
              </button>
            </div>
            <div className="min-h-0 space-y-3 overflow-y-auto p-2">
              {deck.slides.map((item, index) => (
                <button
                  key={item.path}
                  aria-label={`${t('workbench.files.slide')} ${index + 1}`}
                  aria-current={slideIndex === index ? 'page' : undefined}
                  className={`w-full rounded-[var(--chat-item-radius)] p-1 text-left text-xs ${index === slideIndex ? 'bg-muted ring-1 ring-ring' : 'hover:bg-muted'}`}
                  onClick={() => {
                    setSlideIndex(index);
                    select(null);
                    editGroup.current = undefined;
                  }}
                >
                  <PptxCanvas deck={deck} slide={item} />
                  <span className="mt-1 block">{index + 1}</span>
                </button>
              ))}
            </div>
          </div>
          <div
            className="min-w-0 flex-1 overflow-auto bg-muted/30 p-4"
            tabIndex={0}
            aria-label={label('canvas')}
          >
            <div
              style={{ width: `${zoom}%`, minWidth: 180 }}
              className="mx-auto"
            >
              <PptxCanvas
                deck={deck}
                slide={slide}
                selected={selected}
                onSelect={select}
                onTransform={(id, bounds) =>
                  edit((next) => {
                    const s = next.slides[slideIndex].shapes.find(
                      (s) => s.id === id,
                    );
                    if (s?.editable) Object.assign(s, bounds);
                  })
                }
                onText={(id, text) =>
                  edit((next) => {
                    const s = next.slides[slideIndex].shapes.find(
                      (s) => s.id === id,
                    );
                    if (s?.editable && s.text !== text) {
                      s.text = text;
                      s.paragraphs = paragraphsForShapeText(s, text);
                    }
                  }, `text:${slide.path}:${id}`)
                }
                onTextEnd={() => {
                  editGroup.current = undefined;
                }}
              />
            </div>
          </div>
          {shape && properties && (
            <PptxProperties
              shape={shape}
              change={changeShape}
              layer={(direction) =>
                edit((next) => {
                  const shapes = next.slides[slideIndex].shapes;
                  const target = shapes.find((s) => s.id === selected);
                  if (target) moveShapeLayer(shapes, target, direction);
                })
              }
              duplicate={duplicateShape}
              remove={removeShape}
            />
          )}
        </div>
        <div className="flex shrink-0 items-center gap-3 border-t px-3 py-1.5 text-xs text-muted-foreground">
          <span>
            {slideIndex + 1} / {deck.slides.length}
          </span>
          <span className="flex-1 truncate">
            {shape?.name ?? label('inlineHint')}
          </span>
          <label className="flex items-center gap-2">
            {label('zoom')}
            <input
              aria-label={label('zoom')}
              type="range"
              min={50}
              max={200}
              step={10}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="w-20"
            />
            {zoom}%
          </label>
          <button className={button} onClick={() => setZoom(100)}>
            {label('fit')}
          </button>
        </div>
        {presenting && (
          <PptxSlideshow
            deck={deck}
            initialIndex={slideIndex}
            onClose={() => setPresenting(false)}
          />
        )}
      </div>
    );
  },
);
export default PptxEditor;
