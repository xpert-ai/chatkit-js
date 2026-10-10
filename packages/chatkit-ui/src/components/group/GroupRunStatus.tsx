import type { ChatGroupSnapshot, Client } from '@xpert-ai/xpert-sdk';
import { useChatkitTranslation } from '../../i18n/useChatkitTranslation';
import { AssistantStreamingIndicator } from '../thread/messages/ai';
import { ChatkitAvatar, normalizeChatkitAvatar } from '../ui/chatkit-avatar';

/** One activity row per assistant, below the shared transcript. */
export function GroupRunStatus({
  group,
  client,
  onError,
}: {
  group: ChatGroupSnapshot;
  client: Client;
  onError: (error: unknown) => void;
}) {
  const { t } = useChatkitTranslation();
  if (!group.runs.length) return null;
  return (
    <div
      data-slot="group-run-status"
      className="mt-4 space-y-3"
      aria-live="polite"
    >
      {group.runs.map((run) => {
        const member = group.members.find(
          (item) => item.id === run.participantId,
        );
        const name = member?.name ?? t('group.formerMember');
        return (
          <div
            key={run.runId}
            data-run-id={run.runId}
            className="flex items-center gap-3 text-xs text-muted-foreground"
          >
            <ChatkitAvatar
              label={name}
              avatar={normalizeChatkitAvatar(member?.avatar)}
              className="size-8 shrink-0"
            />
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <span className="truncate font-medium">{name}</span>
              {run.status === 'busy' ? (
                <AssistantStreamingIndicator status="loading" />
              ) : (
                <span>{t(`group.run.${run.status}`)}</span>
              )}
              {['busy', 'pausing', 'paused'].includes(run.status) && (
                <button
                  className="underline"
                  onClick={() =>
                    void client.groups
                      .control(group.id, run.participantId, {
                        action: 'cancel',
                        runId: run.runId,
                      })
                      .catch(onError)
                  }
                >
                  {t('group.stop')}
                </button>
              )}
              {(run.status === 'busy' || run.status === 'paused') && (
                <button
                  className="underline"
                  onClick={() =>
                    void client.groups
                      .control(group.id, run.participantId, {
                        action: run.status === 'paused' ? 'resume' : 'pause',
                        runId: run.runId,
                      })
                      .catch(onError)
                  }
                >
                  {t(run.status === 'paused' ? 'group.resume' : 'group.pause')}
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
