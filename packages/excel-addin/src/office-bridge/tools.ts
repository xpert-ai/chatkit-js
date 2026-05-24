export const OFFICE_EXCEL_TOOL_NAMES = [
  'office_excel_snapshot',
  'office_excel_get_range',
  'office_excel_set_range_values',
  'office_excel_add_worksheet',
  'office_excel_delete_worksheet',
  'office_excel_autofit_range',
  'office_excel_add_table',
] as const;

export type ExcelToolName = (typeof OFFICE_EXCEL_TOOL_NAMES)[number];

const OFFICE_EXCEL_TOOL_NAME_SET = new Set<string>(OFFICE_EXCEL_TOOL_NAMES);

export function isExcelToolName(value: string): value is ExcelToolName {
  return OFFICE_EXCEL_TOOL_NAME_SET.has(value);
}
