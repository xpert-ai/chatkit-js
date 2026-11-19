import { describe, expect, it } from 'vitest';
import {
  findAdjacentComposerToken,
  getComposerSelectionOffsets,
  setComposerSelectionOffset,
  getComposerEditingText,
  getComposerPlainText,
  getComposerThreadReferences,
  getComposerTokenPartMap,
  readComposerPartsFromElement,
  replaceComposerRange,
  type ComposerThreadPart,
} from './composer-parts';

const thread: ComposerThreadPart = {
  type: 'thread',
  key: 'thread:source',
  reference: {
    type: 'thread',
    conversationId: 'conversation',
    threadId: 'source',
    label: 'Long conversation title',
  },
};

describe('thread composer tokens', () => {
  it('does not submit the trailing editable-line placeholder as an extra newline', () => {
    const editor = document.createElement('div');
    editor.append(document.createTextNode('First line\n'));
    const placeholder = document.createElement('br');
    placeholder.setAttribute('data-composer-trailing-break', '');
    editor.append(placeholder);
    expect(
      getComposerPlainText(readComposerPartsFromElement(editor, new Map())),
    ).toBe('First line\n');
    placeholder.removeAttribute('data-composer-trailing-break');
    expect(
      getComposerPlainText(readComposerPartsFromElement(editor, new Map())),
    ).toBe('First line\n\n');
  });
  it('uses atomic caret positions without serializing titles into the submitted text', () => {
    const parts = [
      { type: 'text' as const, text: 'Use ' },
      thread,
      { type: 'text' as const, text: ' please' },
    ];
    expect(getComposerEditingText(parts)).toHaveLength(12);
    expect(getComposerPlainText(parts)).toBe('Use  please');
    expect(getComposerThreadReferences(parts)).toEqual([thread.reference]);
    expect(findAdjacentComposerToken(parts, 5, 'before')).toBe(thread);
    expect(findAdjacentComposerToken(parts, 4, 'after')).toBe(thread);
    expect(
      getComposerThreadReferences(replaceComposerRange(parts, 4, 5, [])),
    ).toEqual([]);
  });

  it('recovers known token identity from the edited DOM and ignores forged DOM labels', () => {
    const element = document.createElement('div');
    element.innerHTML =
      'Use <span contenteditable="false" data-composer-thread-key="thread:source">Changed label</span> please';
    const parts = readComposerPartsFromElement(
      element,
      getComposerTokenPartMap([thread]),
    );
    expect(getComposerThreadReferences(parts)).toEqual([thread.reference]);
    expect(getComposerPlainText(parts)).toBe('Use  please');
  });
});

describe('browser multiline composer DOM', () => {
  it.each([
    [
      'First<div><br></div><div>  第二行</div><div>Last</div>',
      'First\n\n  第二行\nLast',
    ],
    ['<div>First</div><div>Second</div>', 'First\nSecond'],
    ['First<div><br></div>', 'First\n'],
    ['<div><br></div><div>Second</div>', '\nSecond'],
    ['<br>', ''],
  ])('preserves block line breaks in %s', (html, text) => {
    const element = document.createElement('div');
    element.contentEditable = 'true';
    element.innerHTML = html;
    document.body.append(element);
    expect(
      getComposerPlainText(readComposerPartsFromElement(element, new Map())),
    ).toBe(text);
    for (let offset = 0; offset <= text.length; offset++) {
      setComposerSelectionOffset(element, offset);
      expect(getComposerSelectionOffsets(element)).toEqual({
        start: offset,
        end: offset,
      });
    }
    element.remove();
  });
});
