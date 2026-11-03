import type { Client } from '@xpert-ai/xpert-sdk';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { renderToStaticMarkup } from 'react-dom/server';
import type { ThreadItem } from '../../hooks/useThreads';
import type { ChatKitAIMessage } from '../../providers/stream/types';
import {
  mergeHistoryUiMessages,
  normalizeConversationMessagesPage,
} from '../../providers/stream/history/pagination';

/** Never export the currently mounted (potentially paginated) transcript as a complete conversation. */
export async function readConversationTranscript(
  client: Client,
  target: Pick<ThreadItem, 'recordId' | 'id'>,
  signal: AbortSignal,
): Promise<ChatKitAIMessage[]> {
  const limit = 50;
  let offset = 0;
  let expectedTotal: number | undefined;
  let messages: ChatKitAIMessage[] = [];
  const seen = new Set<string>();
  while (!signal.aborted) {
    const response = await client.conversations.searchMessages(
      target.recordId,
      {
        where: { threadId: target.id },
        order: { createdAt: 'DESC', id: 'DESC' },
        limit,
        offset,
      },
      { signal },
    );
    if (signal.aborted) throw new Error('Transcript request cancelled');
    const total = response.total;
    if (expectedTotal !== undefined && total !== expectedTotal)
      throw new Error('Conversation changed while reading');
    expectedTotal = total;
    if (!response.items.length && offset < total)
      throw new Error('Incomplete conversation history');
    for (const item of response.items) {
      if (seen.has(item.id)) throw new Error('Conversation pagination changed');
      seen.add(item.id);
    }
    messages = mergeHistoryUiMessages(
      messages,
      normalizeConversationMessagesPage(response).messages,
    );
    offset += response.items.length;
    if (offset >= total || !response.items.length) return messages;
  }
  throw new Error('Transcript request cancelled');
}

/** Whitelist visible text. Never stringify tools, reasoning, runtime metadata or signed resource URLs. */
export function visibleMessageText(message: ChatKitAIMessage): string {
  if (message.type !== 'human' && message.type !== 'ai') return '';
  if (typeof message.content === 'string') return message.content;
  return message.content
    .filter((part) => part.type === 'text' && typeof part.text === 'string')
    .map((part) => part.text as string)
    .join('\n\n');
}

export function markdownToText(markdown: string): string {
  const html = renderToStaticMarkup(
    <Markdown
      skipHtml
      remarkPlugins={[remarkGfm]}
      components={{ img: ({ alt }) => <span>{alt}</span> }}
    >
      {markdown}
    </Markdown>,
  );
  const doc = new DOMParser().parseFromString(html, 'text/html');
  doc.querySelectorAll('br').forEach((node) => node.replaceWith('\n'));
  doc
    .querySelectorAll('p,pre,h1,h2,h3,h4,h5,h6,li,tr,blockquote')
    .forEach((node) => node.append('\n'));
  doc.querySelectorAll('th,td').forEach((node) => node.append('\t'));
  return (doc.body.textContent ?? '').replace(/\n{3,}/g, '\n\n').trim();
}

export function serializeConversation(
  title: string,
  messages: ChatKitAIMessage[],
  format: 'markdown' | 'text',
  labels: { user: string; assistant: string; textOnly: string },
): string {
  const blocks = messages.flatMap((message) => {
    const text = visibleMessageText(message).trim();
    if (!text) return [];
    const role = message.type === 'human' ? labels.user : labels.assistant;
    return [
      format === 'markdown'
        ? `## ${role}\n\n${text}`
        : `${role}\n${markdownToText(text)}`,
    ];
  });
  return [
    format === 'markdown' ? `# ${title.replace(/[\r\n]+/g, ' ')}` : title,
    labels.textOnly,
    ...blocks,
  ].join('\n\n');
}

export async function copyConversationText(text: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  throw new Error('Clipboard unavailable');
}

export function downloadConversation(title: string, text: string) {
  const blob = new Blob([text], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  const filename = Array.from(title, (character) =>
    character.charCodeAt(0) < 32 || '<>:"/\\|?*'.includes(character)
      ? '_'
      : character,
  )
    .join('')
    .slice(0, 100);
  anchor.download = `${filename || 'conversation'}.md`;
  document.body.append(anchor);
  try {
    anchor.click();
  } finally {
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
