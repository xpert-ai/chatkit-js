import {
  upsertResourceCardContent,
  type TMessageContentResourceCard,
} from '@xpert-ai/chatkit-types';

type CardMessage = { id?: string; type: string; content: string | object[] };

/** Never attach a delayed resource to whichever reply happens to be last. */
export function applyResourceCard<T extends CardMessage>(
  messages: T[],
  card: TMessageContentResourceCard,
): T[] {
  if (!card.messageId) return messages;
  return messages.map((message) => {
    if (
      message.id !== card.messageId ||
      !['ai', 'assistant'].includes(message.type)
    )
      return message;
    const parts = Array.isArray(message.content)
      ? message.content
      : message.content
        ? [{ type: 'text', text: message.content }]
        : [];
    return { ...message, content: upsertResourceCardContent(parts, card) };
  });
}
