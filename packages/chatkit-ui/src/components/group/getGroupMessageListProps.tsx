import type {
  ChatGroupMessage,
  ChatGroupSnapshot,
  Client,
} from '@xpert-ai/xpert-sdk';
import type { ChatkitMessage } from '@xpert-ai/chatkit-types';
import { normalizeChatkitAvatar } from '../ui/chatkit-avatar';
import { MessageSquareReply } from 'lucide-react';
import type { useChatkitTranslation } from '../../i18n/useChatkitTranslation';
import type { MessageListProps } from '../thread/MessageList';
import { Button } from '../ui/button';
import type { GroupState } from './group-state';

const MESSAGE_TIME_GAP_MS = 5 * 60 * 1000;

export function getGroupMessageListProps({
  t,
  group,
  live,
  client,
  onReply,
  onError,
  onOpenRuntime,
}: {
  t: ReturnType<typeof useChatkitTranslation>['t'];
  group: ChatGroupSnapshot;
  live: GroupState['live'];
  client: Client;
  onReply: (message: ChatGroupMessage) => void;
  onError: (error: unknown) => void;
  onOpenRuntime?: (messageId: string, participantId: string) => void;
}) {
  const member = (id: string) => group.members.find((item) => item.id === id);
  const name = (id: string) => member(id)?.name ?? t('group.formerMember');
  const owner = member(group.viewerParticipantId)?.role === 'owner';
  const hasLiveMessages = Object.keys(live).some(
    (id) => !group.messages.some((message) => message.id === id),
  );
  const context: NonNullable<MessageListProps['messageContext']> = {};
  const messages: ChatkitMessage[] = group.messages.map((message, index) => {
    const author = member(message.communication.senderId);
    const self = author?.id === group.viewerParticipantId;
    const next = group.messages[index + 1];
    const gap = next
      ? Date.parse(next.createdAt) - Date.parse(message.createdAt)
      : Infinity;
    const showTime = next
      ? gap > MESSAGE_TIME_GAP_MS || gap < 0
      : !hasLiveMessages;
    const pendingDeliveries = message.deliveries.filter(
      (delivery) => delivery.status !== 'consumed',
    );
    const canReply =
      !self &&
      message.communication.intent === 'request' &&
      message.communication.recipientIds.includes(group.viewerParticipantId) &&
      !group.messages.some(
        (item) =>
          item.communication.replyToMessageId === message.id &&
          item.communication.senderId === group.viewerParticipantId,
      );
    context[message.id] = {
      actor: {
        id: message.communication.senderId,
        kind: author?.kind ?? 'unknown',
        name: name(message.communication.senderId),
        avatar: normalizeChatkitAvatar(author?.avatar),
      },
      actorAction:
        onOpenRuntime &&
        author?.kind === 'assistant' &&
        message.runtimeParticipantIds?.includes(author.id)
          ? {
              onClick: () => onOpenRuntime(message.id, author.id),
              title: t('group.openRuntime', { name: name(author.id) }),
            }
          : undefined,
      isSelf: self,
      after: (showTime || pendingDeliveries.length > 0 || canReply) && (
        <div
          className={`mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground ${self ? 'justify-end' : ''}`}
        >
          {showTime && (
            <time dateTime={message.createdAt} className="w-full text-center">
              {new Date(message.createdAt).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </time>
          )}
          {pendingDeliveries.map((delivery) => (
            <span key={delivery.participantId}>
              @{name(delivery.participantId)} ·{' '}
              {t(`group.delivery.${delivery.status}`)}
              {(self || owner) &&
                ['pending', 'blocked'].includes(delivery.status) && (
                  <button
                    className="ml-1 underline"
                    onClick={() =>
                      void client.groups
                        .cancelDelivery(
                          group.id,
                          message.id,
                          delivery.participantId,
                        )
                        .catch(onError)
                    }
                  >
                    {t('group.cancelDelivery')}
                  </button>
                )}
            </span>
          ))}
          {canReply && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1 px-2"
              onClick={() => onReply(message)}
            >
              <MessageSquareReply className="size-3" />
              {t('group.reply')}
            </Button>
          )}
        </div>
      ),
    };
    return {
      id: message.id,
      type: author?.kind === 'assistant' ? 'assistant' : 'user',
      content: message.text,
    };
  });
  Object.entries(live).forEach(([id, message]) => {
    if (messages.some((item) => item.id === id)) return;
    const author = member(message.participantId);
    messages.push({ id, type: 'assistant', content: message.text });
    context[id] = {
      actor: {
        id: message.participantId,
        kind: 'assistant',
        name: name(message.participantId),
        avatar: normalizeChatkitAvatar(author?.avatar),
      },
      isSelf: false,
      streaming: true,
    };
  });
  return {
    messages: messages,
    messageContext: context,
    messagePresentation: { mode: 'bubbles' },
    showActions: false,
    enableQuotes: false,
  } satisfies MessageListProps;
}
