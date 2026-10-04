import * as React from 'react';
import { ChevronDown, ChevronRight, Loader2, RotateCw } from 'lucide-react';
import { countFileChangeLines } from '@xpert-ai/chatkit-types';
import { useChatkitTranslation } from '../../i18n/useChatkitTranslation';
import type {
  FileChangeReviewOptions,
  FileReviewEntry,
} from './file-change-review';
import { FileChangeDiff } from './FileChangeDiff';

const buttonClass =
  'inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-xs hover:bg-muted aria-pressed:bg-muted focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50';
export function FileChangeReview({
  options,
}: {
  options: FileChangeReviewOptions;
}) {
  const { t } = useChatkitTranslation();
  const [scope, setScope] = React.useState<'selected' | 'conversation'>(
    'selected',
  );
  const [entries, setEntries] = React.useState<FileReviewEntry[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [failed, setFailed] = React.useState(false);
  const [attempt, retry] = React.useReducer((value) => value + 1, 0);
  const [sideBySide, setSideBySide] = React.useState(true);
  const [wrap, setWrap] = React.useState(false);
  const [whitespace, setWhitespace] = React.useState(false);
  const [metadata, setMetadata] = React.useState(false);
  const [collapsed, setCollapsed] = React.useState<Set<string>>(new Set());
  const sectionRefs = React.useRef(new Map<string, HTMLElement>());
  React.useEffect(() => {
    setScope('selected');
  }, [options]);
  React.useEffect(() => {
    const controller = new AbortController();
    setEntries([]);
    setLoading(true);
    setFailed(false);
    setCollapsed(new Set());
    options
      .load(scope, controller.signal)
      .then((value) => {
        if (!controller.signal.aborted) setEntries(value);
      })
      .catch(() => {
        if (!controller.signal.aborted) setFailed(true);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [options, scope, attempt]);
  const counts = React.useMemo(
    () =>
      entries.map((entry) =>
        entry.report
          ? countFileChangeLines(entry.report)
          : { status: 'unavailable' as const },
      ),
    [entries],
  );
  const total = counts.reduce(
    (sum, count) =>
      count.status === 'ready'
        ? {
            added: sum.added + count.added,
            removed: sum.removed + count.removed,
            known: sum.known + 1,
          }
        : sum,
    { added: 0, removed: 0, known: 0 },
  );
  const stats = (added: number, removed: number) => (
    <span className="chatkit-change-line-stats inline-flex gap-2 tabular-nums">
      <span data-lines-added={added}>+{added}</span>
      <span data-lines-removed={removed}>−{removed}</span>
    </span>
  );
  const toggle = (key: string) =>
    setCollapsed((previous) => {
      const next = new Set(previous);
      if (!next.delete(key)) next.add(key);
      return next;
    });
  return (
    <section
      className="flex h-full min-h-0 min-w-0 flex-col"
      aria-label={t('fileActivity.review')}
    >
      <header className="flex shrink-0 flex-wrap items-center gap-1 border-y px-2 py-2">
        {(['selected', 'conversation'] as const).map((value) => (
          <button
            key={value}
            type="button"
            className={`${buttonClass} ${scope === value ? 'bg-muted font-medium' : ''}`}
            aria-pressed={scope === value}
            onClick={() => setScope(value)}
          >
            {t(`workbench.review.${value}`)}
          </button>
        ))}
        <span className="flex-1" />
        {total.known > 0 && (
          <span className="px-2 text-xs">
            {stats(total.added, total.removed)}
          </span>
        )}
        <button
          type="button"
          className={buttonClass}
          onClick={retry}
          disabled={loading}
          aria-label={t('workbench.files.refresh')}
        >
          <RotateCw className="size-4" />
        </button>
        <div className="flex w-full flex-wrap gap-1">
          <button
            type="button"
            className={buttonClass}
            aria-pressed={sideBySide}
            onClick={() => setSideBySide((value) => !value)}
          >
            {t(
              sideBySide
                ? 'workbench.review.sideBySide'
                : 'workbench.review.inline',
            )}
          </button>
          <button
            type="button"
            className={buttonClass}
            aria-pressed={wrap}
            onClick={() => setWrap((value) => !value)}
          >
            {t('workbench.review.wrap')}
          </button>
          <button
            type="button"
            className={buttonClass}
            aria-pressed={whitespace}
            onClick={() => setWhitespace((value) => !value)}
          >
            {t('workbench.review.whitespace')}
          </button>
          <button
            type="button"
            className={buttonClass}
            aria-pressed={metadata}
            onClick={() => setMetadata((value) => !value)}
          >
            {t('workbench.review.metadata')}
          </button>
          <button
            type="button"
            className={buttonClass}
            disabled={!entries.length}
            onClick={() =>
              setCollapsed(
                collapsed.size === entries.length
                  ? new Set()
                  : new Set(entries.map((entry) => entry.key)),
              )
            }
          >
            {t(
              collapsed.size === entries.length && entries.length
                ? 'workbench.review.expandAll'
                : 'workbench.review.collapseAll',
            )}
          </button>
        </div>
      </header>
      {loading ? (
        <div role="status" className="flex items-center gap-2 p-4 text-sm">
          <Loader2 className="size-4 animate-spin" />
          {t('workbench.loading')}
        </div>
      ) : failed ? (
        <div role="alert" className="p-4 text-sm">
          {t('workbench.review.failed')}{' '}
          <button type="button" className={buttonClass} onClick={retry}>
            {t('common.retry')}
          </button>
        </div>
      ) : !entries.length ? (
        <p className="p-4 text-sm text-muted-foreground">
          {t('workbench.review.empty')}
        </p>
      ) : (
        <div className="min-h-0 flex-1 overflow-auto p-3">
          <nav
            aria-label={t('workbench.review.files')}
            className="mb-3 flex flex-col gap-1 border-b pb-3"
          >
            {entries.map((entry) => (
              <button
                type="button"
                key={entry.key}
                className={`${buttonClass} text-left`}
                onClick={() => {
                  setCollapsed((previous) => {
                    const next = new Set(previous);
                    next.delete(entry.key);
                    return next;
                  });
                  sectionRefs.current
                    .get(entry.key)
                    ?.scrollIntoView({ block: 'start' });
                }}
              >
                {entry.path || t('workbench.review.selected')}
              </button>
            ))}
          </nav>
          {entries.map((entry, index) => {
            const report = entry.report,
              count = counts[index];
            const hasText =
              report &&
              (!report.before || report.before.text !== undefined) &&
              (!report.after || report.after.text !== undefined);
            return (
              <article
                key={entry.key}
                className="mb-3 overflow-hidden rounded-lg border"
                ref={(element) => {
                  if (element) sectionRefs.current.set(entry.key, element);
                  else sectionRefs.current.delete(entry.key);
                }}
              >
                <button
                  type="button"
                  className="flex w-full items-center gap-2 bg-muted/50 px-3 py-2 text-left text-sm"
                  aria-expanded={!collapsed.has(entry.key)}
                  onClick={() => toggle(entry.key)}
                >
                  {collapsed.has(entry.key) ? (
                    <ChevronRight className="size-4 shrink-0" />
                  ) : (
                    <ChevronDown className="size-4 shrink-0" />
                  )}
                  <span className="min-w-0 flex-1 break-all font-medium">
                    {entry.path || t('workbench.review.selected')}
                  </span>
                  {count?.status === 'ready' &&
                    stats(count.added, count.removed)}
                </button>
                {!collapsed.has(entry.key) && (
                  <>
                    {metadata && report && (
                      <dl className="space-y-1 border-y p-3 font-mono text-xs">
                        {(['before', 'after'] as const).map((side) => (
                          <div key={side}>
                            <dt className="font-medium">
                              {t(`workbench.review.${side}`)}
                            </dt>
                            <dd className="break-all text-muted-foreground">
                              {report[side]
                                ? `${report[side].size} B · SHA-256 ${report[side].sha256}`
                                : '—'}
                            </dd>
                          </div>
                        ))}
                      </dl>
                    )}
                    {!report ? (
                      <p
                        role="status"
                        className="p-3 text-sm text-muted-foreground"
                      >
                        {t('workbench.review.unavailable')}
                      </p>
                    ) : !hasText ? (
                      <p className="p-3 text-sm text-muted-foreground">
                        {t('workbench.review.binary')}
                      </p>
                    ) : (
                      <FileChangeDiff
                        report={report}
                        sideBySide={sideBySide}
                        wrap={wrap}
                        whitespace={whitespace}
                      />
                    )}
                  </>
                )}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
