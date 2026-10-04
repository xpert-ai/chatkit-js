import * as React from 'react';
import type { FileChangeReport } from '@xpert-ai/chatkit-types';
import { useChatkitTranslation } from '../../i18n/useChatkitTranslation';
import { diffRows, type DiffLine } from './file-change-diff';

const CodeEditor = React.lazy(() => import('../code-editor/CodeEditor'));
export function FileChangeDiff({
  report,
  sideBySide,
  wrap,
  whitespace,
}: {
  report: FileChangeReport;
  sideBySide: boolean;
  wrap: boolean;
  whitespace: boolean;
}) {
  const { t } = useChatkitTranslation();
  const rows = React.useMemo(
    () => diffRows(report.before?.text ?? '', report.after?.text ?? ''),
    [report],
  );
  const text = (value: string) =>
    whitespace ? value.replace(/ /g, '·').replace(/\t/g, '→   ') : value;
  const cell = (
    line: DiffLine | undefined,
    kind: 'equal' | 'added' | 'removed',
    key: string,
  ) => (
    <div
      key={key}
      data-diff-kind={line ? kind : 'empty'}
      className={`flex min-w-0 ${kind === 'added' && line ? 'bg-green-500/10' : kind === 'removed' && line ? 'bg-red-500/10' : ''}`}
    >
      <span
        aria-hidden="true"
        className="w-12 shrink-0 select-none border-r px-2 text-right text-muted-foreground"
      >
        {line?.number}
      </span>
      <span aria-hidden="true" className="w-5 shrink-0 select-none text-center">
        {line ? (kind === 'added' ? '+' : kind === 'removed' ? '−' : ' ') : ''}
      </span>
      <code
        className={`min-w-0 flex-1 pr-3 ${wrap ? 'whitespace-pre-wrap break-all' : 'whitespace-pre'}`}
      >
        {line ? text(line.text) || ' ' : ' '}
      </code>
    </div>
  );
  if (!rows)
    return (
      <div>
        <p className="px-3 py-2 text-xs text-muted-foreground">
          {t('workbench.review.largeDiff')}
        </p>
        <div className="grid h-96 grid-cols-2 divide-x">
          <React.Suspense fallback={t('workbench.loading')}>
            <CodeEditor
              path={report.workspacePath}
              value={report.before?.text ?? ''}
              readOnly
            />
            <CodeEditor
              path={report.workspacePath}
              value={report.after?.text ?? ''}
              readOnly
            />
          </React.Suspense>
        </div>
      </div>
    );
  return (
    <div
      className="max-h-[36rem] overflow-auto font-mono text-xs leading-6"
      tabIndex={0}
      aria-label={t('workbench.review.diff')}
    >
      <div className={wrap ? 'min-w-0' : 'min-w-max'}>
        {sideBySide && (
          <div className="grid grid-cols-2 divide-x border-b bg-muted px-2 text-muted-foreground">
            <span>{t('workbench.review.before')}</span>
            <span>{t('workbench.review.after')}</span>
          </div>
        )}
        {rows.map((row, index) =>
          sideBySide ? (
            <div key={index} className="grid grid-cols-2 divide-x">
              {cell(row.before, row.equal ? 'equal' : 'removed', 'before')}
              {cell(row.after, row.equal ? 'equal' : 'added', 'after')}
            </div>
          ) : (
            <React.Fragment key={index}>
              {row.equal ? (
                cell(row.after, 'equal', 'equal')
              ) : (
                <>
                  {row.before && cell(row.before, 'removed', 'before')}
                  {row.after && cell(row.after, 'added', 'after')}
                </>
              )}
            </React.Fragment>
          ),
        )}
        {!rows.length && (
          <p className="p-3 text-muted-foreground">
            {t('workbench.review.unchanged')}
          </p>
        )}
      </div>
    </div>
  );
}
