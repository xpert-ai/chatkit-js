import { isWordToolName, type WordToolName } from './tools';
import type {
  OfficeHostAdapter,
  WordBodyInsertLocation,
  WordTableValues,
} from './types';

type OfficeReadyInfo = {
  host?: Office.HostType;
  platform?: Office.PlatformType;
};

type WordAdapterOptions = {
  maxSnapshotCharacters?: number;
  maxSearchResults?: number;
};

type NormalizedTableData = {
  rowCount: number;
  columnCount: number;
  values?: WordTableValues;
};

const DEFAULT_MAX_SNAPSHOT_CHARACTERS = 5000;
const DEFAULT_MAX_SEARCH_RESULTS = 20;

function readOptionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function readString(value: unknown, field: string): string {
  const normalized = readOptionalString(value);
  if (!normalized) {
    throw new Error(`${field} must be a non-empty string.`);
  }
  return normalized;
}

function readBoolean(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined;
}

function readOptionalPositiveInteger(value: unknown): number | undefined {
  if (typeof value !== 'number' || !Number.isInteger(value) || value <= 0) {
    return undefined;
  }
  return value;
}

function readPositiveInteger(value: unknown, field: string): number {
  const normalized = readOptionalPositiveInteger(value);
  if (normalized === undefined) {
    throw new Error(`${field} must be a positive integer.`);
  }
  return normalized;
}

function readBodyInsertLocation(
  value: unknown,
  fallback: WordBodyInsertLocation = 'End',
): WordBodyInsertLocation {
  const location = readOptionalString(value)?.toLowerCase();
  if (!location) {
    return fallback;
  }
  if (location === 'start') {
    return 'Start';
  }
  if (location === 'end') {
    return 'End';
  }
  throw new Error('location must be Start or End.');
}

function normalizeHeadingLevel(value: unknown): number {
  if (value === undefined) {
    return 1;
  }
  const level = readPositiveInteger(value, 'level');
  if (level > 9) {
    throw new Error('level must be between 1 and 9.');
  }
  return level;
}

function normalizeCellValue(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }
  if (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return String(value);
  }
  throw new Error('table values must contain only strings, numbers, booleans, or nulls.');
}

function readRawTableRows(value: unknown): string[][] | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (!Array.isArray(value)) {
    throw new Error('values must be a two-dimensional array.');
  }
  return value.map((row) => {
    if (!Array.isArray(row)) {
      throw new Error('values must be a two-dimensional array.');
    }
    return row.map(normalizeCellValue);
  });
}

function readNormalizedTableData(params: Record<string, unknown>): NormalizedTableData {
  const rawRows = readRawTableRows(params.values);
  const explicitRowCount = readOptionalPositiveInteger(params.rowCount);
  const explicitColumnCount = readOptionalPositiveInteger(params.columnCount);

  if (!rawRows) {
    return {
      rowCount: readPositiveInteger(params.rowCount, 'rowCount'),
      columnCount: readPositiveInteger(params.columnCount, 'columnCount'),
    };
  }

  const inferredRowCount = rawRows.length;
  const inferredColumnCount = rawRows.reduce(
    (maxColumns, row) => Math.max(maxColumns, row.length),
    0,
  );
  const rowCount = explicitRowCount ?? inferredRowCount;
  const columnCount = explicitColumnCount ?? inferredColumnCount;

  if (rowCount <= 0 || columnCount <= 0) {
    throw new Error('values must include at least one row and one column.');
  }

  return {
    rowCount,
    columnCount,
    values: Array.from({ length: rowCount }, (_, rowIndex) =>
      Array.from(
        { length: columnCount },
        (_, columnIndex) => rawRows[rowIndex]?.[columnIndex] ?? '',
      ),
    ),
  };
}

function readOfficeReadyInfo(): OfficeReadyInfo {
  return {
    host: globalThis.Office?.context?.host,
    platform: globalThis.Office?.context?.platform,
  };
}

function readRequirementSupport() {
  const requirements = globalThis.Office?.context?.requirements;
  return {
    wordApi: {
      '1.1': Boolean(requirements?.isSetSupported('WordApi', '1.1')),
      '1.3': Boolean(requirements?.isSetSupported('WordApi', '1.3')),
      '1.4': Boolean(requirements?.isSetSupported('WordApi', '1.4')),
    },
  };
}

export class WordOfficeAdapter implements OfficeHostAdapter<WordToolName> {
  readonly host = 'Word';

