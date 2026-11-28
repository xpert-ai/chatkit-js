import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { MessagesSquare, File, Pencil } from 'lucide-react';
import { ThemeProvider } from '../../src/providers/Theme';
import { WorkbenchTabs } from '../../src/workbench/WorkbenchTabs';
import { WorkbenchTab } from '../../src/workbench/WorkbenchTab';
import { WorkbenchTabMenuProvider } from '../../src/workbench/WorkbenchTabMenu';
import { WorkbenchPanelHeader } from '../../src/workbench/WorkbenchPanelHeader';
import {
  SideChatHeaderContext,
  SideChatHeaderActions,
} from '../../src/workbench/side-chat/SideChatHeaderActions';
import { useSideChatLifecycleActions } from '../../src/workbench/side-chat/useSideChatLifecycleActions';
import type { useWorkbenchSideChat } from '../../src/workbench/shell/side-chat/useWorkbenchSideChat';
import { SideChatRenameDialog } from '../../src/workbench/side-chat/SideChatRenameDialog';
import { ChatHeader } from '../../src/components/chat/header/ChatHeader';
import { TaskSummaryTrigger } from '../../src/components/task-summary/TaskSummary';
import { mergeTaskSummary } from '../../src/lib/task-summary';
import { ConversationMenu } from '../../src/components/conversation/ConversationMenu';
import { context, target } from './conversation-fixture';
import '../../src/i18n';
import '../../src/index.css';

// Synthetic conversation; this preview never calls the platform or sends messages.
const summary = mergeTaskSummary(null, {
  outputs: [],
  sources: [
    {
      id: 'source',
      kind: 'knowledge',
      title: 'Preview reference',
      messageId: 'reply',
    },
  ],
  agents: [],
  pending: [],
  running: [],
  fileChanges: [],
});
function Preview() {
  const [dark, setDark] = useState(false);
  const [sharp, setSharp] = useState(false);
  const [spacious, setSpacious] = useState(false);
  const [neutralAccent, setNeutralAccent] = useState(false);
  const [tabs, setTabs] = useState(['side', 'file']);
  const [active, setActive] = useState('side');
  const [title, setTitle] = useState('Deployment review 1');
  const [rename, setRename] = useState(false);
  const [error, setError] = useState('');
  const [archived, setArchived] = useState(false);
  const [deleted, setDeleted] = useState(false);
  const [failDelete, setFailDelete] = useState(false);
  const chats: ReturnType<typeof useWorkbenchSideChat> = {
    sessions: deleted
      ? []
      : [
          {
            threadId: 'side',
            sourceThreadId: 'main',
            title,
            archived,
            opened: tabs.includes('side'),
            status: 'idle',
          },
        ],
    ready: true,
    opening: false,
    error: null,
    activeId: active,
    mutatingIds: [],
    archiveSideChat: async (_id, value = true) => {
      setArchived(value);
      setTabs((items) =>
        value
          ? items.filter((item) => item !== 'side')
          : [...new Set([...items, 'side'])],
      );
      setActive(value ? 'file' : 'side');
    },
    deleteSideChat: async () => {
      if (failDelete) {
        setFailDelete(false);
        throw new Error('Preview deletion failed. Retry.');
      }
      setDeleted(true);
      setTabs((items) => items.filter((item) => item !== 'side'));
      setActive('file');
    },
    renameSideChat: async (_id, name) => setTitle(name),
    askInSideChat: async () => {},
    openSideChat: async () => {
      setTabs((items) => [...new Set([...items, 'side'])]);
      setActive('side');
    },
    closeSideChat: () =>
      setTabs((items) => items.filter((item) => item !== 'side')),
    updateStatus: () => {},
    reload: () => {},
  };
  const lifecycle = useSideChatLifecycleActions(chats, setError);
  return (
    <ThemeProvider
      theme={{
        colorScheme: dark ? 'dark' : 'light',
        radius: sharp ? 'sharp' : 'round',
        density: spacious ? 'spacious' : 'compact',
        color: neutralAccent
          ? { accent: { primary: dark ? '#18181b' : '#ffffff', level: 1 } }
          : undefined,
      }}
    >
      <div className="min-h-screen bg-background text-foreground p-4">
        <div className="flex gap-4 mb-4">
          <label>
            <input
              type="checkbox"
              checked={failDelete}
              onChange={(event) => setFailDelete(event.target.checked)}
            />{' '}
            Fail next delete
          </label>
          <label>
            <input
              type="checkbox"
              checked={neutralAccent}
              onChange={(e) => setNeutralAccent(e.target.checked)}
            />{' '}
            Neutral accent
          </label>
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
        </div>
        <WorkbenchTabMenuProvider
          tabs={tabs.map((key) => ({
            key,
            close: () =>
              setTabs((items) => items.filter((item) => item !== key)),
            actions:
              key === 'side'
                ? [
                    {
                      id: 'rename',
                      label: 'Rename',
                      icon: <Pencil size={16} />,
                      run: () => setRename(true),
                    },
                    ...lifecycle.actions(chats.sessions[0]),
                  ]
                : undefined,
          }))}
          order={tabs}
          onError={setError}
        >
          <div data-testid="main-menu" className="mb-4 flex items-center gap-2">
            Main conversation
            <ConversationMenu context={context} target={target} />
          </div>
          <div className="h-[600px] max-w-4xl border rounded-chat-panel flex flex-col">
            <WorkbenchPanelHeader
              expanded={false}
              onToggleExpanded={() => {}}
              onClose={() => {}}
            >
              <WorkbenchTabs activeKey={active} order={tabs}>
                {tabs.map((key) => (
                  <WorkbenchTab
                    key={key}
                    label={key === 'side' ? title : 'Notes.md'}
                    icon={key === 'side' ? <MessagesSquare /> : <File />}
                    selected={active === key}
                    onSelect={() => setActive(key)}
                  />
                ))}
              </WorkbenchTabs>
            </WorkbenchPanelHeader>
            <SideChatHeaderContext.Provider value="side">
              <ChatHeader
                title=""
                avatar={null}
                actions={
                  <SideChatHeaderActions>
                    <TaskSummaryTrigger
                      summary={summary}
                      sideChats={chats}
                      onNavigateMessage={() => {}}
                      onOpenResource={() => {}}
                      onFocusComposer={() => {}}
                      onLoadSection={async () => {}}
                      onRetryHistory={() => {}}
                    />
                  </SideChatHeaderActions>
                }
              />
            </SideChatHeaderContext.Provider>
            <div className="flex-1 p-6 text-muted-foreground">
              Side-chat toolbar and tab menu preview
            </div>
          </div>
          {lifecycle.dialog}
          {rename && (
            <SideChatRenameDialog
              title={title}
              onSave={async (value) => setTitle(value)}
              onClose={() => setRename(false)}
            />
          )}
          {error && <p role="alert">{error}</p>}
        </WorkbenchTabMenuProvider>
      </div>
    </ThemeProvider>
  );
}
createRoot(document.getElementById('root')!).render(<Preview />);
