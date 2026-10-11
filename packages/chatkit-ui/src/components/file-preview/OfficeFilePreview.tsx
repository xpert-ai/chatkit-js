import * as React from 'react';
import type { FileKind } from '../../lib/files/file-types';
import { useChatkitTranslation } from '../../i18n/useChatkitTranslation';
import { Button } from '../ui/button';
import {
  parsePptx,
  type PptxDeck,
} from '../../workbench/native/office/presentation/pptx-file.utils';
import { PptxCanvas } from '../../workbench/native/office/presentation/PptxCanvas';

const DocxEditor = React.lazy(
  () => import('../../workbench/native/office/document/DocxEditor'),
);
type OfficeData =
  | { type: 'slides'; deck: PptxDeck }
  | { type: 'sheets'; sheets: { name: string; rows: string[][] }[] };

/** A saved version has no persistence callbacks; edits open the authorized workspace separately. */
export default function OfficeFilePreview({
  blob,
  name,
  kind,
}: {
  blob: Blob;
  name: string;
  kind: FileKind;
}) {
  const { t } = useChatkitTranslation();
  const [data, setData] = React.useState<OfficeData | null>(null);
  const [error, setError] = React.useState(false);
  const [index, setIndex] = React.useState(0);
  React.useEffect(() => {
    let active = true;
    setData(null);
    setError(false);
    setIndex(0);
    if (kind === 'docx') return;
    void (async () => {
      const buffer = await blob.arrayBuffer();
      let result: OfficeData;
      if (kind === 'pptx') {
        result = { type: 'slides', deck: await parsePptx(buffer) };
      } else {
        const XLSX = await import('xlsx');
        const workbook = XLSX.read(new Uint8Array(buffer), {
          type: 'array',
          sheetRows: 201,
        });
        result = {
          type: 'sheets',
          sheets: workbook.SheetNames.map((name) => ({
            name,
            rows: XLSX.utils
              .sheet_to_json<string[]>(workbook.Sheets[name], {
                header: 1,
                raw: false,
                defval: '',
              })
              .slice(0, 200),
          })),
        };
      }
      if (active) setData(result);
    })().catch(() => {
      if (active) setError(true);
    });
    return () => {
      active = false;
    };
  }, [blob, kind]);
  if (kind === 'docx')
    return (
      <DocxEditor blob={blob} name={name} readOnly onDirty={() => undefined} />
    );
  if (error)
    return (
      <p role="alert" className="p-4 text-destructive">
        {t('workbench.files.failed')}
      </p>
    );
  if (!data)
    return (
      <p role="status" className="p-4">
        {t('workbench.files.loading')}
      </p>
    );
  if (data.type === 'slides')
    return (
      <div className="flex h-full min-h-0 flex-col">
        <div className="file-preview-toolbar flex items-center justify-center gap-3 border-b p-2">
          <Button
            size="sm"
            variant="ghost"
            disabled={index === 0}
            onClick={() => setIndex(index - 1)}
          >
            {t('workbench.office.previous')}
          </Button>
          <span>
            {data.deck.slides.length ? index + 1 : 0} /{' '}
            {data.deck.slides.length}
          </span>
          <Button
            size="sm"
            variant="ghost"
            disabled={index >= data.deck.slides.length - 1}
            onClick={() => setIndex(index + 1)}
          >
            {t('workbench.office.next')}
          </Button>
        </div>
        <div className="min-h-0 flex-1 overflow-auto p-4">
          {data.deck.slides[index] && (
            <PptxCanvas deck={data.deck} slide={data.deck.slides[index]} />
          )}
        </div>
      </div>
    );
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div
        role="tablist"
        aria-label={name}
        className="file-preview-toolbar flex shrink-0 gap-1 overflow-auto border-b p-2"
      >
        {data.sheets.map((sheet, i) => (
          <Button
            key={sheet.name}
            role="tab"
            aria-selected={index === i}
            size="sm"
            variant={index === i ? 'secondary' : 'ghost'}
            onClick={() => setIndex(i)}
          >
            {sheet.name}
          </Button>
        ))}
      </div>
      <div className="min-h-0 flex-1 overflow-auto p-3">
        <p className="mb-2 text-xs text-muted-foreground">
          {t('workbench.files.sheetPreviewLimit', { count: 200 })}
        </p>
        <table
          className="w-full border-collapse text-sm"
          aria-label={data.sheets[index]?.name}
        >
          <tbody>
            {data.sheets[index]?.rows.map((row, i) => (
              <tr key={i}>
                <th
                  scope="row"
                  className="border bg-muted px-2 py-1 text-muted-foreground"
                >
                  {i + 1}
                </th>
                {row.map((cell, j) => (
                  <td key={j} className="border px-2 py-1 whitespace-pre-wrap">
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
