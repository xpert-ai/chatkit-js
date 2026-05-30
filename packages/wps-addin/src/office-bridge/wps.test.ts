import { afterEach, describe, expect, it, vi } from 'vitest';
import { WpsWordAdapter, wpsInternalTestUtils } from './wps';
import type { WpsApplication, WpsDocument, WpsRange } from '../wps-api';

function stubWpsApplication(application: WpsApplication): WpsApplication {
  vi.stubGlobal('Application', application);
  window.Application = application;
  return application;
}

function createRange(overrides: Partial<WpsRange> = {}): WpsRange {
  return {
    Text: '',
    Start: 0,
    End: 0,
    ...overrides,
  };
}

describe('WpsWordAdapter', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    delete window.Application;
  });

  it('validates heading levels', () => {
    expect(wpsInternalTestUtils.normalizeHeadingLevel(undefined)).toBe(1);
    expect(wpsInternalTestUtils.normalizeHeadingLevel(3)).toBe(3);
    expect(() => wpsInternalTestUtils.normalizeHeadingLevel(10)).toThrow(
      'between 1 and 9',
    );
    expect(wpsInternalTestUtils.readHeadingStyle(1)).toBe(-2);
    expect(wpsInternalTestUtils.readHeadingStyle(9)).toBe(-10);
  });

  it('inserts text at the start and end of the WPS document body', async () => {
    const startRange = createRange({
      InsertBefore: vi.fn(),
    });
    const endRange = createRange({
      InsertAfter: vi.fn(),
    });
    const document: WpsDocument = {
      Content: createRange({
        Text: 'Existing body',
        Start: 0,
        End: 13,
      }),
      Range: vi.fn((start) => (start === 0 ? startRange : endRange)),
    };
    stubWpsApplication({
      ActiveDocument: document,
    });

    const adapter = new WpsWordAdapter();
    const startResult = await adapter.execute('office_word_insert_text', {
      text: 'Prefix',
      location: 'Start',
    });
    const endResult = await adapter.execute('office_word_insert_text', {
      text: 'Suffix',
      location: 'End',
    });

    expect(document.Range).toHaveBeenCalledWith(0, 0);
    expect(document.Range).toHaveBeenCalledWith(13, 13);
    expect(startRange.InsertBefore).toHaveBeenCalledWith('Prefix');
    expect(endRange.InsertAfter).toHaveBeenCalledWith('Suffix');
    expect(startResult).toEqual({
      inserted: true,
      location: 'Start',
      textLength: 6,
    });
    expect(endResult).toEqual({
      inserted: true,
      location: 'End',
      textLength: 6,
    });
  });

  it('replaces the current selection', async () => {
    const typeText = vi.fn();
    stubWpsApplication({
      Selection: {
        Text: 'Original',
        TypeText: typeText,
      },
    });

    const adapter = new WpsWordAdapter();
    const result = await adapter.execute('office_word_replace_selection', {
      text: 'Updated paragraph',
    });

    expect(typeText).toHaveBeenCalledWith('Updated paragraph');
    expect(result).toEqual({
      replaced: true,
      textLength: 17,
    });
  });

  it('normalizes jagged table values before inserting a table', async () => {
    const insertedRange = createRange();
    const cells = new Map<string, WpsRange>();
    const table = {
      Cell: vi.fn((row: number, column: number) => {
        const key = `${row}:${column}`;
        const range = createRange();
        cells.set(key, range);
        return { Range: range };
      }),
    };
    const addTable = vi.fn(() => table);
    const document: WpsDocument = {
      Content: createRange({
        Text: 'Existing body',
        Start: 0,
        End: 13,
      }),
      Range: vi.fn(() => insertedRange),
      Tables: {
        Add: addTable,
      },
    };
    stubWpsApplication({
      ActiveDocument: document,
    });

    const adapter = new WpsWordAdapter();
    const result = await adapter.execute('office_word_insert_table', {
      location: 'Start',
      values: [
        ['Name', 'Score'],
        ['Ada'],
      ],
    });

    expect(addTable).toHaveBeenCalledWith(insertedRange, 2, 2);
    expect(cells.get('1:1')?.Text).toBe('Name');
    expect(cells.get('1:2')?.Text).toBe('Score');
    expect(cells.get('2:1')?.Text).toBe('Ada');
    expect(cells.get('2:2')?.Text).toBe('');
    expect(result).toEqual({
      inserted: true,
      location: 'Start',
      rowCount: 2,
      columnCount: 2,
    });
  });

  it('returns bounded search results', async () => {
    stubWpsApplication({
      ActiveDocument: {
        Content: createRange({
          Text: 'alpha hit beta HIT hitman final hit',
          Start: 0,
          End: 34,
        }),
      },
    });

    const adapter = new WpsWordAdapter({ maxSearchResults: 2 });
    const result = await adapter.execute('office_word_search_text', {
      query: 'hit',
      matchWholeWord: true,
    });

    expect(result).toEqual({
      query: 'hit',
      count: 3,
      results: [
        {
          index: 1,
          start: 7,
          text: 'hit',
        },
        {
          index: 2,
          start: 16,
          text: 'HIT',
        },
      ],
      truncated: true,
    });
  });
});
