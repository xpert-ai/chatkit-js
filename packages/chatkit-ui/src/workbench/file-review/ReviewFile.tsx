import * as React from 'react';
import {
  ChevronDown,
  ChevronRight,
  Code2,
  ExternalLink,
  MoreHorizontal,
} from 'lucide-react';
import { countFileChangeLines } from '@xpert-ai/chatkit-types';
import { useChatkitTranslation } from '../../i18n/useChatkitTranslation';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../../components/ui/dropdown-menu';
import { ReviewIconButton, ReviewStats } from './ReviewPrimitives';
import { ReviewFileIcon, splitPath } from './ReviewNavigation';
import { FileChangeDiff } from './FileChangeDiff';
import { ReviewFileContent, canRenderReviewFile } from './ReviewFileContent';
import type { FileReviewEntry } from './types';
import type { ReviewSettings } from './review-presentation';

export function ReviewFile({
  entry,
  collapsed,
  toggle,
  settings,
  sideBySide,
  openFile,
  copyPath,
}: {
  entry: FileReviewEntry;
  collapsed: boolean;
  toggle: () => void;
  settings: ReviewSettings;
  sideBySide: boolean;
  openFile?: (entry: FileReviewEntry) => void;
  copyPath: (path: string) => void;
}) {
  const { t } = useChatkitTranslation();
  const [source, setSource] = React.useState(false);
  const { report } = entry;
  const count = report ? countFileChangeLines(report) : null;
  const path = splitPath(entry.path);
  const snapshot = report?.after ?? report?.before;
  const hasText =
    report &&
    (!report.before || report.before.text !== undefined) &&
    (!report.after || report.after.text !== undefined);
  return (
    <>
      <header className="review-file-header">
        <button
          className="review-file-title"
          type="button"
          aria-expanded={!collapsed}
          aria-label={entry.path || t('workbench.review.selected')}
          onClick={toggle}
        >
          <ReviewFileIcon path={entry.path} />
          <span className="min-w-0 truncate">
            <span className="text-muted-foreground">{path.directory}</span>
            {path.name || t('workbench.review.selected')}
          </span>
          {collapsed ? (
            <ChevronRight
              size={15}
              className="shrink-0 text-muted-foreground"
            />
          ) : (
            <ChevronDown size={15} className="shrink-0 text-muted-foreground" />
          )}
        </button>
        {count?.status === 'ready' && (
          <ReviewStats added={count.added} removed={count.removed} />
        )}
        <div className="review-file-actions">
          <ReviewIconButton
            label={t('workbench.review.openFile')}
            disabled={!openFile || snapshot?.text === undefined}
            onClick={() => openFile?.(entry)}
          >
            <ExternalLink size={15} />
          </ReviewIconButton>
          <ReviewIconButton
            label={t('workbench.review.source')}
            disabled={snapshot?.text === undefined}
            aria-pressed={source}
            onClick={() => setSource((value) => !value)}
          >
            <Code2 size={16} />
          </ReviewIconButton>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <ReviewIconButton
                label={t('workbench.review.fileOptions', { path: entry.path })}
              >
                <MoreHorizontal size={17} />
              </ReviewIconButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="review-menu min-w-56 rounded-2xl p-2"
            >
              <DropdownMenuItem
                disabled={!entry.path}
                onSelect={() => copyPath(entry.path)}
              >
                {t('workbench.review.copyPath')}
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={!openFile || snapshot?.text === undefined}
                onSelect={() => openFile?.(entry)}
              >
                {t('workbench.review.openFile')}
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={toggle}>
                {t(
                  `workbench.review.${collapsed ? 'expandFile' : 'collapseFile'}`,
                )}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>
      {!collapsed && (
        <>
          {settings.metadata && report && (
            <dl className="space-y-1 border-b p-3 font-mono text-xs">
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
            <p role="status" className="p-4 text-sm text-muted-foreground">
              {t('workbench.review.unavailable')}
            </p>
          ) : source && snapshot?.text !== undefined ? (
            <div className="h-96">
              <ReviewFileContent path={entry.path} text={snapshot.text} />
            </div>
          ) : settings.preview &&
            snapshot?.text !== undefined &&
            canRenderReviewFile(entry.path) ? (
            <ReviewFileContent path={entry.path} text={snapshot.text} preview />
          ) : !hasText ? (
            <p className="p-4 text-sm text-muted-foreground">
              {t('workbench.review.binary')}
            </p>
          ) : (
            <FileChangeDiff
              report={report}
              sideBySide={sideBySide}
              settings={settings}
            />
          )}
        </>
      )}
    </>
  );
}
