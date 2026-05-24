import { afterEach, describe, expect, it, vi } from 'vitest';
import { ExcelOfficeAdapter, excelInternalTestUtils } from './excel';

function stubOffice() {
  vi.stubGlobal('Office', {
    context: {
      host: 'Excel',
      platform: 'PC',
      requirements: {
        isSetSupported: vi.fn(() => true),
      },
    },
  });
}

function stubExcelRun(context: Excel.RequestContext) {
  const run = vi.fn(async (callback: (ctx: Excel.RequestContext) => Promise<unknown>) =>
    callback(context),
  );
  vi.stubGlobal('Excel', {
    run,
  });
  return run;
}

describe('ExcelOfficeAdapter', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('normalizes jagged range values', () => {
    expect(
      excelInternalTestUtils.readRangeValues([
        ['Name', 'Score'],
        ['Ada'],
      ]),
    ).toEqual([
      ['Name', 'Score'],
      ['Ada', null],
    ]);
  });

  it('sets range values on the requested worksheet', async () => {
    stubOffice();
    const range = {
      values: [] as unknown[][],
    };
    const getRange = vi.fn(() => range);
    const getItem = vi.fn(() => ({
      getRange,
    }));
    const context = {
      workbook: {
        worksheets: {
          getItem,
        },
      },
      sync: vi.fn(),
    } as unknown as Excel.RequestContext;
    stubExcelRun(context);

    const adapter = new ExcelOfficeAdapter();
    const result = await adapter.execute('office_excel_set_range_values', {
      worksheetName: 'Data',
      address: 'A1:B2',
      values: [
        ['Name', 'Score'],
        ['Ada', 42],
      ],
    });

    expect(getItem).toHaveBeenCalledWith('Data');
    expect(getRange).toHaveBeenCalledWith('A1:B2');
    expect(range.values).toEqual([
      ['Name', 'Score'],
      ['Ada', 42],
    ]);
    expect(result).toEqual({
      updated: true,
      worksheetName: 'Data',
      address: 'A1:B2',
      rowCount: 2,
      columnCount: 2,
    });
  });

  it('requires explicit confirmation before deleting a worksheet', async () => {
    stubOffice();
    const adapter = new ExcelOfficeAdapter();

    await expect(
      adapter.execute('office_excel_delete_worksheet', {
        name: 'Old Data',
      }),
    ).rejects.toThrow('confirm: true');
  });

  it('returns a bounded workbook snapshot', async () => {
    stubOffice();
    const usedRange = {
      load: vi.fn(),
      isNullObject: false,
      address: 'Sheet1!A1:C2',
      rowCount: 2,
      columnCount: 3,
      values: [
        [1, 2, 3],
        [4, 5, 6],
      ],
      text: [
        ['1', '2', '3'],
        ['4', '5', '6'],
      ],
    };
    const activeWorksheet = {
      name: 'Sheet1',
      load: vi.fn(),
      getUsedRangeOrNullObject: vi.fn(() => usedRange),
    };
    const context = {
      workbook: {
        worksheets: {
          items: [{ name: 'Sheet1' }, { name: 'Archive' }],
          load: vi.fn(),
          getActiveWorksheet: vi.fn(() => activeWorksheet),
        },
      },
      sync: vi.fn(),
    } as unknown as Excel.RequestContext;
    stubExcelRun(context);

    const adapter = new ExcelOfficeAdapter({
      maxSnapshotRows: 1,
      maxSnapshotColumns: 2,
    });
    const result = await adapter.execute('office_excel_snapshot', {});

    expect(usedRange.load).toHaveBeenCalledWith(
      'address,rowCount,columnCount,values,text,isNullObject',
    );
    expect(result).toEqual({
      host: {
        host: 'Excel',
        platform: 'PC',
      },
      requirements: {
        excelApi: {
          '1.1': true,
          '1.4': true,
          '1.7': true,
        },
      },
      worksheets: ['Sheet1', 'Archive'],
      activeWorksheet: 'Sheet1',
      usedRange: {
        address: 'Sheet1!A1:C2',
        rowCount: 2,
        columnCount: 3,
        values: [[1, 2]],
        text: [['1', '2']],
        truncated: true,
      },
    });
  });
});
