import { describe, expect, it } from 'vitest';
import {
  findAdjacentComposerToken,
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
