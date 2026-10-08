import * as React from 'react';
import { Blob as NodeBlob } from 'node:buffer';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  act,
} from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import PptxEditor from './PptxEditor';
import type { BinaryEditorHandle } from '../../../../lib/files/file-types';
import { initI18n } from '../../../../i18n';
import { createPresentation } from './pptx-fixture.test-support';
import { parsePptx } from './pptx-file.utils';
import { spreadsheetBytes } from '../spreadsheet/spreadsheet-xlsx-preservation';
import { resizeShape } from './pptx-gestures';
beforeEach(async () => {
  await initI18n().changeLanguage('en-US');
});
afterEach(cleanup);
it('resizes a rotated shape around its opposite corner without flipping at minimum size', () => {
  const original = { x: 0, y: 0, width: 1000000, height: 500000, rotation: 90 };
  expect(resizeShape(original, 'se', -100000, 200000)).toEqual({
    x: -150000,
    y: 50000,
    width: 1200000,
    height: 600000,
  });
  const minimum = resizeShape(original, 'nw', 10000000, 10000000);
  expect(minimum.width).toBeGreaterThan(0);
  expect(minimum.height).toBeGreaterThan(0);
});
it('edits on the canvas, preserves undo across save, and exports a readable presentation', async () => {
  const source = new NodeBlob([await createPresentation()]) as Blob;
  const ref = React.createRef<BinaryEditorHandle>();
  const onDirty = vi.fn();
  render(
    <PptxEditor ref={ref} blob={source} name="test.pptx" onDirty={onDirty} />,
  );
  fireEvent.doubleClick(await screen.findByRole('button', { name: 'Title' }));
  const text = screen.getByRole('textbox', { name: 'Text' });
  fireEvent.change(text, { target: { value: 'Changed title' } });
  fireEvent.change(text, { target: { value: 'Final title' } });
  expect(onDirty).toHaveBeenLastCalledWith(true);
  // Save while the inline field is still focused: no blur is needed to commit typing.
  const saved = await ref.current!.exportFile();
  const bytes = await spreadsheetBytes(saved);
  expect(
    (await parsePptx(bytes.slice().buffer)).slides[0].shapes.find(
      (s) => s.kind === 'shape',
    )?.text,
  ).toBe('Final title');
  act(() => ref.current!.markSaved?.(saved));
  fireEvent.blur(text);
  fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
  expect(onDirty).toHaveBeenLastCalledWith(true);
  expect(screen.getAllByText('Visible title').length).toBeGreaterThan(0);
  fireEvent.click(screen.getByRole('button', { name: 'Redo' }));
  expect(onDirty).toHaveBeenLastCalledWith(false);
  await waitFor(() =>
    expect(screen.getAllByText('Final title').length).toBeGreaterThan(0),
  );
});
it('duplicates and reorders slides and preserves inserted tables and resized shapes after reload', async () => {
  const ref = React.createRef<BinaryEditorHandle>();
  render(
    <PptxEditor
      ref={ref}
      blob={new NodeBlob([await createPresentation()]) as Blob}
      name="test.pptx"
      onDirty={() => {}}
    />,
  );
  fireEvent.click(
    await screen.findByRole('button', { name: 'Duplicate slide' }),
  );
  fireEvent.click(screen.getByRole('button', { name: 'Duplicate slide' }));
  fireEvent.click(screen.getByRole('button', { name: 'Move slide up' }));
  fireEvent.change(screen.getByRole('combobox', { name: 'Shape' }), {
    target: { value: 'ellipse' },
  });
  fireEvent.change(screen.getByLabelText('Width (cm)'), {
    target: { value: '5' },
  });
  fireEvent.click(screen.getByText('Table', { selector: 'summary' }));
  fireEvent.click(screen.getByRole('button', { name: 'Insert' }));
  fireEvent.change(screen.getByLabelText('Cell 1, 1'), {
    target: { value: 'Budget' },
  });
  const bytes = await spreadsheetBytes(await ref.current!.exportFile());
  const deck = await parsePptx(bytes.slice().buffer);
  expect(deck.slides).toHaveLength(3);
  expect(
    deck.slides[1].shapes.find((s) => s.geometry === 'ellipse'),
  ).toMatchObject({ width: 1800000 });
  expect(
    deck.slides[1].shapes.find((s) => s.kind === 'table')?.table?.rows[0][0]
      .text,
  ).toBe('Budget');
});
it('does not nudge a selected object when navigating the slideshow', async () => {
  const onDirty = vi.fn();
  render(
    <PptxEditor
      blob={new NodeBlob([await createPresentation()]) as Blob}
      name="test.pptx"
      onDirty={onDirty}
    />,
  );
  fireEvent.doubleClick(await screen.findByRole('button', { name: 'Title' }));
  fireEvent.blur(screen.getByRole('textbox', { name: 'Text' }));
  fireEvent.click(screen.getByRole('button', { name: 'Presentation preview' }));
  fireEvent.keyDown(screen.getByRole('dialog'), { key: 'ArrowRight' });
  expect(onDirty).not.toHaveBeenCalled();
});
