import * as React from 'react';
import { Virtualizer } from '@pierre/diffs/react';
import { Loader2 } from 'lucide-react';
import { countFileChangeLines } from '@xpert-ai/chatkit-types';
import { useChatkitTranslation } from '../../i18n/useChatkitTranslation';
import type {
  FileChangeReviewOptions,
  FileReviewEntry,
} from './file-change-review';
import { ReviewControls } from './ReviewControls';
import { ReviewFileTree } from './ReviewNavigation';
import { ReviewFile } from './ReviewFile';
import {
  defaultReviewSettings,
  reviewApplyCommand,
} from './review-presentation';
import './file-review.css';

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
  const [settings, setSettings] = React.useState(defaultReviewSettings);
  const [collapsed, setCollapsed] = React.useState<Set<string>>(new Set());
  const [showTree, setShowTree] = React.useState<boolean | null>(null);
  const [active, setActive] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState('');
  const [width, setWidth] = React.useState(0);
  const sectionRefs = React.useRef(new Map<string, HTMLElement>());
  const rootRef = React.useRef<HTMLElement>(null);
  React.useEffect(() => {
    setScope('selected');
  }, [options]);
  React.useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const update = () => setWidth(root.getBoundingClientRect().width);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(root);
    return () => observer.disconnect();
  }, []);
  React.useEffect(() => {
    const controller = new AbortController();
    setEntries([]);
    setLoading(true);
    setFailed(false);
    setCollapsed(new Set());
    setNotice('');
    options
      .load(scope, controller.signal)
      .then((value) => {
        if (!controller.signal.aborted) {
          setEntries(value);
          setActive(value[0]?.key ?? null);
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) setFailed(true);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [options, scope, attempt]);
  React.useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(''), 3500);
    return () => window.clearTimeout(timer);
  }, [notice]);
  const total = React.useMemo(
    () =>
      entries.reduce(
        (sum, entry) => {
          const count = entry.report
            ? countFileChangeLines(entry.report)
            : null;
          return count?.status === 'ready'
            ? {
                added: sum.added + count.added,
                removed: sum.removed + count.removed,
                known: sum.known + 1,
              }
            : sum;
        },
        { added: 0, removed: 0, known: 0 },
      ),
    [entries],
  );
  const patch = React.useMemo(() => reviewApplyCommand(entries), [entries]);
  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setNotice(t('workbench.review.copied'));
    } catch {
      setNotice(t('workbench.review.copyFailed'));
    }
  };
  const toggle = (key: string) =>
    setCollapsed((old) => {
      const next = new Set(old);
      if (!next.delete(key)) next.add(key);
      return next;
    });
  const jump = (key: string) => {
    setActive(key);
    setCollapsed((old) => {
      const next = new Set(old);
      next.delete(key);
      return next;
    });
    requestAnimationFrame(() =>
      sectionRefs.current.get(key)?.scrollIntoView({ block: 'start' }),
    );
  };
  const allCollapsed =
    entries.length > 0 && entries.every((entry) => collapsed.has(entry.key));
  const treeOpen = showTree ?? width >= 600;
  const treeVisible = treeOpen && width >= 600;
  const sideBySide =
    settings.layout === 'split' ||
    (settings.layout === 'auto' && width - (treeVisible ? 260 : 0) >= 760);
  return (
    <section
      ref={rootRef}
      className="chatkit-file-review"
      aria-label={t('fileActivity.review')}
    >
      <ReviewControls
        scope={scope}
        setScope={setScope}
        settings={settings}
        setSettings={setSettings}
        total={total}
        loading={loading}
        refresh={retry}
        entries={entries}
        allCollapsed={allCollapsed}
        toggleAll={() =>
          setCollapsed(
            allCollapsed
              ? new Set()
              : new Set(entries.map((entry) => entry.key)),
          )
        }
        showTree={treeOpen}
        toggleTree={() => setShowTree(!treeOpen)}
        jump={jump}
        canCopyPatch={!!patch}
        copyPatch={() => {
          if (patch) void copy(patch);
        }}
      />
      {notice && (
        <div role="status" className="review-notice">
          {notice}
        </div>
      )}
      {loading ? (
        <div role="status" className="flex items-center gap-2 p-4 text-sm">
          <Loader2 className="size-4 animate-spin" />
          {t('workbench.loading')}
        </div>
      ) : failed ? (
        <div role="alert" className="p-4 text-sm">
          {t('workbench.review.failed')}{' '}
          <button
            type="button"
            className="rounded px-2 py-1 underline"
            onClick={retry}
          >
            {t('common.retry')}
          </button>
        </div>
      ) : !entries.length ? (
        <p className="p-4 text-sm text-muted-foreground">
          {t('workbench.review.empty')}
        </p>
      ) : (
        <div className="review-body">
          <Virtualizer className="review-scroll">
            {entries.map((entry) => (
              <article
                key={entry.key}
                className={`review-file ${collapsed.has(entry.key) ? 'review-file-collapsed' : ''}`}
                ref={(node) => {
                  if (node) sectionRefs.current.set(entry.key, node);
                  else sectionRefs.current.delete(entry.key);
                }}
              >
                <ReviewFile
                  entry={entry}
                  collapsed={collapsed.has(entry.key)}
                  toggle={() => toggle(entry.key)}
                  settings={settings}
                  sideBySide={sideBySide}
                  openFile={options.openFile}
                  copyPath={(path) => void copy(path)}
                />
              </article>
            ))}
          </Virtualizer>
          {treeOpen && (
            <div
              className={`review-sidebar ${width < 600 ? 'review-sidebar-overlay' : ''}`}
            >
              <ReviewFileTree
                entries={entries}
                active={active}
                onSelect={(key) => {
                  jump(key);
                  if (width < 600) setShowTree(false);
                }}
              />
            </div>
          )}
        </div>
      )}
    </section>
  );
}
