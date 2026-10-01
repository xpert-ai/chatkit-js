import * as React from 'react';
import { createRoot } from 'react-dom/client';
import {
  ChatMessageStepCategory,
  type ChatkitMessage,
} from '@xpert-ai/chatkit-types';
import { ThemeProvider } from '../../src/providers/Theme';
import { MessageList } from '../../src/components/thread/MessageList';
import '../../src/i18n';
import '../../src/index.css';

// Static, synthetic data; this page never connects to an Assistant or runs tools.
const messages: ChatkitMessage[] = [
  {
    id: 'question',
    type: 'user',
    content: '请检查发布说明，并给我一个简短结论。',
  },
  {
    id: 'reply',
    type: 'assistant',
    status: 'success',
    content: [
      { id: 'before', type: 'text', text: '我先检查一下发布说明。' },
      {
        id: 'tool',
        type: 'component',
        data: {
          category: 'Tool',
          type: ChatMessageStepCategory.Program,
          title: '检查发布说明',
          status: 'success',
          input: 'synthetic input',
          output: 'synthetic output',
        },
      },
      {
        id: 'after',
        type: 'text',
        text: '发布说明已准备好。\n\n- 修复了文件预览。\n- 保留原始交互状态。\n\n```javascript\nconsole.log("bubble-check-ok");\n```\n\n| 项目 | 结果 |\n| --- | --- |\n| 消息展示 | 通过 |\n| 工具结果 | 保留 |',
      },
    ],
  },
  { id: 'followup', type: 'user', content: '保留待确认操作。' },
  { id: 'paused', type: 'assistant', status: 'paused', content: [] },
];

function Preview() {
  const [bubbles, setBubbles] = React.useState(true);
  const [dark, setDark] = React.useState(false);
  const [sharp, setSharp] = React.useState(false);
  const [compact, setCompact] = React.useState(false);
  const [narrow, setNarrow] = React.useState(false);
  const [largeText, setLargeText] = React.useState(false);
  return (
    <ThemeProvider
      theme={{
        colorScheme: dark ? 'dark' : 'light',
        radius: sharp ? 'sharp' : 'round',
        density: compact ? 'compact' : 'normal',
      }}
    >
      <main className="min-h-screen bg-background text-foreground p-4">
        <header
          className="mb-6 flex flex-wrap gap-4 text-sm"
          aria-label="验收控制"
        >
          <label>
            <input
              type="checkbox"
              checked={bubbles}
              onChange={(e) => setBubbles(e.target.checked)}
            />{' '}
            气泡模式
          </label>
          <label>
            <input
              type="checkbox"
              checked={dark}
              onChange={(e) => setDark(e.target.checked)}
            />{' '}
            深色
          </label>
          <label>
            <input
              type="checkbox"
              checked={sharp}
              onChange={(e) => setSharp(e.target.checked)}
            />{' '}
            直角
          </label>
          <label>
            <input
              type="checkbox"
              checked={compact}
              onChange={(e) => setCompact(e.target.checked)}
            />{' '}
            紧凑
          </label>
          <label>
            <input
              type="checkbox"
              checked={narrow}
              onChange={(e) => setNarrow(e.target.checked)}
            />{' '}
            360px 窄面板
          </label>
          <label>
            <input
              type="checkbox"
              checked={largeText}
              onChange={(e) => setLargeText(e.target.checked)}
            />{' '}
            200% 缩放
          </label>
        </header>
        <section
          className="mx-auto max-w-full"
          aria-label="消息预览"
          style={{ width: narrow ? 360 : 840, zoom: largeText ? 2 : 1 }}
        >
          <MessageList
            messages={messages}
            assistantTitle="验收助手"
            messagePresentation={{
              mode: bubbles ? 'bubbles' : 'transcript',
              collapseProcess: true,
            }}
            approval={
              <label className="block text-sm">
                输入草稿（切换模式应保留）
                <input
                  className="block w-full rounded border border-border p-2 mt-2"
                  defaultValue="保留这段草稿"
                />
              </label>
            }
          />
        </section>
      </main>
    </ThemeProvider>
  );
}
const root = document.getElementById('root');
if (root) createRoot(root).render(<Preview />);
