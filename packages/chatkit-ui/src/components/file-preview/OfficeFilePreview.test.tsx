import * as React from 'react';
import { Blob as NodeBlob } from 'node:buffer';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import * as XLSX from 'xlsx';
import OfficeFilePreview from './OfficeFilePreview';
import { createPresentation } from '../../workbench/native/office/presentation/pptx-fixture.test-support';
import { ThemeProvider } from '../../providers/Theme';

const docxProps = vi.fn();
vi.mock('../../workbench/native/office/document/DocxEditor', () => ({
  default: (props: { readOnly: boolean }) => {
    docxProps(props);
    return <div>Word preview</div>;
  },
}));
const show = (content: React.ReactElement) =>
  render(<ThemeProvider>{content}</ThemeProvider>);
beforeEach(() => {
  vi.stubGlobal('Blob', NodeBlob);
  docxProps.mockClear();
});
describe('immutable Office previews', () => {
  it('uses the document viewer in read-only mode without a save callback', async () => {
    const blob = new Blob(['docx']);
    show(<OfficeFilePreview blob={blob} name="report.docx" kind="docx" />);
    await screen.findByText('Word preview');
    expect(docxProps).toHaveBeenLastCalledWith(
      expect.objectContaining({ blob, name: 'report.docx', readOnly: true }),
    );
    expect(docxProps.mock.lastCall?.[0].onSave).toBeUndefined();
  });
  it('reads real XLSX bytes and switches sheets without editable cells', async () => {
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      book,
      XLSX.utils.aoa_to_sheet([
        ['项目', '数量'],
        ['零件', 5],
      ]),
      '采购',
    );
    XLSX.utils.book_append_sheet(
      book,
      XLSX.utils.aoa_to_sheet([['归档', '已核对']]),
      '验收',
    );
    const bytes = XLSX.write(book, { type: 'array', bookType: 'xlsx' });
    show(
      <OfficeFilePreview
        blob={new Blob([new Uint8Array(bytes)])}
        name="报价.xlsx"
        kind="spreadsheet"
      />,
    );
    expect(await screen.findByRole('cell', { name: '零件' })).toBeVisible();
    fireEvent.click(screen.getByRole('tab', { name: '验收' }));
    expect(screen.getByRole('cell', { name: '已核对' })).toBeVisible();
    expect(screen.queryByRole('textbox')).toBeNull();
  });
  it('renders saved presentation bytes on the existing read-only slide canvas', async () => {
    const bytes = await createPresentation();
    show(
      <OfficeFilePreview
        blob={new Blob([new Uint8Array(bytes)])}
        name="report.pptx"
        kind="pptx"
      />,
    );
    expect(await screen.findByText('Visible title')).toBeVisible();
    expect(screen.queryByRole('textbox')).toBeNull();
  });
  it('shows corrupt Office input as a preview failure', async () => {
    show(
      <OfficeFilePreview
        blob={new Blob(['broken zip'])}
        name="bad.pptx"
        kind="pptx"
      />,
    );
    expect(await screen.findByRole('alert')).toBeVisible();
  });
});
