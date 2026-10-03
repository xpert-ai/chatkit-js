import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  readWorkbenchLayout,
  workbenchLayoutKey,
  writeWorkbenchLayout,
} from './layout-storage';

describe('assistant workbench layout storage', () => {
  beforeEach(() => window.localStorage.clear());
  afterEach(() => vi.restoreAllMocks());

  it('isolates assistants, organizations and services without depending on a conversation', () => {
    const key = workbenchLayoutKey(
      'https://example.test/api/ai/',
      'org-a',
      'assistant-a',
    );
    const layout = {
      open: true,
      expanded: true,
      chatWidth: 520,
      workbenchSide: 'left' as const,
    };
    writeWorkbenchLayout(key, layout);
    expect(
      readWorkbenchLayout(
        workbenchLayoutKey(
          'https://example.test/api/ai',
          'org-a',
          'assistant-a',
        ),
      ),
    ).toEqual(layout);
    for (const other of [
      workbenchLayoutKey('https://example.test/api/ai', 'org-a', 'assistant-b'),
      workbenchLayoutKey('https://example.test/api/ai', 'org-b', 'assistant-a'),
      workbenchLayoutKey('https://other.test/api/ai', 'org-a', 'assistant-a'),
    ])
      expect(readWorkbenchLayout(other)).toEqual({
        open: false,
        expanded: false,
        chatWidth: null,
        workbenchSide: 'right',
      });
    expect(workbenchLayoutKey('/api/ai', 'org-a', '')).toBeNull();
  });

  it.each([
    'broken json',
    'null',
    '{"open":true}',
    '{"open":true,"expanded":true,"chatWidth":-1}',
    '{"open":true,"expanded":true,"chatWidth":"520"}',
  ])('ignores invalid saved data: %s', (raw) => {
    window.localStorage.setItem('layout-test', raw);
    expect(readWorkbenchLayout('layout-test')).toEqual({
      open: false,
      expanded: false,
      chatWidth: null,
      workbenchSide: 'right',
    });
  });

  it.each([undefined, 'invalid', false])(
    'defaults old or unrecognized pane positions to the right: %s',
    (workbenchSide) => {
      window.localStorage.setItem(
        'layout-test',
        JSON.stringify({
          open: true,
          expanded: false,
          chatWidth: 520,
          workbenchSide,
        }),
      );
      expect(readWorkbenchLayout('layout-test')).toEqual({
        open: true,
        expanded: false,
        chatWidth: 520,
        workbenchSide: 'right',
      });
    },
  );

  it('tolerates blocked storage and write quota errors', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('Blocked', 'SecurityError');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Full', 'QuotaExceededError');
    });
    expect(readWorkbenchLayout('layout-test')).toEqual({
      open: false,
      expanded: false,
      chatWidth: null,
      workbenchSide: 'right',
    });
    expect(() =>
      writeWorkbenchLayout('layout-test', {
        open: true,
        expanded: false,
        chatWidth: 600,
        workbenchSide: 'left',
      }),
    ).not.toThrow();
  });
});
