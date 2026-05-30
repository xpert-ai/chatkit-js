import { afterEach, describe, expect, it, vi } from 'vitest';
import { WordOfficeAdapter, wordInternalTestUtils } from './word';

function stubOffice() {
  vi.stubGlobal('Office', {
    context: {
      host: 'Word',
      platform: 'PC',
      requirements: {
        isSetSupported: vi.fn(() => true),
      },
    },
  });
}

function stubWordRun(context: Word.RequestContext) {
  const run = vi.fn(async (callback: (ctx: Word.RequestContext) => Promise<unknown>) =>
    callback(context),
  );
  vi.stubGlobal('Word', {
    run,
  });
  return run;
}

describe('WordOfficeAdapter', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('validates heading levels', () => {
    expect(wordInternalTestUtils.normalizeHeadingLevel(undefined)).toBe(1);
    expect(wordInternalTestUtils.normalizeHeadingLevel(3)).toBe(3);
    expect(() => wordInternalTestUtils.normalizeHeadingLevel(10)).toThrow(
      'between 1 and 9',
    );
  });

  it('replaces the current selection', async () => {
    stubOffice();
    const insertText = vi.fn();
    const context = {
      document: {
        getSelection: vi.fn(() => ({
          insertText,
        })),
      },
      sync: vi.fn(),
    } as unknown as Word.RequestContext;
    stubWordRun(context);

    const adapter = new WordOfficeAdapter();
    const result = await adapter.execute('office_word_replace_selection', {
      text: 'Updated paragraph',
    });

    expect(insertText).toHaveBeenCalledWith('Updated paragraph', 'Replace');
    expect(result).toEqual({
      replaced: true,
      textLength: 17,
    });
  });

  it('normalizes jagged table values before inserting a table', async () => {
    stubOffice();
    const insertTable = vi.fn();
    const context = {
      document: {
        body: {
          insertTable,
        },
      },
      sync: vi.fn(),
    } as unknown as Word.RequestContext;
    stubWordRun(context);

    const adapter = new WordOfficeAdapter();
    const result = await adapter.execute('office_word_insert_table', {
      location: 'Start',
      values: [
        ['Name', 'Score'],
        ['Ada'],
      ],
    });

    expect(insertTable).toHaveBeenCalledWith(2, 2, 'Start', [
      ['Name', 'Score'],
      ['Ada', ''],
    ]);
    expect(result).toEqual({
      inserted: true,
      location: 'Start',
      rowCount: 2,
      columnCount: 2,
    });
  });

  it('returns bounded search results', async () => {
    stubOffice();
    const load = vi.fn();
    const search = vi.fn(() => ({
      load,
      items: [{ text: 'alpha hit' }, { text: 'beta hit' }],
    }));
    const context = {
      document: {
        body: {
          search,
        },
      },
      sync: vi.fn(),
    } as unknown as Word.RequestContext;
    stubWordRun(context);

    const adapter = new WordOfficeAdapter({ maxSearchResults: 1 });
    const result = await adapter.execute('office_word_search_text', {
      query: 'hit',
      matchCase: true,
    });

    expect(search).toHaveBeenCalledWith('hit', {
      matchCase: true,
      matchWholeWord: undefined,
    });
    expect(load).toHaveBeenCalledWith('items/text');
    expect(result).toEqual({
      query: 'hit',
      count: 2,
      results: [
        {
          index: 1,
          text: 'alpha hit',
        },
      ],
      truncated: true,
    });
  });
});
