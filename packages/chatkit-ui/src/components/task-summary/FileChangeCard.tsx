import * as React from 'react';
import { ChevronDown, ChevronUp, FileDiff } from 'lucide-react';
import type { Client } from '@xpert-ai/xpert-sdk';
import { fileChangeRangeKey, type ChatFileChange, type ChatTaskSummaryResourceReference, type MessageFileChangeStats, type FileChangeLineStats } from '@xpert-ai/chatkit-types';
import { useChatkitTranslation } from '../../i18n/useChatkitTranslation';

export type OpenFileChange = (resource: ChatTaskSummaryResourceReference, messageId?: string, title?: string) => void;
const PREVIEW_FILES = 5;

function LineStats({ added, removed }: { added: number; removed: number }) {
  return <span className="chatkit-change-line-stats inline-flex shrink-0 gap-1.5 tabular-nums"><span data-lines-added={added}>+{added}</span><span data-lines-removed={removed}>−{removed}</span></span>;
}

export function FileChangeCard({ changes, messageId, conversationId, client, isLoading, onOpenResource }: {
  changes: ChatFileChange[];
  messageId: string;
  conversationId?: string | null;
  client?: { conversations: Pick<Client['conversations'], 'getMessageFileChangeStats'> };
  isLoading?: boolean;
  onOpenResource: OpenFileChange;
}) {
  const { t } = useChatkitTranslation();
  const [expanded, setExpanded] = React.useState(false);
  const [collapsed, setCollapsed] = React.useState(false);
  const [loaded, setLoaded] = React.useState<{ key: string; result: MessageFileChangeStats } | null>(null);
  const rangeKey = JSON.stringify(changes.map(c => [c.workspacePath, c.resource && fileChangeRangeKey(c.resource)]));
  const requestKey = JSON.stringify([conversationId, messageId, rangeKey]);
  React.useEffect(() => {
    if (!client || !conversationId || isLoading || loaded?.key === requestKey) return;
    const controller = new AbortController();
    client.conversations.getMessageFileChangeStats(conversationId, messageId, { signal: controller.signal })
      .then(result => { if (!controller.signal.aborted && result.messageId === messageId) setLoaded({ key: requestKey, result }); })
      .catch(() => { /* Counts are optional; never substitute zeros for unavailable history. */ });
    return () => controller.abort();
  }, [client, conversationId, messageId, requestKey, isLoading, loaded?.key]);
  const stats = new Map<string, FileChangeLineStats>();
  if (loaded?.key === requestKey) for (const item of loaded.result.items) {
    if (item.resource) stats.set(fileChangeRangeKey(item.resource), item.stats);
  }
  const counts = changes.map(c => c.resource && stats.get(fileChangeRangeKey(c.resource))).filter((s): s is Extract<FileChangeLineStats, { status: 'ready' }> => s?.status === 'ready');
  const total = counts.length ? counts.reduce((sum, s) => ({ added: sum.added + s.added, removed: sum.removed + s.removed }), { added: 0, removed: 0 }) : null;
  const visible = collapsed ? [] : expanded ? changes : changes.slice(0, PREVIEW_FILES);
  const canReview = changes.some(c => c.resource);
  return <section data-slot="file-change-card" className="chatkit-file-change-card overflow-hidden border border-border bg-card">
    <header className="chatkit-file-change-header flex items-center">
      <span aria-hidden="true" className="chatkit-file-type-tile inline-flex shrink-0 items-center justify-center bg-muted/60 text-muted-foreground"><FileDiff className="size-5" /></span>
      <div className="min-w-0 flex-1"><div className="font-medium">{t('fileActivity.changedFiles', { count: changes.length })}</div>
        {total && <div className="mt-0.5 text-sm" aria-label={t('fileActivity.textLineChanges')}><LineStats {...total} /></div>}
      </div>
      <button type="button" className="chatkit-change-review-button shrink-0 border border-border bg-background text-sm font-medium hover:bg-muted disabled:opacity-50" disabled={!canReview} onClick={() => onOpenResource({ type: 'file_change_set', messageId, changes: changes.map(({ workspacePath, resource }) => ({ workspacePath, resource })) }, messageId, t('fileActivity.review'))}>{t('fileActivity.review')}</button>
    </header>
    {!collapsed && <div data-slot="file-change-rows" className="border-t border-border">
      {visible.map(change => {
        const slash = change.workspacePath.lastIndexOf('/');
        const directory = slash >= 0 ? change.workspacePath.slice(0, slash + 1) : '';
        const name = change.workspacePath.slice(slash + 1);
        const count = change.resource ? stats.get(fileChangeRangeKey(change.resource)) : undefined;
        return <button type="button" key={change.id} className="chatkit-change-file-row flex w-full items-center text-left hover:bg-muted disabled:cursor-default" disabled={!change.resource} title={change.workspacePath} aria-label={`${t('fileActivity.review')} ${change.workspacePath}`} onClick={() => change.resource && onOpenResource(change.resource, messageId, change.title)}>
          <span className="chatkit-change-file-path min-w-0 flex-1"><span className="chatkit-change-directory text-muted-foreground">{directory}</span><span className="chatkit-change-basename font-medium">{name}</span></span>
          {count?.status === 'ready' ? <LineStats {...count} /> : <span className="shrink-0 text-xs text-muted-foreground">{t(`fileActivity.${change.coverage === 'legacy' ? 'legacy' : change.operation}`)}</span>}
        </button>;
      })}
    </div>}
    <div className="chatkit-change-footer flex flex-wrap items-center gap-4">
      {!collapsed && !expanded && changes.length > PREVIEW_FILES && <button type="button" className="inline-flex items-center gap-1 text-sm font-medium hover:underline" onClick={() => setExpanded(true)}>{t('fileActivity.showAllFiles', { count: changes.length })}<ChevronDown className="size-4" /></button>}
      <button type="button" aria-expanded={!collapsed} className="inline-flex items-center gap-1 text-sm font-medium hover:underline" onClick={() => { setCollapsed(!collapsed); setExpanded(false); }}>{t(collapsed ? 'fileActivity.showFiles' : 'fileActivity.hideFiles')}{collapsed ? <ChevronDown className="size-4" /> : <ChevronUp className="size-4" />}</button>
    </div>
  </section>;
}
