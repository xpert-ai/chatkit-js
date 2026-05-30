export const OFFICE_WORD_TOOL_NAMES = [
  'office_word_snapshot',
  'office_word_insert_text',
  'office_word_replace_selection',
  'office_word_insert_heading',
  'office_word_insert_table',
  'office_word_search_text',
] as const;

export type WordToolName = (typeof OFFICE_WORD_TOOL_NAMES)[number];

const OFFICE_WORD_TOOL_NAME_SET = new Set<string>(OFFICE_WORD_TOOL_NAMES);

export function isWordToolName(value: string): value is WordToolName {
  return OFFICE_WORD_TOOL_NAME_SET.has(value);
}
