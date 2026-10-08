import * as React from 'react';
import { FileDiff } from '@pierre/diffs/react';
import { createReviewDiff } from './review-diff-model';
import { importSelectors } from './review-imports';
import type { FileChangeReport } from '@xpert-ai/chatkit-types';
import { useTheme } from '../../providers/Theme';
import { useChatkitTranslation } from '../../i18n/useChatkitTranslation';
import type { ReviewSettings } from './review-presentation';

const CodeEditor = React.lazy(
  () => import('../../components/code-editor/CodeEditor'),
);

export function FileChangeDiff({
  report,
  sideBySide,
  settings,
}: {
  report: FileChangeReport;
  sideBySide: boolean;
  settings: ReviewSettings;
}) {
  const { t } = useChatkitTranslation();
  const { isDarkMode } = useTheme();
  const diff = React.useMemo(
    () => createReviewDiff(report, settings.hideWhitespace),
    [report, settings.hideWhitespace],
  );
  const options = React.useMemo(() => {
    const split = sideBySide && !!report.before && !!report.after;
    const selectors =
      settings.hideImports && /\.[cm]?[jt]sx?$/i.test(report.workspacePath)
        ? [
            ...importSelectors(report.before?.text ?? '', 'deletions', split),
            ...importSelectors(report.after?.text ?? '', 'additions', split),
          ]
        : [];
    return {
      theme: { light: 'pierre-light' as const, dark: 'pierre-dark' as const },
      themeType: isDarkMode ? ('dark' as const) : ('light' as const),
      diffStyle: sideBySide ? ('split' as const) : ('unified' as const),
      overflow: settings.wrap ? ('wrap' as const) : ('scroll' as const),
      diffIndicators: 'bars' as const,
      disableFileHeader: true,
      expandUnchanged: settings.fullFile,
      lineDiffType: settings.wordDiff ? ('word' as const) : ('none' as const),
      hunkSeparators: 'line-info' as const,
      enableLineSelection: true,
      unsafeCSS: `:host { --diffs-font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; --diffs-font-size: 14px; --diffs-line-height: 24px; } [data-diffs] { border-radius: 0; }${selectors.length ? `${selectors.join(',')} { font-size: 0; } ${selectors.map((value) => value + ' *').join(',')} { font-size: 0 !important; } ${selectors.map((value) => value + '::after').join(',')} { content: '…'; font-size: 13px; opacity: .5; }` : ''}`,
    };
  }, [isDarkMode, sideBySide, settings, report]);
  if (!diff)
    return (
      <div>
        <p className="p-3 text-sm text-muted-foreground">
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
  if (!diff.hunks.length && !settings.fullFile)
    return (
      <p className="p-4 text-sm text-muted-foreground">
        {t('workbench.review.unchanged')}
      </p>
    );
  return (
    <div
      className="review-diff"
      aria-label={t('workbench.review.diff')}
      data-layout={options.diffStyle}
    >
      <FileDiff fileDiff={diff} options={options} />
    </div>
  );
}
