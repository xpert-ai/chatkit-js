import StreamContext from '../../providers/Stream';
import { FileChangeCard } from './FileChangeCard';
import { useTheme } from '../../providers/Theme';
import { getSurfaceThemeStyle } from '../../lib/theme-surfaces';
import * as React from 'react';
import { FileDiff, ExternalLink } from 'lucide-react';
import { FileTypeIcon } from './FileTypeIcon';
import {
  CHATKIT_TASK_SUMMARY_OPEN_RESOURCE_EFFECT,
  type ChatkitMessage,
  type ChatFileChange,
  type ChatTaskSummaryResourceReference,
} from '@xpert-ai/chatkit-types';
import { useChatkitTranslation } from '../../i18n/useChatkitTranslation';
import { collectLiveTaskSummary } from '../../lib/task-summary';
import { ParentMessengerContext } from '../../providers/ParentMessenger';

type OpenResource = (
  resource: ChatTaskSummaryResourceReference,
  messageId?: string,
  title?: string,
) => void;

export function FileChangeList({
  changes,
  onOpenResource,
}: {
  changes: ChatFileChange[];
  onOpenResource: OpenResource;
}) {
  const { t } = useChatkitTranslation();
  const { theme } = useTheme();
  return (
    <div
      className="chatkit-file-change-list"
      style={getSurfaceThemeStyle(theme)}
    >
      {changes.map((change) => (
        <button
          type="button"
          key={change.id}
          disabled={!change.resource}
          className="chatkit-summary-row flex w-full items-center text-left hover:bg-muted disabled:cursor-default disabled:opacity-65"
          onClick={() =>
            change.resource &&
            onOpenResource(change.resource, change.messageId, change.title)
          }
        >
          <FileDiff className="size-4 shrink-0" />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm">
              {change.workspacePath}
            </span>
            <span className="block text-xs text-muted-foreground">
              {t(
                `fileActivity.${change.coverage === 'legacy' ? 'legacy' : change.operation}`,
              )}
            </span>
          </span>
          {change.resource && (
            <span className="text-xs text-muted-foreground">
              {t('fileActivity.review')}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

/** Uses exactly the same projection as the task summary, scoped to this message. */
export function MessageFileActivity({
  message,
}: {
  message: Pick<
    ChatkitMessage,
    'id' | 'content' | 'taskSummary' | 'updatedAt' | 'createdAt'
  >;
}) {
  const { t } = useChatkitTranslation();
  const { theme } = useTheme();
  const messenger = React.useContext(ParentMessengerContext);
  const stream = React.useContext(StreamContext);
  const summary = collectLiveTaskSummary({
    messages: [
      {
        id: message.id,
        content: message.content,
        taskSummary: message.taskSummary,
        updatedAt:
          message.updatedAt instanceof Date
            ? message.updatedAt.toISOString()
            : (message.updatedAt ?? undefined),
        createdAt:
          message.createdAt instanceof Date
            ? message.createdAt.toISOString()
            : (message.createdAt ?? undefined),
      },
    ],
  });
  const outputs = summary.outputs.filter((item) => item.origin === 'tool');
  const open: OpenResource = (resource, messageId, title) =>
    messenger?.sendEvent('public_event', [
      'effect',
      {
        name: CHATKIT_TASK_SUMMARY_OPEN_RESOURCE_EFFECT,
        data: { resource, messageId, title },
      },
    ]);
  const incomplete =
    summary.fileChangeCoverage === 'unavailable' ||
    summary.fileChangeCoverage === 'partial';
  if (!outputs.length && !summary.fileChanges.length && !incomplete)
    return null;
  return (
    <div
      className="chatkit-file-activity"
      data-slot="message-file-activity"
      style={getSurfaceThemeStyle(theme)}
    >
      {incomplete && (
        <p role="status" className="text-xs text-muted-foreground">
          {t('fileActivity.incomplete')}
        </p>
      )}
      {outputs.map((item) => {
        return (
          <button
            type="button"
            key={item.id}
            onClick={() =>
              item.resource && open(item.resource, message.id, item.title)
            }
            data-slot="file-delivery-card"
            className="chatkit-delivery-card flex w-full items-center border border-border bg-card text-left transition-colors hover:bg-muted"
            aria-label={`${t('fileActivity.open')} ${item.title}`}
          >
            <FileTypeIcon output={item} variant="card" />
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium">{item.title}</span>
              <span className="block text-xs text-muted-foreground">
                {t(`fileActivity.kinds.${item.kind}`)} ·{' '}
                {t('fileActivity.savedVersion')}
                {item.size != null
                  ? ` · ${(item.size / 1024).toFixed(1)} KB`
                  : ''}
              </span>
            </span>
            <ExternalLink className="size-4 shrink-0" />
          </button>
        );
      })}
      {summary.fileChanges.length > 0 && (
        <FileChangeCard changes={summary.fileChanges} messageId={message.id} conversationId={stream?.conversationId} client={stream?.client} isLoading={stream?.isLoading} onOpenResource={open} />
      )}
    </div>
  );
}
