import { upsertFileActivityContent, type TMessageContentFileActivity } from '@xpert-ai/chatkit-types';

type ReceiptMessage = { id?: string; type: string; executionId?: string; content: string | object[] };

/** Route delayed facts by message identity, never by the latest visible response. */
export function applyFileActivityReceipt<T extends ReceiptMessage>(messages: T[], receipt: TMessageContentFileActivity): T[] {
  const index = receipt.messageId ? messages.findIndex((message) => message.id === receipt.messageId)
    : receipt.executionId ? (() => {
      const matches = messages.flatMap((message, position) => ['ai', 'assistant'].includes(message.type) && message.executionId === receipt.executionId ? [position] : []);
      return matches.length === 1 ? matches[0] : -1;
    })() : -1;
  if (index < 0 || !['ai', 'assistant'].includes(messages[index].type)) return messages;
  return messages.map((message, position) => {
    if (position !== index) return message;
    const content = Array.isArray(message.content) ? message.content : message.content ? [{ type: 'text', text: message.content }] : [];
    return { ...message, content: upsertFileActivityContent(content, receipt) };
  });
}
