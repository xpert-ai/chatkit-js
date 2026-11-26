import * as React from 'react';
import { createPortal } from 'react-dom';
import { Client } from '@xpert-ai/xpert-sdk';
import { FileImage, Plus, X } from 'lucide-react';
import { FloatingChat } from '../../src/workbench/floating-chat/FloatingChat';
import {
  WorkbenchChatProvider,
  usePublishWorkbenchChat,
  useWorkbenchChat,
} from '../../src/workbench/floating-chat/context';
import { useWorkbenchPanelHost } from '../../src/workbench/useWorkbenchPanelHost';
import { ChatComposerForm } from '../../src/components/chat/composer/ChatComposerForm';
import { ToolbarButton } from '../../src/components/ui/toolbar-button';

/** Production surfaces, synthetic data: no requests leave this preview. */
export function FloatingChatPreview({
  onSideChat,
  onNotice,
}: {
  onSideChat: () => void;
  onNotice: (notice: string) => void;
}) {
  return (
    <WorkbenchChatProvider scope="floating-preview" floating>
      <Surface onSideChat={onSideChat} onNotice={onNotice} />
    </WorkbenchChatProvider>
  );
}

function Surface({
  onSideChat,
  onNotice,
}: {
  onSideChat: () => void;
  onNotice: (notice: string) => void;
}) {
  const host = useWorkbenchPanelHost();
  const chat = useWorkbenchChat();
  return (
    <>
      <FloatingChat
        active
        host={host.attach}
        onOpenChat={() => chat?.setMode('expanded')}
        onNewSideChat={onSideChat}
      />
      {host.container &&
        createPortal(<Conversation onNotice={onNotice} />, host.container)}
    </>
  );
}

function Conversation({ onNotice }: { onNotice: (notice: string) => void }) {
  const chat = useWorkbenchChat();
  const [title, setTitle] = React.useState('规划 ChatKit 侧边聊天升级');
  const [running, setRunning] = React.useState(false);
  const [attachment, setAttachment] = React.useState(false);
  const sidebar = React.useRef({ pinned: false, archived: false });
  const input = React.useRef<HTMLDivElement>(null);
  const record = React.useRef({
    id: 'preview-record',
    threadId: 'preview-thread',
    projectId: 'preview-project',
    title,
  });
  record.current.title = title;
  const client = React.useMemo(() => {
    const client = new Client({ apiUrl: 'https://preview.invalid' });
    client.conversations.get = async () => record.current;
    client.conversations.getSidebar = async () => sidebar.current;
    client.conversations.updateSidebar = async (_, patch) =>
      (sidebar.current = { ...sidebar.current, ...patch });
    client.conversations.searchMessages = async () => ({
      items: [
        {
          id: 'preview-reply',
          role: 'assistant',
          content: '示例回复：标题菜单、附件和草稿在切换窗口大小时保持可用。',
          branching: { available: true },
        },
      ],
      total: 1,
    });
    client.conversations.branch = async () => ({
      id: 'preview-branch',
      threadId: 'preview-branch-thread',
      title: '示例聊天分支',
    });
    return client;
  }, []);
  usePublishWorkbenchChat({
    title,
    running,
    conversationMenu: {
      context: {
        client,
        scopeKey: 'floating-preview',
        ready: true,
        running,
        activeConversationId: 'preview-record',
        activeThreadId: 'preview-thread',
        branchEnabled: true,
        rename: async (_, title) => setTitle(title),
        setSidebar: async (target, patch) => {
          const state = await client.conversations.updateSidebar(
            target.recordId,
            patch,
          );
          onNotice(
            state.archived
              ? '已归档示例会话 · 标题菜单可取消归档'
              : state.pinned
                ? '已置顶示例会话'
                : '已恢复示例会话',
          );
          return state;
        },
        delete: async () => onNotice('已执行示例删除；真实会话未受影响'),
        navigate: () => onNotice('已创建示例聊天分支'),
      },
      target: {
        id: 'preview-thread',
        recordId: 'preview-record',
        projectId: 'preview-project',
        title,
        status: running ? 'busy' : 'idle',
      },
    },
  });
  return (
    <div
      data-chat-presentation={chat?.mode}
      className="flex min-h-0 w-full flex-col"
    >
      {chat?.mode === 'expanded' && (
        <div className="min-h-0 flex-1 overflow-auto p-5 text-sm leading-7">
          <p className="text-muted-foreground">示例会话</p>
          <p>
            标题菜单可重命名、置顶、归档、创建分支、复制导出和删除。使用右上角按钮折叠或最小化，草稿和附件仍会保留。
          </p>
        </div>
      )}
      <div data-slot="chatkit-chat-composer">
        <ChatComposerForm
          onSubmit={(event) => {
            event.preventDefault();
            setRunning(true);
            onNotice('模拟处理中 · 点击停止结束');
          }}
          editor={{
            inputRef: input,
            placeholder: running ? '处理中，你可以继续补充…' : '和 AI 一起工作',
            focus: () => input.current?.focus(),
            'aria-label': '消息',
          }}
          beforeEditor={
            attachment && (
              <div className="m-2 flex w-fit items-center gap-2 rounded-chat-item border bg-muted/30 p-3 text-sm">
                <FileImage className="size-6" />
                示例界面.png
                <ToolbarButton
                  type="button"
                  aria-label="移除附件"
                  onClick={() => setAttachment(false)}
                >
                  <X />
                </ToolbarButton>
              </div>
            )
          }
          leadingActions={
            <ToolbarButton
              type="button"
              className="pointer-events-auto"
              aria-label="添加示例附件"
              onClick={() => setAttachment(true)}
            >
              <Plus />
            </ToolbarButton>
          }
          send={{
            isLoading: running,
            onStop: () => setRunning(false),
            stopLabel: '停止',
            sendLabel: '发送',
          }}
        />
      </div>
    </div>
  );
}
