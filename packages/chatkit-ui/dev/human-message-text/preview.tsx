import * as React from 'react';
import { createRoot } from 'react-dom/client';
import type { ChatkitMessage } from '@xpert-ai/chatkit-types';
import { ThemeProvider } from '../../src/providers/Theme';
import { MessageList } from '../../src/components/thread/MessageList';
import '../../src/i18n';
import '../../src/index.css';

// Synthetic messages only; no backend requests or conversation mutations.
const paragraph =
  '这是一段用于验证长消息折叠的示例文字，完整内容应当保留，点击按钮后可以继续阅读。';
const longText = paragraph.repeat(48) + '完整消息末尾';
const query = new URLSearchParams(location.search);
const dark = query.has('dark');
const messages: ChatkitMessage[] = [
  { id: 'short', type: 'user', content: '简短的用户消息' },
  { id: 'long', type: 'user', content: longText },
  { id: 'wrapped', type: 'user', content: paragraph.repeat(7) },
  {
    id: 'parts',
    type: 'user',
    content: Array.from({ length: 20 }, (_, i) => ({
      type: 'text' as const,
      text: `第 ${i + 1} 段消息`,
    })),
  },
  { id: 'answer', type: 'assistant', status: 'success', content: longText },
];

function Preview() {
  const [shortened, setShortened] = React.useState(false);
  return (
    <ThemeProvider
      theme={{
        colorScheme: dark ? 'dark' : 'light',
        radius: dark ? 'sharp' : 'round',
        density: dark ? 'compact' : 'spacious',
      }}
    >
      <main className="min-h-screen bg-background text-foreground p-4">
        <button type="button" onClick={() => setShortened((value) => !value)}>
          替换长消息
        </button>
        <section className="mx-auto max-w-3xl">
          <MessageList
            messages={messages.map((message) =>
              message.id === 'long' && shortened
                ? { ...message, content: '更新后的短消息' }
                : message,
            )}
            messagePresentation={{
              mode: query.has('bubbles') ? 'bubbles' : 'transcript',
            }}
          />
        </section>
      </main>
    </ThemeProvider>
  );
}

const root = document.getElementById('root');
if (root) createRoot(root).render(<Preview />);
