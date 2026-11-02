import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ThemeProvider } from '../../src/providers/Theme';
import { ChatHeader } from '../../src/components/chat/header/ChatHeader';
import { ChatHeaderActions } from '../../src/components/chat/header/ChatHeaderActions';
import { DropdownMenuItem } from '../../src/components/ui/dropdown-menu';
import { TaskSummaryTrigger } from '../../src/components/task-summary/TaskSummary';
import { mergeTaskSummary } from '../../src/lib/task-summary';
import {
  WorkbenchContext,
  disabledWorkbenchContext,
} from '../../src/workbench/context';
import type { SharingClient } from '../../src/components/sharing/share-client';
import type { XpertExtensionViewManifest } from '@xpert-ai/xpert-sdk';
import { WorkbenchPanelHeader } from '../../src/workbench/WorkbenchPanelHeader';
import '../../src/i18n';
import '../../src/index.css';

// Synthetic UI data only; no Assistant, sharing, or tool requests leave this page.
const client = {
  conversations: {
    previewShare: async () => ({
      snapshot: { title: 'Header preview', messages: [] },
      digest: 'preview',
      publicSharingEnabled: false,
    }),
    listShares: async () => [],
    createShare: async () => {
      throw new Error('Sharing is disabled in this preview.');
    },
  },
} as unknown as SharingClient;
const noop = () => undefined;
const views: XpertExtensionViewManifest[] = [
  '标书工作台',
  '实时看板',
  '知识库',
].map((title, index) => ({
  key: `preview-${index}`,
  title,
  hostType: 'agent',
  slot: 'agent.workbench.fixed',
  source: { provider: 'preview' },
  view: {
    type: 'remote_component',
    runtime: 'react',
    protocolVersion: 1,
    component: { isolation: 'iframe', entry: 'preview' },
    dataSource: { mode: 'platform' },
  },
  dataSource: { mode: 'platform' },
}));
const summary = mergeTaskSummary(null, {
  outputs: [],
  sources: [],
  agents: [],
  pending: [],
  running: [],
  fileChanges: [],
});

function Preview() {
  const [dark, setDark] = useState(false);
  const [sharp, setSharp] = useState(false);
  const [spacious, setSpacious] = useState(false);
  const [narrow, setNarrow] = useState(false);
  const [character, setCharacter] = useState(true);
  const [identity, setIdentity] = useState(false);
  const [notice, setNotice] = useState('');
  return (
    <ThemeProvider
      theme={{
        colorScheme: dark ? 'dark' : 'light',
        radius: sharp ? 'sharp' : 'round',
        density: spacious ? 'spacious' : 'compact',
      }}
    >
      <main className="min-h-screen bg-background text-foreground p-4">
        <nav
          className="mb-4 flex flex-wrap gap-4 text-sm"
          aria-label="Preview controls"
        >
          <label>
            <input
              type="checkbox"
              checked={dark}
              onChange={(e) => setDark(e.target.checked)}
            />{' '}
            Dark
          </label>
          <label>
            <input
              type="checkbox"
              checked={sharp}
              onChange={(e) => setSharp(e.target.checked)}
            />{' '}
            Sharp
          </label>
          <label>
            <input
              type="checkbox"
              checked={spacious}
              onChange={(e) => setSpacious(e.target.checked)}
            />{' '}
            Spacious
          </label>
          <label>
            <input
              type="checkbox"
              checked={narrow}
              onChange={(e) => setNarrow(e.target.checked)}
            />{' '}
            Narrow
          </label>
          <label>
            <input
              type="checkbox"
              checked={character}
              onChange={(e) => setCharacter(e.target.checked)}
            />{' '}
            Character
          </label>
          <label>
            <input
              type="checkbox"
              checked={identity}
              onChange={(e) => setIdentity(e.target.checked)}
            />{' '}
            Identity
          </label>
          <span role="status">{notice}</span>
        </nav>
        <section
          className="relative h-[80vh] max-w-full overflow-auto border border-border rounded-chat-panel"
          style={{ width: narrow ? 360 : '100%' }}
        >
          <WorkbenchContext.Provider
            value={{
              ...disabledWorkbenchContext,
              enabled: true,
              available: true,
              toggle: () => setNotice('Workbench opened'),
              viewMenu: {
                views,
                locale: 'zh-CN',
                onSelect: (key) => setNotice(key),
              },
            }}
          >
            <ChatHeader
              title="Claw Xpert"
              subtitle={
                <p className="text-sm text-muted-foreground">随时为你效劳</p>
              }
              avatar={<span aria-hidden="true">🦞</span>}
              characterPresentation={character}
              showIdentity={identity}
              style={{ maxWidth: 840 }}
              newThread={{
                label: '新建对话',
                onClick: () => setNotice('New conversation'),
              }}
              actions={
                <ChatHeaderActions
                  menu={<DropdownMenuItem>历史对话</DropdownMenuItem>}
                  share={{
                    client,
                    conversationId: 'preview',
                    threadId: 'preview',
                  }}
                  onMinimize={() => setNotice('Minimized')}
                  summary={
                    <TaskSummaryTrigger
                      summary={summary}
                      onRetryHistory={noop}
                      onLoadSection={noop}
                      onNavigateMessage={noop}
                      onFocusComposer={noop}
                      onOpenResource={noop}
                    />
                  }
                />
              }
            />
            <WorkbenchPanelHeader
              expanded={false}
              onToggleExpanded={noop}
              onClose={noop}
              onNewTab={noop}
            >
              <span className="text-sm">Workbench toolbar</span>
            </WorkbenchPanelHeader>
            <article className="mx-auto max-w-[840px] px-6 pb-6">
              <h1 className="mb-6 text-xl font-semibold">
                Chat header preview
              </h1>
              {Array.from({ length: 12 }, (_, index) => (
                <p key={index} className="my-8 text-base leading-8">
                  滚动时，中间区域保持透明。新建对话在左侧；右侧操作组保留背景，包含更多、分享、任务摘要和工作台。
                </p>
              ))}
            </article>
          </WorkbenchContext.Provider>
        </section>
      </main>
    </ThemeProvider>
  );
}

const root = document.getElementById('root');
if (root) createRoot(root).render(<Preview />);
