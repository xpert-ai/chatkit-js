import { isExcelToolName, type ExcelToolName } from './tools';
import type { ExcelCellValue, ExcelRangeValues, OfficeHostAdapter } from './types';

type OfficeReadyInfo = {
  host?: Office.HostType;
  platform?: Office.PlatformType;
};

type ExcelAdapterOptions = {
  maxSnapshotRows?: number;
  maxSnapshotColumns?: number;
};

const DEFAULT_MAX_SNAPSHOT_ROWS = 20;
const DEFAULT_MAX_SNAPSHOT_COLUMNS = 10;

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

function readBoolean(value: unknown, fallback = false): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function readOptionalPositiveInteger(value: unknown): number | undefined {
  if (typeof value !== 'number' || !Number.isInteger(value) || value <= 0) {
    return undefined;
  }
  return value;
}

function requireConfirm(value: unknown, action: string): void {
  if (value !== true) {
    throw new Error(`${action} requires confirm: true.`);
  }
}

function normalizeCellValue(value: unknown): ExcelCellValue {
  if (value === null || value === undefined) {
    return null;
  }
  if (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return value;
  }
  throw new Error('range values must contain only strings, numbers, booleans, or nulls.');
}

function readRangeValues(value: unknown): ExcelRangeValues {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error('values must be a non-empty two-dimensional array.');
  }

  const rows = value.map((row) => {
    if (!Array.isArray(row)) {
      throw new Error('values must be a non-empty two-dimensional array.');
    }
    return row.map(normalizeCellValue);
  });
  const columnCount = rows.reduce((maxColumns, row) => Math.max(maxColumns, row.length), 0);
  if (columnCount === 0) {
    throw new Error('values must include at least one column.');
  }

  return rows.map((row) =>
    Array.from({ length: columnCount }, (_, columnIndex) => row[columnIndex] ?? null),
  );
}

function getWorksheet(
  context: Excel.RequestContext,
  worksheetName?: string,
): Excel.Worksheet {
  return worksheetName
    ? context.workbook.worksheets.getItem(worksheetName)
    : context.workbook.worksheets.getActiveWorksheet();
}

function getRange(
  worksheet: Excel.Worksheet,
  address?: string,
): Excel.Range {
  return address ? worksheet.getRange(address) : worksheet.getUsedRange();
}

function clipValues(
  values: unknown,
  maxRows: number,
  maxColumns: number,
): unknown[][] {
  if (!Array.isArray(values)) {
    return [];
  }
  return values
    .slice(0, maxRows)
    .filter(Array.isArray)
    .map((row) => row.slice(0, maxColumns));
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
    excelApi: {
      '1.1': Boolean(requirements?.isSetSupported('ExcelApi', '1.1')),
      '1.4': Boolean(requirements?.isSetSupported('ExcelApi', '1.4')),
      '1.7': Boolean(requirements?.isSetSupported('ExcelApi', '1.7')),
    },
  };
}

export class ExcelOfficeAdapter implements OfficeHostAdapter<ExcelToolName> {
  readonly host = 'Excel';

  readonly #maxSnapshotRows: number;

  readonly #maxSnapshotColumns: number;

  constructor(options: ExcelAdapterOptions = {}) {
    this.#maxSnapshotRows = options.maxSnapshotRows ?? DEFAULT_MAX_SNAPSHOT_ROWS;
    this.#maxSnapshotColumns =
      options.maxSnapshotColumns ?? DEFAULT_MAX_SNAPSHOT_COLUMNS;
  }

  supports(toolName: string): toolName is ExcelToolName {
    return isExcelToolName(toolName);
  }

  async execute(
    toolName: ExcelToolName,
    params: Record<string, unknown>,
  ): Promise<unknown> {
    switch (toolName) {
      case 'office_excel_snapshot':
        return this.snapshot(params);
      case 'office_excel_get_range':
        return this.getRange(params);
      case 'office_excel_set_range_values':
        return this.setRangeValues(params);
      case 'office_excel_add_worksheet':
        return this.addWorksheet(params);
      case 'office_excel_delete_worksheet':
        return this.deleteWorksheet(params);
      case 'office_excel_autofit_range':
        return this.autofitRange(params);
      case 'office_excel_add_table':
        return this.addTable(params);
    }
  }

