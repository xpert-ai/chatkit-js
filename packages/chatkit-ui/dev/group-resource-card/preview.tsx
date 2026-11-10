import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Client, type ChatGroupSnapshot } from '@xpert-ai/xpert-sdk';
import { ThemeProvider } from '../../src/providers/Theme';
import { MessageList } from '../../src/components/thread/MessageList';
import { getGroupMessageListProps } from '../../src/components/group/getGroupMessageListProps';
import { useChatkitTranslation } from '../../src/i18n/useChatkitTranslation';
import { setLanguage } from '../../src/i18n';
import '../../src/index.css';

// Synthetic UI fixture. No Assistant runs, resource fetches or real navigation.
const options = new URLSearchParams(location.search);
setLanguage(options.get('lang') ?? 'zh-CN');
const title = '库存透视｜工厂数量与价值：按区域、工厂及库存地点对比';
const group: ChatGroupSnapshot = {
  id: 'group',
  title: '经营分析会',
  threadId: 'thread',
  xpertId: 'assistant',
  viewerParticipantId: 'viewer',
  members: [
    {
      id: 'assistant',
      kind: 'assistant',
      subjectId: 'assistant',
      name: '经营分析助手',
      role: 'member',
      active: true,
    },
  ],
  messages: [
    {
      id: 'message',
      clientMessageId: 'client',
      sequence: 1,
      text: title,
      createdAt: '2026-11-10T00:00:00Z',
      deliveries: [],
      communication: {
        senderId: 'assistant',
        recipientIds: [],
        intent: 'message',
        rootMessageId: 'root',
        rootUserId: 'viewer',
        hop: 1,
        resourceLinks: [
          {
            title,
            icon: { type: 'emoji', value: '📊' },
            projectId: 'project',
            resource: { kind: 'group-reference', id: 'reference' },
          },
        ],
      },
    },
  ],
  runs: [],
  hasMore: false,
  revision: 1,
};
const client = new Client({ apiUrl: location.origin });
function Preview() {
  const { t } = useChatkitTranslation();
  const [opened, setOpened] = useState(false);
  return (
    <ThemeProvider
      theme={{
        colorScheme: options.get('theme') === 'dark' ? 'dark' : 'light',
        radius: options.get('radius') === 'sharp' ? 'sharp' : 'round',
        density: options.get('density') === 'compact' ? 'compact' : 'spacious',
      }}
    >
      <main className="min-h-screen bg-background text-foreground p-3">
        <p className="mb-4 text-sm text-muted-foreground">
          群聊资源卡片 · 模拟验收数据
        </p>
        <section
          className="mx-auto max-w-full"
          style={{ width: options.has('narrow') ? 350 : 680 }}
        >
          <MessageList
            {...getGroupMessageListProps({
              t,
              group,
              client,
              live: {},
              onReply: () => {},
              onError: () => {},
              onOpenResource: options.has('disabled')
                ? undefined
                : () => setOpened(true),
            })}
          />
          {opened && <p role="status">已触发打开操作（模拟）</p>}
        </section>
      </main>
    </ThemeProvider>
  );
}
createRoot(document.getElementById('root')!).render(<Preview />);
