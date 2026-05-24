export const OFFICE_POWERPOINT_TOOL_NAMES = [
  'office_powerpoint_snapshot',
  'office_powerpoint_select_slide',
  'office_powerpoint_add_slide',
  'office_powerpoint_delete_slide',
  'office_powerpoint_add_text_box',
  'office_powerpoint_add_shape',
  'office_powerpoint_update_shape',
  'office_powerpoint_delete_shape',
  'office_powerpoint_insert_image',
] as const;

export type PowerPointToolName = (typeof OFFICE_POWERPOINT_TOOL_NAMES)[number];

const OFFICE_POWERPOINT_TOOL_NAME_SET = new Set<string>(
  OFFICE_POWERPOINT_TOOL_NAMES,
);

export function isPowerPointToolName(value: string): value is PowerPointToolName {
  return OFFICE_POWERPOINT_TOOL_NAME_SET.has(value);
}
