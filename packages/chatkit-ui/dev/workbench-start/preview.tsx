import * as React from 'react';
import { createRoot } from 'react-dom/client';
import type { ChatKitTheme } from '@xpert-ai/chatkit-types';
import { ThemeProvider } from '../../src/providers/Theme';
import { WorkbenchStartPage } from '../../src/workbench/start-page/WorkbenchStartPage';
import { TaskSummaryTrigger } from '../../src/components/task-summary/TaskSummary';
import {
  collectLiveTaskSummary,
  mergeTaskSummary,
} from '../../src/lib/task-summary';
import {
  WorkbenchContext,
  disabledWorkbenchContext,
} from '../../src/workbench/context';
import type { SideChatSession } from '../../src/workbench/side-chat/types';
import type { useWorkbenchSideChat } from '../../src/workbench/shell/side-chat/useWorkbenchSideChat';
import { FloatingChatPreview } from './FloatingChatPreview';
import '../../src/i18n';
import '../../src/index.css';

// Synthetic records only. This preview never calls platform or Assistant APIs.
const summary = mergeTaskSummary(
  null,
  collectLiveTaskSummary({
    messages: [
      {
        id: 'example-message',
        taskSummary: {
          version: 1,
          outputs: [
            {
              id: 'example-output',
              kind: 'site',
              title: 'Workbench 交互预览',
              origin: 'integration',
              resource: {
                type: 'url',
                url: 'https://example.com/workbench',
              },
            },
          ],
          sources: [
            {
              id: 'example-source',
              kind: 'web_page',
              title: 'Xpert AI 文档',
              resource: { type: 'browser', url: 'https://example.com/docs' },
            },
          ],
        },
      },
    ],
  }),
);

