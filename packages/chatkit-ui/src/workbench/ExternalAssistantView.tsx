import * as React from 'react';
import { ArrowLeft, Bot } from 'lucide-react';
import type { ChatKitOptions, ChatkitMessage } from '@xpert-ai/chatkit-types';
import { MessageList } from '../components/thread/MessageList';
import {
  AgentRunStatus,
  ExternalAssistantAvatar,
  ExternalAssistantRunRow,
} from '../components/thread/messages/external-assistant-run-row';
import {
  getAgentRunTitle,
  isRunningRunStatus,
} from '../lib/agent-run-render-tree';
import { isNearBottom } from '../lib/scroll';
import { useChatkitTranslation } from '../i18n/useChatkitTranslation';
import {
  toExternalAssistantMessages,
  type ExternalAssistantRun,
} from './external-assistant-runs';

export function ExternalAssistantView({
  runs,
  selectedId,
  onSelect,
  messages,
  organizationId,
  apiUrl,
  mcpApps,
  hasMore,
  loadingMore,
  onLoadMore,
  active = true,
}: {
  active?: boolean;
  runs: ExternalAssistantRun[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  messages: ChatkitMessage[];
  organizationId?: string;
  apiUrl?: string;
  mcpApps?: ChatKitOptions['mcpApps'];
  hasMore?: boolean;
  loadingMore?: boolean;
  onLoadMore: () => void;
}) {
  const { t } = useChatkitTranslation();
  const run = runs.find((item) => item.id === selectedId);
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const contentRef = React.useRef<HTMLDivElement>(null);
  const followRef = React.useRef(true);
  React.useLayoutEffect(() => {
    followRef.current = true;
  }, [selectedId]);
  React.useLayoutEffect(() => {
    const element = scrollRef.current;
    if (active && element && followRef.current)
      element.scrollTop = run ? element.scrollHeight : 0;
  }, [run, active]);
  React.useEffect(() => {
    const content = contentRef.current;
    if (!content || !active || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => {
      if (scrollRef.current && followRef.current)
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    });
    observer.observe(content);
    return () => observer.disconnect();
  }, [selectedId, active]);
  const title = run
    ? getAgentRunTitle(run.info, t('message.agentRun.defaultTitle'))
    : t('workbench.externalAssistants.title');
  const transcript = React.useMemo(
    () => (run ? toExternalAssistantMessages(run) : []),
    [run],
  );
  return (
    <section
      className="flex h-full min-h-0 flex-col"
      aria-label={t('workbench.externalAssistants.title')}
    >
      <header className="flex min-h-10 shrink-0 items-center justify-between gap-3 border-b px-4 py-2">
        <div className="flex min-w-0 items-center gap-2">
          {selectedId && (
            <button
              type="button"
              onClick={() => onSelect(null)}
              aria-label={t('workbench.externalAssistants.back')}
              className="rounded-md p-1.5 text-muted-foreground hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
          )}
          {run ? (
            <ExternalAssistantAvatar info={run.info} />
          ) : (
            <Bot
              className="size-4 shrink-0 text-muted-foreground"
              aria-hidden="true"
            />
          )}
          <h2 className="truncate text-sm font-medium">{title}</h2>
        </div>
        {run?.info.model && (
          <span
            className="max-w-[40%] truncate text-xs text-muted-foreground"
            title={run.info.model}
          >
            {run.info.model}
          </span>
        )}
      </header>
      <div
        ref={scrollRef}
        onScroll={() => {
          if (scrollRef.current)
            followRef.current = isNearBottom(scrollRef.current);
        }}
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4"
      >
        {run ? (
          <div
            ref={contentRef}
            className="mx-auto max-w-3xl space-y-4"
            data-external-assistant-execution={run.id}
          >
            <AgentRunStatus info={run.info} />
            {run.info.error != null && (
              <pre
                role="alert"
                className="whitespace-pre-wrap break-words text-sm text-destructive"
              >
                {typeof run.info.error === 'string'
                  ? run.info.error
                  : JSON.stringify(run.info.error)}
              </pre>
            )}
            {!isRunningRunStatus(run.info.status) &&
              run.segments.every(
                ({ node }) => !node.entries.length && !node.children.length,
              ) && (
                <p className="text-sm text-muted-foreground">
                  {t('workbench.externalAssistants.noMessages')}
                </p>
              )}
            <MessageList
              messages={transcript}
              lookupMessages={messages}
              assistantTitle={title ?? undefined}
              isLoading={isRunningRunStatus(run.info.status)}
              isThreadRunning={isRunningRunStatus(run.info.status)}
              organizationId={organizationId}
              apiUrl={apiUrl}
              mcpApps={mcpApps}
              enableQuotes={false}
            />
          </div>
        ) : selectedId ? (
          <p role="status" className="text-sm text-muted-foreground">
            {t('workbench.externalAssistants.unavailable')}
          </p>
        ) : (
          <div className="mx-auto max-w-3xl space-y-2">
            {runs.map((item) => (
              <ExternalAssistantRunRow
                key={item.id}
                info={item.info}
                onOpen={onSelect}
              />
            ))}
            {!runs.length && (
              <p className="text-sm text-muted-foreground">
                {t('workbench.externalAssistants.empty')}
              </p>
            )}
            {hasMore && (
              <button
                type="button"
                disabled={loadingMore}
                onClick={onLoadMore}
                className="rounded-md border px-3 py-2 text-sm hover:bg-muted disabled:opacity-50"
              >
                {t(
                  loadingMore
                    ? 'chat.loadingMoreMessages'
                    : 'chat.loadMoreMessages',
                )}
              </button>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
