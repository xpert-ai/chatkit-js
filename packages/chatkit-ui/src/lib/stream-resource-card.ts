import {
  upsertResourceCardContent,
  parseResourceCardContent,
  type TMessageContentResourceCard,
} from '@xpert-ai/chatkit-types';

type CardMessage = { id?: string; type: string; content: string | object[] };

/** Never attach a delayed resource to whichever reply happens to be last. */
export function applyResourceCard<T extends CardMessage>(
  messages: T[],
  card: TMessageContentResourceCard,
): T[] {
  if (!card.messageId) return messages;
  let changed = false;
  const result = messages.map((message) => {
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
    const existing = parts.find(
      (part) => parseResourceCardContent(part)?.id === card.id,
    );
    if (existing && JSON.stringify(existing) === JSON.stringify(card))
      return message;
    changed = true;
    return { ...message, content: upsertResourceCardContent(parts, card) };
  });
  return changed ? result : messages;
}