  private async snapshot(params: Record<string, unknown>) {
    const maxRows =
      readOptionalPositiveInteger(params.maxRows) ?? this.#maxSnapshotRows;
    const maxColumns =
      readOptionalPositiveInteger(params.maxColumns) ?? this.#maxSnapshotColumns;

    return Excel.run(async (context) => {
      const worksheets = context.workbook.worksheets;
      const activeWorksheet = worksheets.getActiveWorksheet();
      const usedRange = activeWorksheet.getUsedRangeOrNullObject(true);
      worksheets.load('items/name');
      activeWorksheet.load('name');
      usedRange.load('address,rowCount,columnCount,values,text,isNullObject');
      await context.sync();

      return {
        host: readOfficeReadyInfo(),
        requirements: readRequirementSupport(),
        worksheets: worksheets.items.map((worksheet) => worksheet.name),
        activeWorksheet: activeWorksheet.name,
        usedRange: usedRange.isNullObject
          ? null
          : {
              address: usedRange.address,
              rowCount: usedRange.rowCount,
              columnCount: usedRange.columnCount,
              values: clipValues(usedRange.values, maxRows, maxColumns),
              text: clipValues(usedRange.text, maxRows, maxColumns),
              truncated:
                usedRange.rowCount > maxRows || usedRange.columnCount > maxColumns,
            },
      };
    });
  }

  private async getRange(params: Record<string, unknown>) {
    const address = readString(params.address, 'address');
    const worksheetName = readOptionalString(params.worksheetName);

    return Excel.run(async (context) => {
      const worksheet = getWorksheet(context, worksheetName);
      const range = worksheet.getRange(address);
      range.load('address,rowCount,columnCount,values,text');
      await context.sync();
      return {
        worksheetName,
        address: range.address,
        rowCount: range.rowCount,
        columnCount: range.columnCount,
        values: range.values,
        text: range.text,
      };
    });
  }

  private async setRangeValues(params: Record<string, unknown>) {
    const address = readString(params.address, 'address');
    const worksheetName = readOptionalString(params.worksheetName);
    const values = readRangeValues(params.values);

    return Excel.run(async (context) => {
      const worksheet = getWorksheet(context, worksheetName);
      const range = worksheet.getRange(address);
      range.values = values;
      await context.sync();
      return {
        updated: true,
        worksheetName,
        address,
        rowCount: values.length,
        columnCount: values[0]?.length ?? 0,
      };
    });
  }

  private async addWorksheet(params: Record<string, unknown>) {
    const name = readOptionalString(params.name);

    return Excel.run(async (context) => {
      const worksheet = context.workbook.worksheets.add(name);
      worksheet.load('name');
      await context.sync();
      return {
        added: true,
        worksheetName: worksheet.name,
      };
    });
  }

  private async deleteWorksheet(params: Record<string, unknown>) {
    requireConfirm(params.confirm, 'Deleting a worksheet');
    const name = readString(params.name, 'name');

    return Excel.run(async (context) => {
      context.workbook.worksheets.getItem(name).delete();
      await context.sync();
      return {
        deleted: true,
        worksheetName: name,
      };
    });
  }

  private async autofitRange(params: Record<string, unknown>) {
    const worksheetName = readOptionalString(params.worksheetName);
    const address = readOptionalString(params.address);

    return Excel.run(async (context) => {
      const worksheet = getWorksheet(context, worksheetName);
      const range = getRange(worksheet, address);
      range.format.autofitColumns();
      range.format.autofitRows();
      await context.sync();
      return {
        autofit: true,
        worksheetName,
        address,
      };
    });
  }

  private async addTable(params: Record<string, unknown>) {
    const worksheetName = readOptionalString(params.worksheetName);
    const address = readString(params.address, 'address');
    const hasHeaders = readBoolean(params.hasHeaders, true);
    const name = readOptionalString(params.name);

    return Excel.run(async (context) => {
      const worksheet = getWorksheet(context, worksheetName);
      const table = worksheet.tables.add(address, hasHeaders);
      if (name) {
        table.name = name;
      }
      await context.sync();
      return {
        added: true,
        worksheetName,
        address,
        hasHeaders,
        tableName: name,
      };
    });
  }
}

export function createExcelOfficeAdapter(
  options: ExcelAdapterOptions = {},
): OfficeHostAdapter<ExcelToolName> {
  return new ExcelOfficeAdapter(options);
}

export const excelInternalTestUtils = {
  readRangeValues,
};
