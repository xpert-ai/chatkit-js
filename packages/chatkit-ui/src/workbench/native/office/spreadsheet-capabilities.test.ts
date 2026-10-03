import { expect, it } from 'vitest';
import { unsupportedXlsxCommand, xlsxMenu } from './spreadsheet-capabilities';
it('blocks unsupported shortcuts as well as their menu entries without blocking content, navigation or calculation', () => {
  for (const id of [
    'sheet.command.insert-sheet',
    'sheet.command.set-range-bold',
    'sheet.command.set-worksheet-order',
    'sheet.command.numfmt.set.numfmt',
    'sheet.command.paste-format',
  ]) {
    expect(unsupportedXlsxCommand(id)).toBe(true);
    expect(xlsxMenu[id].hidden).toBe(true);
  }
  for (const id of [
    'sheet.command.set-range-values',
    'sheet.command.set-worksheet-activate',
    'sheet.command.paste-value',
    'sheet.command.move-selection',
    'sheet.command.set-zoom-ratio',
    'formula.mutation.set-formula-calculation-result',
  ])
    expect(unsupportedXlsxCommand(id)).toBe(false);
});
