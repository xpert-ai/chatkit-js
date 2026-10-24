import * as React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { initI18n } from '../../../../i18n';
import { PptxCanvas } from './PptxCanvas';
import { parsePptx, type PptxDeck, type PptxSlide } from './pptx-file.utils';
import { createPresentation } from './pptx-fixture.test-support';

beforeEach(async () => {
  await initI18n().changeLanguage('en-US');
});
afterEach(cleanup);

it('keeps an edit started as soon as the loaded canvas is committed', async () => {
  const deck = await parsePptx(await createPresentation());
  function ImmediateEdit({ deck }: { deck: PptxDeck }) {
    const [selected, select] = React.useState<string | null>(null);
    const slidePath = deck.slides[0].path;
    React.useLayoutEffect(() => {
      // Model input arriving before the new canvas's passive effects run.
      screen
        .getByRole('button', { name: 'Title' })
        .dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    }, [slidePath]);
    return (
      <PptxCanvas
        deck={deck}
        slide={deck.slides[0]}
        selected={selected}
        onSelect={select}
        onText={() => {}}
      />
    );
  }
  const { rerender } = render(<ImmediateEdit deck={deck} />);
  expect(screen.getByRole('textbox', { name: 'Text' })).toHaveValue(
    'Visible title',
  );
  rerender(
    <ImmediateEdit
      deck={{
        ...deck,
        slides: [{ ...deck.slides[0], path: 'ppt/slides/slide2.xml' }],
      }}
    />,
  );
  expect(screen.getByRole('textbox', { name: 'Text' })).toHaveValue(
    'Visible title',
  );
});

it('preserves editing on the same slide and clears it when switching slides', async () => {
  const deck = await parsePptx(await createPresentation());
  const slide = deck.slides[0];
  const title = slide.shapes.find((shape) => shape.name === 'Title');
  if (!title) throw new Error('The presentation fixture must contain a title');
  const onText = vi.fn();
  const canvas = (slide: PptxSlide) => (
    <PptxCanvas
      deck={deck}
      slide={slide}
      selected={title.id}
      onSelect={() => {}}
      onText={onText}
    />
  );
  const { rerender } = render(canvas(slide));
  fireEvent.doubleClick(screen.getByRole('button', { name: 'Title' }));
  fireEvent.change(screen.getByRole('textbox', { name: 'Text' }), {
    target: { value: 'Draft title' },
  });
  expect(onText).toHaveBeenLastCalledWith(title.id, 'Draft title');
  rerender(canvas({ ...slide }));
  expect(screen.getByRole('textbox', { name: 'Text' })).toHaveValue(
    'Draft title',
  );

  // PPTX shape IDs can be reused by different slides.
  rerender(canvas({ ...slide, path: 'ppt/slides/slide2.xml' }));
  expect(screen.queryByRole('textbox', { name: 'Text' })).toBeNull();
  fireEvent.doubleClick(screen.getByRole('button', { name: 'Title' }));
  expect(screen.getByRole('textbox', { name: 'Text' })).toHaveValue(
    'Visible title',
  );
  rerender(canvas(slide));
  expect(screen.queryByRole('textbox', { name: 'Text' })).toBeNull();
});