  readonly #maxSnapshotCharacters: number;

  readonly #maxSearchResults: number;

  constructor(options: WordAdapterOptions = {}) {
    this.#maxSnapshotCharacters =
      options.maxSnapshotCharacters ?? DEFAULT_MAX_SNAPSHOT_CHARACTERS;
    this.#maxSearchResults = options.maxSearchResults ?? DEFAULT_MAX_SEARCH_RESULTS;
  }

  supports(toolName: string): toolName is WordToolName {
    return isWordToolName(toolName);
  }

  async execute(
    toolName: WordToolName,
    params: Record<string, unknown>,
  ): Promise<unknown> {
    switch (toolName) {
      case 'office_word_snapshot':
        return this.snapshot(params);
      case 'office_word_insert_text':
        return this.insertText(params);
      case 'office_word_replace_selection':
        return this.replaceSelection(params);
      case 'office_word_insert_heading':
        return this.insertHeading(params);
      case 'office_word_insert_table':
        return this.insertTable(params);
      case 'office_word_search_text':
        return this.searchText(params);
    }
  }

  private async snapshot(params: Record<string, unknown>) {
    const maxCharacters =
      readOptionalPositiveInteger(params.maxCharacters) ??
      this.#maxSnapshotCharacters;

    return Word.run(async (context) => {
      const body = context.document.body;
      const selection = context.document.getSelection();
      body.load('text');
      selection.load('text');
      await context.sync();

      return {
        host: readOfficeReadyInfo(),
        requirements: readRequirementSupport(),
        bodyTextLength: body.text.length,
        bodyTextPreview: body.text.slice(0, maxCharacters),
        bodyTextTruncated: body.text.length > maxCharacters,
        selectionText: selection.text,
      };
    });
  }

  private async insertText(params: Record<string, unknown>) {
    const text = readString(params.text, 'text');
    const location = readBodyInsertLocation(params.location);

    return Word.run(async (context) => {
      context.document.body.insertText(text, location);
      await context.sync();
      return {
        inserted: true,
        location,
        textLength: text.length,
      };
    });
  }

  private async replaceSelection(params: Record<string, unknown>) {
    const text = readString(params.text, 'text');

    return Word.run(async (context) => {
      context.document.getSelection().insertText(text, 'Replace');
      await context.sync();
      return {
        replaced: true,
        textLength: text.length,
      };
    });
  }

  private async insertHeading(params: Record<string, unknown>) {
    const text = readString(params.text, 'text');
    const level = normalizeHeadingLevel(params.level);
    const location = readBodyInsertLocation(params.location);
    const styleBuiltIn = `Heading${level}` as Word.BuiltInStyleName;

    return Word.run(async (context) => {
      const paragraph = context.document.body.insertParagraph(text, location);
      paragraph.styleBuiltIn = styleBuiltIn;
      await context.sync();
      return {
        inserted: true,
        level,
        location,
        textLength: text.length,
      };
    });
  }

  private async insertTable(params: Record<string, unknown>) {
    const location = readBodyInsertLocation(params.location);
    const table = readNormalizedTableData(params);

    return Word.run(async (context) => {
      context.document.body.insertTable(
        table.rowCount,
        table.columnCount,
        location,
        table.values,
      );
      await context.sync();
      return {
        inserted: true,
        location,
        rowCount: table.rowCount,
        columnCount: table.columnCount,
      };
    });
  }

  private async searchText(params: Record<string, unknown>) {
    const query = readString(params.query, 'query');
    const maxResults =
      readOptionalPositiveInteger(params.maxResults) ?? this.#maxSearchResults;

    return Word.run(async (context) => {
      const results = context.document.body.search(query, {
        matchCase: readBoolean(params.matchCase),
        matchWholeWord: readBoolean(params.matchWholeWord),
      });
      results.load('items/text');
      await context.sync();
      const items = results.items.slice(0, maxResults).map((item, index) => ({
        index: index + 1,
        text: item.text,
      }));

      return {
        query,
        count: results.items.length,
        results: items,
        truncated: results.items.length > items.length,
      };
    });
  }
}

export function createWordOfficeAdapter(
  options: WordAdapterOptions = {},
): OfficeHostAdapter<WordToolName> {
  return new WordOfficeAdapter(options);
}

export const wordInternalTestUtils = {
  normalizeHeadingLevel,
  readNormalizedTableData,
};
