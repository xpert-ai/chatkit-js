import type { LocalizedText } from './localized-text.js';

export type HITLReviewSection =
  | { type: 'text'; label: LocalizedText; text: LocalizedText }
  | { type: 'code'; label: LocalizedText; code: string }
  | { type: 'table'; label: LocalizedText; columns: string[]; rows: Array<Array<string | number | boolean | null>> };

/** Optional presentation metadata. Never changes action arguments or approval decisions. */
export type HITLReviewDisplay = {
  title: LocalizedText;
  summary: LocalizedText;
  sections: HITLReviewSection[];
};

function isLocalizedText(value: unknown): value is LocalizedText {
  return typeof value === 'string' || (!!value && typeof value === 'object' && !Array.isArray(value) &&
    Object.values(value).every((item) => typeof item === 'string' || item === undefined));
}

export function isHITLReviewDisplay(value: unknown): value is HITLReviewDisplay {
  if (!value || typeof value !== 'object' || !('title' in value) || !isLocalizedText(value.title) ||
      !('summary' in value) || !isLocalizedText(value.summary) || !('sections' in value) || !Array.isArray(value.sections)) return false;
  return value.sections.every((section: unknown) => {
    if (!section || typeof section !== 'object' || !('label' in section) || !isLocalizedText(section.label) || !('type' in section)) return false;
    switch (section.type) {
      case 'text': return 'text' in section && isLocalizedText(section.text);
      case 'code': return 'code' in section && typeof section.code === 'string';
      case 'table': return 'columns' in section && Array.isArray(section.columns) && section.columns.every((column: unknown) => typeof column === 'string') &&
        'rows' in section && Array.isArray(section.rows) && section.rows.every((row: unknown) => Array.isArray(row) && row.every((cell: unknown) => cell === null || typeof cell === 'string' || typeof cell === 'boolean' || (typeof cell === 'number' && Number.isFinite(cell))));
      default: return false;
    }
  });
}
