import { it, expect } from 'vitest';
import JSZip from 'jszip';
import { createPresentation } from './pptx-fixture.test-support';
import { parsePptx, savePptx } from './pptx-file.utils';
import {
  createSlideCopy,
  paragraphsForShapeText,
} from './pptx-editor-model.utils';

it('edits slide text and position while retaining embedded media and original package parts', async () => {
  const source = await createPresentation();
  const deck = await parsePptx(source);
  const title = deck.slides[0].shapes.find((shape) => shape.kind === 'shape')!;
  title.text = 'Edited presentation';
  title.paragraphs = paragraphsForShapeText(title, title.text);
  title.x += 10000;
  const saved = await savePptx(deck, source);
  const reread = await parsePptx(saved);
  expect(
    reread.slides[0].shapes.find((shape) => shape.id === title.id),
  ).toMatchObject({ text: title.text, x: title.x });
  const [original, changed] = await Promise.all([
    JSZip.loadAsync(source),
    JSZip.loadAsync(saved),
  ]);
  expect(
    await changed.file('ppt/media/image1.png')!.async('uint8array'),
  ).toEqual(await original.file('ppt/media/image1.png')!.async('uint8array'));
});
it('adds a slide with valid presentation relationships and removes it again', async () => {
  const source = await createPresentation();
  const deck = await parsePptx(source);
  deck.slides.push(createSlideCopy(deck, deck.slides[0], false));
  const saved = await savePptx(deck, source);
  const reloaded = await parsePptx(saved);
  expect(reloaded.slides).toHaveLength(2);
  expect(
    reloaded.slides[1].shapes.some((shape) => shape.kind === 'image'),
  ).toBe(true);
  reloaded.slides.splice(1, 1);
  expect(
    (await parsePptx(await savePptx(reloaded, saved))).slides,
  ).toHaveLength(1);
});
