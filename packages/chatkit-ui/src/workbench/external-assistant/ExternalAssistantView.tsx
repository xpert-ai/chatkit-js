import * as React from 'react';
import { ExternalAssistantCancelButton } from '../../components/thread/messages/external-assistant-cancel-button';
import { useCancelExternalAssistant } from './useCancelExternalAssistant';
import { useExternalAssistantRunSync } from './useExternalAssistantRunSync';
import type { AgentRunInfo } from '../../lib/agent-runs';
import type { Client } from '@xpert-ai/xpert-sdk';
import { useAssistantInfo } from '../../hooks/useAssistantInfo';
import { readAssistantMessagePresentation } from '../../lib/assistant-message-presentation';
import { resolveMessagePresentation } from '../../lib/message-presentation';
import { ArrowLeft, Bot } from 'lucide-react';
import type { ChatKitOptions, ChatkitMessage } from '@xpert-ai/chatkit-types';
import { MessageList } from '../../components/thread/MessageList';
import {
  AgentRunStatus,
  ExternalAssistantAvatar,
  ExternalAssistantRunRow,
} from '../../components/thread/messages/external-assistant-run-row';
import {
  getAgentRunTitle,
  isRunningRunStatus,
} from '../../lib/agent-run-render-tree';
import { isNearBottom } from '../../lib/scroll';
import { useChatkitTranslation } from '../../i18n/useChatkitTranslation';
import {
  toExternalAssistantMessages,
  type ExternalAssistantRun,
} from './external-assistant-runs';

export function ExternalAssistantView({
  runs: sourceRuns,
  selectedId,
  onSelect,
  messages,
  organizationId,
  apiUrl,
  mcpApps,
  messagePresentation,
  client,
  threadId,
  onRunUpdate,
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
  messagePresentation?: ChatKitOptions['messagePresentation'];
  client?: Client | null;
  threadId?: string | null;
  onRunUpdate?: (threadId: string, run: AgentRunInfo) => void;
  hasMore?: boolean;
  loadingMore?: boolean;
  onLoadMore: () => void;
}) {
  const { t } = useChatkitTranslation();
  const { runs, refresh } = useExternalAssistantRunSync({
    client,
    threadId,
    runs: sourceRuns,
    active,
    onRunUpdate,
  });
  const cancellation = useCancelExternalAssistant(client, threadId, refresh);
  const run = runs.find((item) => item.id === selectedId);
  const assistant = useAssistantInfo(client, run?.info.xpertId);
  const presentation = resolveMessagePresentation(
    messagePresentation,
    readAssistantMessagePresentation(assistant?.config),
  );
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
            <div className="flex items-center justify-between gap-2">
              <AgentRunStatus info={run.info} />
              {cancellation.available &&
                isRunningRunStatus(run.info.status) && (
                  <ExternalAssistantCancelButton
                    name={title ?? ''}
                    onCancel={() => {
                      void cancellation.cancel(run.info);
                    }}
                    pending={cancellation.request(run.id)?.pending}
                    requested={Boolean(
                      cancellation.request(run.id) &&
                      !cancellation.request(run.id)?.error,
                    )}
                  />
                )}
            </div>
            {cancellation.request(run.id)?.error && (
              <p role="alert" className="text-sm text-destructive">
                {cancellation.request(run.id)?.error}
              </p>
            )}
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
              messagePresentation={presentation}
              assistantActor={{
                id: run.info.xpertId
                  ? `assistant:${run.info.xpertId}`
                  : 'unknown:external-assistant',
                kind: run.info.xpertId ? 'assistant' : 'unknown',
                name: title ?? undefined,
                avatar: run.info.avatar,
              }}
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
              <div key={item.id}>
                <ExternalAssistantRunRow
                  info={item.info}
                  onOpen={onSelect}
                  onCancel={
                    cancellation.available
                      ? () => {
                          void cancellation.cancel(item.info);
                        }
                      : undefined
                  }
                  cancelPending={cancellation.request(item.id)?.pending}
                  cancelRequested={Boolean(
                    cancellation.request(item.id) &&
                    !cancellation.request(item.id)?.error,
                  )}
                />
                {cancellation.request(item.id)?.error && (
                  <p role="alert" className="px-2 text-sm text-destructive">
                    {cancellation.request(item.id)?.error}
                  </p>
                )}
              </div>
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