function Preview() {
  const [dark, setDark] = React.useState(false);
  const [radius, setRadius] = React.useState<ChatKitTheme['radius']>('round');
  const [density, setDensity] =
    React.useState<ChatKitTheme['density']>('normal');
  const [narrow, setNarrow] = React.useState(false);
  const [activeId, setActiveId] = React.useState<string>();
  const [notice, setNotice] = React.useState('交互预览 · 示例会话数据');
  const [sessions, setSessions] = React.useState<SideChatSession[]>([
    {
      threadId: 'example-1',
      sourceThreadId: 'main',
      title: '优化语义模型界面',
      status: 'idle',
      opened: true,
    },
    {
      threadId: 'example-2',
      sourceThreadId: 'main',
      title: '调查相关可视化方案',
      status: 'busy',
      opened: true,
    },
    {
      threadId: 'example-3',
      sourceThreadId: 'main',
      title: '讨论搜索列表交互',
      status: 'interrupted',
      opened: false,
    },
  ]);
  const askInSideChat = async () => {
    const id = crypto.randomUUID();
    setSessions((list) => [
      ...list,
      {
        threadId: id,
        sourceThreadId: 'main',
        title: `侧边聊天 ${list.length + 1}`,
        opened: true,
        status: 'idle',
      },
    ]);
    setActiveId(id);
    setNotice('已创建示例侧边聊天；真实运行请在宿主会话中使用');
  };
  const openSideChat = async (id: string) => {
    setSessions((list) =>
      list.map((s) => (s.threadId === id ? { ...s, opened: true } : s)),
    );
    setActiveId(id);
    setNotice('已切换示例侧边聊天');
  };
  const chats: ReturnType<typeof useWorkbenchSideChat> = {
    sessions,
    activeId,
    ready: true,
    opening: false,
    error: null,
    askInSideChat,
    openSideChat,
    closeSideChat: (id) =>
      setSessions((list) =>
        list.map((s) => (s.threadId === id ? { ...s, opened: false } : s)),
      ),
    renameSideChat: async (id, title) =>
      setSessions((list) =>
        list.map((s) => (s.threadId === id ? { ...s, title } : s)),
      ),
    updateStatus: () => {},
    reload: () => {},
  };
  return (
    <ThemeProvider
      theme={{ colorScheme: dark ? 'dark' : 'light', radius, density }}
    >
      <WorkbenchContext.Provider
        value={{
          ...disabledWorkbenchContext,
          sideChatEnabled: true,
          sideChats: chats,
          storageScope: 'synthetic-workbench-preview',
          searchUrlTemplate: 'https://www.google.com/search?q={query}',
        }}
      >
        <main className="min-h-screen bg-background text-foreground">
          <div className="flex flex-wrap items-center gap-3 border-b p-3 text-sm">
            <span className="mr-auto text-muted-foreground">{notice}</span>
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
                checked={radius === 'sharp'}
                onChange={(e) =>
                  setRadius(e.target.checked ? 'sharp' : 'round')
                }
              />{' '}
              直角
            </label>
            <label>
              <input
                type="checkbox"
                checked={density === 'compact'}
                onChange={(e) =>
                  setDensity(e.target.checked ? 'compact' : 'spacious')
                }
              />{' '}
              紧凑
            </label>
            <label>
              <input
                type="checkbox"
                checked={narrow}
                onChange={(e) => setNarrow(e.target.checked)}
              />{' '}
              窄屏
            </label>
          </div>
          <div
            className="relative mx-auto flex h-[calc(100dvh-2.75rem)] flex-col border-x"
            style={{ maxWidth: narrow ? 390 : 1500 }}
          >
            <div className="flex items-center gap-2 border-b p-2">
              <span className="mr-2 shrink-0 text-sm">示例 Conversation</span>
              <TaskSummaryTrigger
                summary={summary}
                sideChats={chats}
                onRetryHistory={() => {}}
                onLoadSection={() => {}}
                onNavigateMessage={() => setNotice('已选择示例消息')}
                onFocusComposer={() => setNotice('已选择创建输出内容')}
                onOpenResource={(_resource, _messageId, title) =>
                  setNotice(`已选择：${title}`)
                }
              />
              <div className="flex min-w-0 flex-1 gap-1 overflow-x-auto">
                {sessions
                  .filter((s) => s.opened)
                  .map((s) => (
                    <div
                      key={s.threadId}
                      className={`flex min-w-32 items-center gap-1 rounded-chat-item p-2 text-sm ${activeId === s.threadId ? 'bg-accent' : 'bg-muted/40'}`}
                    >
                      <button
                        className="truncate"
                        onClick={() => void openSideChat(s.threadId)}
                      >
                        {s.title}
                      </button>
                      <button
                        className="ml-auto"
                        aria-label={`关闭 ${s.title}`}
                        onClick={() => chats.closeSideChat(s.threadId)}
                      >
                        ×
                      </button>
                    </div>
                  ))}
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-auto pb-44">
              <WorkbenchStartPage
                views={[]}
                recent={[
                  {
                    preview: {
                      kind: 'browser',
                      key: 'example-web',
                      title: 'Timeline components',
                      url: 'https://example.com/timeline',
                    },
                    openedAt: 2,
                  },
                  {
                    preview: {
                      kind: 'browser',
                      key: 'example-docs',
                      title: 'Xpert AI 文档',
                      url: 'https://example.com/docs',
                    },
                    openedAt: 1,
                  },
                ]}
                locale="zh-CN"
                apiUrl="/api/ai"
                loading={false}
                error={null}
                conversationReady
                sideChatEnabled
                onReload={() => setNotice('已刷新示例功能列表')}
                onSelectView={(key) => setNotice(`打开视图：${key}`)}
                onOpenTool={(tool) =>
                  tool === 'side-chat'
                    ? void askInSideChat()
                    : setNotice(`选择了 ${tool}；预览不执行终端或文件操作`)
                }
                onOpenPreview={(preview) =>
                  setNotice(`已选择：${preview.title}`)
                }
              />
            </div>
            <FloatingChatPreview
              onSideChat={() => void askInSideChat()}
              onNotice={setNotice}
            />
          </div>
        </main>
      </WorkbenchContext.Provider>
    </ThemeProvider>
  );
}
createRoot(document.getElementById('root')!).render(<Preview />);
