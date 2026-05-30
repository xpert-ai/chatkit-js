import { isWordToolName, type WordToolName } from './tools';
import type {
  OfficeHostAdapter,
  WordBodyInsertLocation,
  WordTableValues,
} from './types';
import {
  getActiveDocument,
  getActiveSelection,
  getWpsApplication,
  type WpsApplication,
  type WpsDocument,
  type WpsRange,
  type WpsTable,
} from '../wps-api';

type WpsAdapterOptions = {
  maxSnapshotCharacters?: number;
  maxSearchResults?: number;
};

type NormalizedTableData = {
  rowCount: number;
  columnCount: number;
  values?: WordTableValues;
};

type TextMatch = {
  index: number;
  text: string;
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

function readBodyText(document: WpsDocument): string {
  return document.Content?.Text ?? '';
}

function readInsertionRange(
  document: WpsDocument,
  location: WordBodyInsertLocation,
): WpsRange {
  const content = document.Content;
  if (!content) {
    throw new Error('The active WPS document does not expose a content range.');
  }

  const start = content.Start ?? 0;
  const end = content.End ?? readBodyText(document).length;
  const position = location === 'Start' ? start : end;
  return document.Range?.(position, position) ?? content;
}

function insertTextAtBodyLocation(
  document: WpsDocument,
  text: string,
  location: WordBodyInsertLocation,
): WpsRange {
  const range = readInsertionRange(document, location);
  if (location === 'Start' && range.InsertBefore) {
    range.InsertBefore(text);
    return range;
  }
  if (location === 'End' && range.InsertAfter) {
    range.InsertAfter(text);
    return range;
  }
  range.Text = text;
  return range;
}

function readHeadingStyle(level: number): number {
  return -(level + 1);
}

function fillTableValues(table: WpsTable | undefined, values: WordTableValues): void {
  if (!table?.Cell) {
    return;
  }

  values.forEach((row, rowIndex) => {
    row.forEach((value, columnIndex) => {
      const cell = table.Cell?.(rowIndex + 1, columnIndex + 1);
      if (cell?.Range) {
        cell.Range.Text = value;
      }
    });
  });
}

function readHostInfo(application: WpsApplication) {
  return {
    name: application.Name ?? 'WPS Writer',
    build: application.Build,
    version: application.Version,
  };
}

function isWordCharacter(value: string): boolean {
  return /^[\p{L}\p{N}_]$/u.test(value);
}

function isWholeWordMatch(text: string, start: number, length: number): boolean {
  const previous = start > 0 ? text[start - 1] : '';
  const next = start + length < text.length ? text[start + length] : '';
  return !isWordCharacter(previous) && !isWordCharacter(next);
}

function findTextMatches(
  text: string,
  query: string,
  options: {
    matchCase?: boolean;
    matchWholeWord?: boolean;
  },
): TextMatch[] {
  const haystack = options.matchCase ? text : text.toLocaleLowerCase();
  const needle = options.matchCase ? query : query.toLocaleLowerCase();
  const matches: TextMatch[] = [];
  let offset = 0;

  while (offset <= haystack.length) {
    const foundAt = haystack.indexOf(needle, offset);
    if (foundAt === -1) {
      break;
    }
    offset = foundAt + Math.max(needle.length, 1);
    if (
      options.matchWholeWord &&
      !isWholeWordMatch(text, foundAt, query.length)
    ) {
      continue;
    }
    matches.push({
      index: foundAt + 1,
      text: text.slice(foundAt, foundAt + query.length),
    });
  }

  return matches;
}

export class WpsWordAdapter implements OfficeHostAdapter<WordToolName> {
  readonly host = 'WPS Writer';

  readonly #maxSnapshotCharacters: number;

  readonly #maxSearchResults: number;

  constructor(options: WpsAdapterOptions = {}) {
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

  private snapshot(params: Record<string, unknown>) {
    const maxCharacters =
      readOptionalPositiveInteger(params.maxCharacters) ??
      this.#maxSnapshotCharacters;
    const application = getWpsApplication();
    const document = getActiveDocument(application);
    const bodyText = readBodyText(document);

    return {
      host: readHostInfo(application),
      requirements: {
        wpsJsApi: true,
      },
      documentName: document.Name,
      bodyTextLength: bodyText.length,
      bodyTextPreview: bodyText.slice(0, maxCharacters),
      bodyTextTruncated: bodyText.length > maxCharacters,
      selectionText: application.Selection?.Text ?? '',
    };
  }

  private insertText(params: Record<string, unknown>) {
    const text = readString(params.text, 'text');
    const location = readBodyInsertLocation(params.location);
    const document = getActiveDocument(getWpsApplication());

    insertTextAtBodyLocation(document, text, location);
    return {
      inserted: true,
      location,
      textLength: text.length,
    };
  }

  private replaceSelection(params: Record<string, unknown>) {
    const text = readString(params.text, 'text');
    const selection = getActiveSelection(getWpsApplication());

    if (selection.TypeText) {
      selection.TypeText(text);
    } else {
      selection.Text = text;
    }

    return {
      replaced: true,
      textLength: text.length,
    };
  }

  private insertHeading(params: Record<string, unknown>) {
    const text = readString(params.text, 'text');
    const level = normalizeHeadingLevel(params.level);
    const location = readBodyInsertLocation(params.location);
    const document = getActiveDocument(getWpsApplication());
    const range = insertTextAtBodyLocation(document, `${text}\r`, location);
    range.Style = readHeadingStyle(level);

    return {
      inserted: true,
      level,
      location,
      textLength: text.length,
    };
  }

  private insertTable(params: Record<string, unknown>) {
    const location = readBodyInsertLocation(params.location);
    const table = readNormalizedTableData(params);
    const document = getActiveDocument(getWpsApplication());
    const range = readInsertionRange(document, location);
    const insertedTable = document.Tables?.Add?.(
      range,
      table.rowCount,
      table.columnCount,
    );

    if (!document.Tables?.Add) {
      throw new Error('The active WPS document does not expose table insertion.');
    }

    if (table.values) {
      fillTableValues(insertedTable, table.values);
    }

    return {
      inserted: true,
      location,
      rowCount: table.rowCount,
      columnCount: table.columnCount,
    };
  }

  private searchText(params: Record<string, unknown>) {
    const query = readString(params.query, 'query');
    const maxResults =
      readOptionalPositiveInteger(params.maxResults) ?? this.#maxSearchResults;
    const matchCase = readBoolean(params.matchCase);
    const matchWholeWord = readBoolean(params.matchWholeWord);
    const document = getActiveDocument(getWpsApplication());
    const matches = findTextMatches(readBodyText(document), query, {
      matchCase,
      matchWholeWord,
    });
    const results = matches.slice(0, maxResults).map((match, index) => ({
      index: index + 1,
      start: match.index,
      text: match.text,
    }));

    return {
      query,
      count: matches.length,
      results,
      truncated: matches.length > results.length,
    };
  }
}

export function createWpsWordAdapter(
  options: WpsAdapterOptions = {},
): OfficeHostAdapter<WordToolName> {
  return new WpsWordAdapter(options);
}

export const wpsInternalTestUtils = {
  findTextMatches,
  normalizeHeadingLevel,
  readHeadingStyle,
  readNormalizedTableData,
};
