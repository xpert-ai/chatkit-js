import type { McpAppHistory as McpAppHistoryData } from '@xpert-ai/xpert-sdk';
import { AlertCircle, History, Loader2, RotateCcw } from 'lucide-react';
import * as React from 'react';
import { useChatkitTranslation } from '../../../../../i18n/useChatkitTranslation';
import { cn } from '../../../../../lib/utils';
import { Button } from '../../../../ui/button';
import type { McpAppResourceFailure } from '../resource/history-status';
import { normalizeCallToolResult } from '../resource/tool-result';

type McpAppHistoryProps = {
  failure: McpAppResourceFailure;
  history: McpAppHistoryData | null;
  loading: boolean;
  historyUnavailable: boolean;
  resuming: boolean;
  resumeFailed: boolean;
  onResume: () => void;
  className?: string;
};

/** Displays authorized MCP content without loading plugin HTML or inferring plugin-specific schemas. */
export function McpAppHistory({
  failure,
  history,
  loading,
  historyUnavailable,
  resuming,
  resumeFailed,
  onResume,
  className,
}: McpAppHistoryProps) {
  const { i18n } = useChatkitTranslation();
  const result = React.useMemo(
    () => normalizeCallToolResult(history?.toolResult ?? undefined),
    [history?.toolResult],
  );
  const textBlocks = result.content.filter(
    (block): block is typeof block & { text: string } =>
      block.type === 'text' && typeof block.text === 'string',
  );
  const structured = React.useMemo(
    () =>
      result.structuredContent &&
      JSON.stringify(result.structuredContent, null, 2),
    [result.structuredContent],
  );
  const queriedAt =
    history?.createdAt !== undefined ? new Date(history.createdAt) : null;
  const hasQueryTime = queriedAt && Number.isFinite(queriedAt.getTime());
  const hasResult =
    history?.toolResult !== undefined && history?.toolResult !== null;
  const hasContent = textBlocks.length > 0 || !!structured;

  return (
    <div
      className={cn(
        'flex min-w-0 flex-col gap-3 overflow-auto p-4 text-[0.8125rem] leading-5 text-foreground',
        'in-data-[density=compact]:gap-2 in-data-[density=compact]:p-3 in-data-[density=compact]:text-xs in-data-[density=compact]:leading-4',
        'in-data-[density=spacious]:gap-4 in-data-[density=spacious]:p-5 in-data-[density=spacious]:text-sm in-data-[density=spacious]:leading-6',
        className,
      )}
    >
      <div
        role={failure === 'forbidden' ? 'alert' : 'status'}
        className={cn(
          'flex items-start gap-2 text-muted-foreground',
          failure === 'forbidden' && 'text-destructive',
        )}
      >
        <AlertCircle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
        <p>{i18n.t(`message.mcpApp.history.${failure}`)}</p>
      </div>

      {failure !== 'forbidden' ? (
        <>
          {loading ? (
            <div
              role="status"
              className="flex items-center gap-2 text-muted-foreground"
            >
              <Loader2
                aria-hidden="true"
                className="size-4 animate-spin motion-reduce:animate-none"
              />
              {i18n.t('message.mcpApp.history.loading')}
            </div>
          ) : history ? (
            <section
              aria-label={i18n.t('message.mcpApp.history.title')}
              className="min-w-0"
            >
              <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-muted-foreground">
                <span className="inline-flex items-center gap-1.5 font-medium text-foreground">
                  <History aria-hidden="true" className="size-4" />
                  {i18n.t('message.mcpApp.history.title')}
                </span>
                {hasQueryTime ? (
                  <span>
                    {i18n.t('message.mcpApp.history.queriedAt')}{' '}
                    <time dateTime={queriedAt.toISOString()}>
                      {queriedAt.toLocaleString(i18n.language)}
                    </time>
                  </span>
                ) : null}
              </div>
              {history.toolResultTruncated ? (
                <p role="status" className="mb-2 text-muted-foreground">
                  {i18n.t('message.mcpApp.history.truncated')}
                </p>
              ) : null}
              {result.isError ? (
                <p className="mb-2 text-destructive">
                  {i18n.t('message.mcpApp.history.toolFailed')}
                </p>
              ) : null}
              {hasContent ? (
                <div className="max-h-96 space-y-3 overflow-auto rounded-chat-item border bg-muted/30 p-3 in-data-[density=compact]:p-2 in-data-[density=spacious]:p-4">
                  {textBlocks.map((block, index) => (
                    <p
                      key={index}
                      className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]"
                    >
                      {block.text}
                    </p>
                  ))}
                  {structured ? (
                    <details open={!textBlocks.length}>
                      <summary className="cursor-pointer rounded-chat-item text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring">
                        {i18n.t('message.mcpApp.history.structured')}
                      </summary>
                      <pre className="mt-2 whitespace-pre-wrap break-words font-mono text-xs [overflow-wrap:anywhere]">
                        {structured}
                      </pre>
                    </details>
                  ) : null}
                </div>
              ) : (
                <p className="text-muted-foreground">
                  {i18n.t(
                    `message.mcpApp.history.${
                      history.toolResultTruncated
                        ? 'truncatedMissing'
                        : !hasResult
                          ? 'missing'
                          : result.content.length
                            ? 'mediaOnly'
                            : 'empty'
                    }`,
                  )}
                </p>
              )}
            </section>
          ) : (
            <p className="text-muted-foreground">
              {i18n.t(
                `message.mcpApp.history.${historyUnavailable ? 'unavailableSnapshot' : 'missing'}`,
              )}
            </p>
          )}

          {resumeFailed ? (
            <p role="alert" className="text-destructive">
              {i18n.t('message.mcpApp.history.resumeFailed')}
            </p>
          ) : null}
          {history?.canResume ? (
            <div className="flex flex-wrap items-center gap-3">
              <Button
                type="button"
                variant="outline"
                disabled={resuming}
                aria-busy={resuming}
                onClick={onResume}
                className="in-data-[density=compact]:h-8 in-data-[density=compact]:text-xs in-data-[density=spacious]:h-11"
              >
                {resuming ? (
                  <Loader2
                    aria-hidden="true"
                    className="animate-spin motion-reduce:animate-none"
                  />
                ) : (
                  <RotateCcw aria-hidden="true" />
                )}
                {i18n.t(
                  `message.mcpApp.history.${resuming ? 'resuming' : 'resume'}`,
                )}
              </Button>
              <p className="text-muted-foreground">
                {i18n.t('message.mcpApp.history.resumeHint')}
              </p>
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
