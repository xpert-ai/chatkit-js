import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ChatKitOptions } from '@xpert-ai/chatkit-types';
import type { MessageNavigationItem } from '../lib/message-navigation';

const mocks = vi.hoisted(() => ({
  refreshThreads: vi.fn().mockResolvedValue(undefined),
  threads: [] as Array<{
    id: string;
    recordId: string;
    title: string;
    status: string;
  }>,
  stream: {
    client: {
      threads: { copy: vi.fn(), get: vi.fn() },
      contexts: {
        fetch: vi.fn(),
        deleteFile: vi.fn(),
      },
      assistants: {
        get: vi.fn(() => new Promise(() => undefined)),
        getRuntimeCapabilities: vi.fn(() => new Promise(() => undefined)),
      },
      conversations: {
        listThreads: vi.fn().mockResolvedValue([]),
        search: vi.fn().mockResolvedValue({ items: [] }),
        update: vi.fn(),
      },
    },
    apiUrl: 'https://api.example.com',
    assistantId: 'assistant-1',
    apiKey: 'secret',
    organizationId: undefined,
    threadId: 'thread-1' as string | null,
    conversationId: 'conversation-1',
    contextUsageByAgentKey: {},
    values: {
      messages: [] as Array<{
        id?: string;
        type: string;
        content: unknown;
        createdAt?: string;
        updatedAt?: string;
        inputCheckpoint?: unknown;
      }>,
    },
    messages: [] as Array<{
      id?: string;
      type: string;
      content: unknown;
      createdAt?: string;
      updatedAt?: string;
      inputCheckpoint?: unknown;
    }>,
    historyMessagePagination: {
      conversationId: null as string | null,
      loadedCount: 0,
      total: 0,
      hasMore: false,
      isLoadingMore: false,
    },
    todos: null,
    runtimeActivities: {
      sandboxServices: {
        providerId: 'sandbox-services',
        services: [],
        isRefreshing: false,
        refreshedAt: null,
        error: null as unknown,
      },
    },
    pendingFollowUps: [],
    pendingRequestUserInput: null,
    pendingHITLRequest: null,
    isLoading: false,
    isDisplayPaused: false,
    displayPause: null as { executionId: string; pauseId: string } | null,
    activeRunId: null as string | null,
    resumeDisplay: vi.fn(),
    isReady: true,
    error: null as unknown,
    loadThread: vi.fn(),
    loadConversationMessages: vi.fn(),
    loadMoreConversationMessages: vi.fn(),
    submit: vi.fn(),
    stop: vi.fn(),
    pauseRun: vi.fn(),
    resumeRun: vi.fn(),
    reset: vi.fn(),
    removePendingFollowUp: vi.fn(),
    canSendPendingFollowUpNow: vi.fn().mockReturnValue(false),
    sendPendingFollowUpNow: vi.fn(),
    promotePendingFollowUpToSteer: vi.fn(),
    submitRequestUserInput: vi.fn(),
    submitHITLDecision: vi.fn(),
    stopRuntimeActivityItem: vi.fn(),
    setThreadId: vi.fn(),
  },
}));

vi.mock('../providers/Stream', () => ({
  useStreamContext: () => mocks.stream,
}));

vi.mock('../hooks/useStream', () => ({
  useStreamManager: () => ({
    stream: mocks.stream,
    streamRef: { current: mocks.stream },
    setStream: vi.fn(),
  }),
}));

vi.mock('../hooks/useThreads', () => ({
  useThreads: () => ({
    threads: mocks.threads,
    deleteThread: vi.fn(),
    refreshThreads: mocks.refreshThreads,
    isLoading: false,
  }),
}));

vi.mock('../i18n/useChatkitTranslation', () => ({
  useChatkitTranslation: () => ({
    t: (key: string, options?: { count?: number; defaultValue?: string }) => {
      const labels: Record<string, string> = {
        'chat.title': 'Chat',
        'chat.statusOnline': 'Online',
        'chat.youLabel': 'You',
        'chat.placeholder': 'Type a message...',
        'message.reasoning': 'Reasoning',
        'message.navigation.label': 'Message navigation',
        'message.navigation.system': 'System',
        'message.navigation.tool': 'Tool',
        'message.navigation.event': 'Event',
        'message.navigation.message': 'Message',
        'message.navigation.image': 'Image',
        'message.navigation.memory': 'Memory',
        'message.navigation.widget': 'Widget',
        'message.navigation.mcpApp': 'MCP App',
        'message.navigation.attachment': 'Attachment',
        'message.navigation.reference': 'Reference',
        'message.navigation.capability': 'Capability',
        'message.navigation.moreTags': `+${options?.count ?? 0}`,
      };
      return labels[key] ?? options?.defaultValue ?? key;
    },
    i18n: { language: 'en-US' },
  }),
}));

vi.mock('../providers/Theme', () => ({
  useTheme: () => ({
    theme: { radius: 'soft' },
    isDarkMode: false,
  }),
}));

vi.mock('../hooks/useParentMessenger', () => ({
  useParentMessenger: () => undefined,
}));

vi.mock('./thread/MessageNavigator', () => ({
  MessageNavigator: ({
    items,
    label,
  }: {
    items: MessageNavigationItem[];
    label: string;
  }) => (
    <nav aria-label={label} data-count={items.length} data-testid="message-nav">
      {items.map((item) => (
        <button key={item.id} type="button">
          {item.preview}
        </button>
      ))}
    </nav>
  ),
}));

vi.mock('./composer/ComposerMenu', () => ({
  ComposerMenu: () => <div data-testid="composer-menu" />,
}));

vi.mock('./history/HistorySidebar', () => ({
  HistorySidebar: () => null,
}));

vi.mock('./composer/pending-follow-ups', () => ({
  PendingFollowUps: () => null,
}));

vi.mock('./composer/pending-todos', () => ({
  PendingTodos: () => null,
}));

vi.mock('./composer/pending-runtime-services', () => ({
  PendingRuntimeServices: () => null,
}));

vi.mock('./composer/request-user-input-panel', () => ({
  RequestUserInputPanel: () => null,
}));

vi.mock('./composer/hitl-approval-panel', () => ({
  HITLApprovalPanel: () => null,
}));

vi.mock('./thread/messages/ai', () => ({
  AssistantMessage: ({ isStreaming }: { isStreaming: boolean }) =>
    isStreaming ? <span data-testid="streaming-output" /> : null,
  AssistantStreamingIndicator: () => <span data-testid="streaming-output" />,
}));


vi.mock('./ui/chatkit-avatar', () => ({
  ChatkitAvatar: () => null,
  extractAssistantAvatar: () => null,
}));

vi.mock('./thread/context-usage-indicator', () => ({
  ContextUsageIndicator: () => null,
}));

import { Chat } from './chat';

const baseOptions: ChatKitOptions = {
  api: {
    apiUrl: 'https://api.example.com',
    xpertId: 'assistant-1',
    getClientSecret: async () => 'secret',
  },
};

function setMessages(count = 3) {
  mocks.stream.messages = Array.from({ length: count }, (_, index) => [
    {
      id: `human-${index + 1}`,
      type: 'human',
      content: `User message ${index + 1}`,
    },
    {
      id: `assistant-${index + 1}`,
      type: 'ai',
      content: `AI message ${index + 1}`,
    },
  ]).flat();
  mocks.stream.values = { messages: mocks.stream.messages };
}

describe('Chat message navigation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.threads.splice(0);
    mocks.stream.threadId = 'thread-1';
    mocks.stream.isLoading = false;
    mocks.stream.isDisplayPaused = false;
    mocks.stream.displayPause = null;
    mocks.stream.activeRunId = null;
    mocks.stream.resumeDisplay.mockReset().mockResolvedValue(undefined);
    mocks.stream.client.conversations.listThreads.mockResolvedValue([]);
    mocks.stream.client.threads.get.mockReset().mockResolvedValue({
      thread_id: 'thread-1',
      status: 'busy',
      runControl: { executionId: 'source-run', state: 'running' },
    });
    mocks.stream.pauseRun.mockReset().mockResolvedValue(undefined);
    mocks.stream.resumeRun.mockReset().mockResolvedValue(undefined);
    mocks.stream.client.threads.copy.mockReset().mockResolvedValue({
      thread_id: 'edited-branch',
    });
    mocks.stream.loadThread.mockReset().mockImplementation(async (id: string) => {
      mocks.stream.threadId = id;
    });
    mocks.stream.submit.mockReset().mockResolvedValue(undefined);
    setMessages(3);
  });

  async function editSecondMessage() {
    mocks.stream.isLoading = true;
    mocks.stream.client.conversations.listThreads.mockResolvedValue([
      { thread_id: 'thread-1', status: 'busy' },
    ]);
    const rendered = render(<Chat options={baseOptions} />);
    await waitFor(() =>
      expect(screen.getAllByRole('button', { name: 'threadControl.editMessage' })).toHaveLength(3),
    );
    fireEvent.click(screen.getAllByRole('button', { name: 'threadControl.editMessage' })[1]);
    fireEvent.change(screen.getByRole('textbox', { name: 'threadControl.editMessage' }), {
      target: { value: 'Revised question' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'threadControl.saveBranch' }));
    return rendered;
  }

  it('hides editing for inputs without a saved checkpoint and replaces the bubble while editing', async () => {
    mocks.stream.client.conversations.listThreads.mockResolvedValue([
      { thread_id: 'thread-1', status: 'idle' },
    ]);
    mocks.stream.messages[0] = { ...mocks.stream.messages[0], inputCheckpoint: null };
    mocks.stream.messages[2] = {
      ...mocks.stream.messages[2],
      inputCheckpoint: { version: 1, checkpoint: null, graphRevision: 'rev' },
    };
    mocks.stream.values = { messages: mocks.stream.messages };
    render(<Chat options={baseOptions} />);
    await waitFor(() =>
      expect(screen.getAllByRole('button', { name: 'threadControl.editMessage' })).toHaveLength(2),
    );
    expect(screen.getByText('User message 2')).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole('button', { name: 'threadControl.editMessage' })[0]);
    expect(screen.getByRole('textbox', { name: 'threadControl.editMessage' })).toHaveValue('User message 2');
    expect(screen.queryByText('User message 2', { ignore: 'script, style, textarea' })).toBeNull();
    expect(screen.queryByText('threadControl.editHint')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'threadControl.discardEdit' }));
    expect(screen.getByText('User message 2')).toBeInTheDocument();
  });

  it('shows message navigation by default once enough messages are loaded', () => {
    render(<Chat options={baseOptions} />);

    expect(screen.getByTestId('message-nav')).toHaveAttribute(
      'data-count',
      '3',
    );
    expect(
      screen.getByRole('button', { name: 'AI message 1' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('navigation', { name: 'Message navigation' }),
    ).toBeInTheDocument();
  });

  it('hides message navigation when disabled through ChatKit options', () => {
    render(
      <Chat
        options={{
          ...baseOptions,
          messageNavigation: { enabled: false },
        }}
      />,
    );

    expect(screen.queryByTestId('message-nav')).not.toBeInTheDocument();
  });

  it('updates navigation items when older history messages are added', () => {
    const { rerender } = render(<Chat options={baseOptions} />);
    expect(screen.getByTestId('message-nav')).toHaveAttribute(
      'data-count',
      '3',
    );

    setMessages(4);
    rerender(<Chat options={baseOptions} />);

    expect(screen.getByTestId('message-nav')).toHaveAttribute(
      'data-count',
      '4',
    );
  });

  it('shows the current thread title in the header status row', () => {
    mocks.threads.push({
      id: 'thread-1',
      recordId: 'conversation-1',
      title: 'Fix onboarding copy',
      status: 'idle',
    });

    render(<Chat options={baseOptions} />);

    expect(screen.getByText('Fix onboarding copy')).toBeInTheDocument();
    expect(screen.queryByText('Online')).not.toBeInTheDocument();
  });

  it.each([true, false])('pauses from the composer and prevents duplicate requests (streaming: %s)', async (isLoading) => {
    let acceptPause!: () => void;
    mocks.stream.isLoading = isLoading;
    mocks.stream.client.conversations.listThreads.mockResolvedValue([{
      thread_id: 'thread-1', status: 'busy',
      runControl: { executionId: 'source-run', state: 'running' },
    }]);
    mocks.stream.pauseRun.mockReturnValue(new Promise<void>((resolve) => { acceptPause = resolve; }));
    render(<Chat options={baseOptions} />);
    const button = await screen.findByRole('button', { name: 'threadControl.pause' });
    expect(screen.getAllByRole('button', { name: 'threadControl.pause' })).toHaveLength(1);
    expect(button.closest('form')).not.toBeNull();
    expect(button).not.toBeDisabled();
    fireEvent.click(button);
    const resume = screen.getByRole('button', { name: 'threadControl.resume' });
    expect(resume.querySelector('.lucide-play')).toBeInTheDocument();
    expect(resume.querySelector('.lucide-square')).toBeNull();
    expect(resume).toBeDisabled();
    fireEvent.click(resume);
    expect(mocks.stream.resumeRun).not.toHaveBeenCalled();
    expect(mocks.stream.pauseRun).toHaveBeenCalledExactlyOnceWith('source-run');
    expect(mocks.stream.stop).not.toHaveBeenCalled();
    mocks.stream.client.conversations.listThreads.mockResolvedValue([{
      thread_id: 'thread-1', status: 'paused',
      runControl: { executionId: 'source-run', state: 'paused', pauseId: 'pause-1' },
    }]);
    await act(async () => { acceptPause(); });
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'threadControl.resume' })).not.toBeDisabled(),
    );
    fireEvent.click(screen.getByRole('button', { name: 'threadControl.resume' }));
    await waitFor(() => expect(mocks.stream.resumeRun).toHaveBeenCalledExactlyOnceWith('source-run', 'pause-1'));
  });

  it('keeps the resume icon while the visible output is paused and server state is catching up', async () => {
    mocks.stream.isLoading = true;
    mocks.stream.isDisplayPaused = true;
    mocks.stream.client.conversations.listThreads.mockResolvedValue([{
      thread_id: 'thread-1', status: 'busy',
      runControl: { executionId: 'source-run', state: 'running' },
    }]);
    render(<Chat options={baseOptions} />);
    await waitFor(() => expect(mocks.stream.client.conversations.listThreads).toHaveBeenCalled());
    const resume = screen.getByRole('button', { name: 'threadControl.resume' });
    expect(resume.querySelector('.lucide-play')).toBeInTheDocument();
    expect(resume).toBeDisabled();
    fireEvent.click(resume);
    expect(mocks.stream.pauseRun).not.toHaveBeenCalled();
    expect(mocks.stream.resumeRun).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'threadControl.pause' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'chat.stop' })).toBeNull();
  });

  it('lets the composer pause action retry after failure without cancelling the run', async () => {
    mocks.stream.isLoading = true;
    mocks.stream.client.conversations.listThreads.mockResolvedValue([{
      thread_id: 'thread-1', status: 'busy',
      runControl: { executionId: 'source-run', state: 'running' },
    }]);
    mocks.stream.pauseRun.mockRejectedValueOnce(new Error('Pause failed'));
    render(<Chat options={baseOptions} />);
    fireEvent.click(await screen.findByRole('button', { name: 'threadControl.pause' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Pause failed');
    const retry = screen.getByRole('button', { name: 'threadControl.pause' });
    expect(retry.closest('form')).not.toBeNull();
    expect(retry).not.toBeDisabled();
    fireEvent.click(retry);
    await waitFor(() => expect(mocks.stream.pauseRun).toHaveBeenCalledTimes(2));
    expect(mocks.stream.stop).not.toHaveBeenCalled();
  });

  it('hides streaming indicators immediately while the backend stream is still running', () => {
    mocks.stream.isLoading = true;
    const { rerender } = render(<Chat options={baseOptions} />);
    expect(screen.getAllByTestId('streaming-output').length).toBeGreaterThan(0);
    mocks.stream.isDisplayPaused = true;
    rerender(<Chat options={baseOptions} />);
    expect(screen.queryByTestId('streaming-output')).toBeNull();
    expect(mocks.stream.stop).not.toHaveBeenCalled();
  });

  it('keeps pause disabled until a run id exists and never cancels the run', () => {
    mocks.stream.isLoading = true;
    render(<Chat options={baseOptions} />);
    const pause = screen.getByRole('button', { name: 'threadControl.pause' });
    expect(pause).toBeDisabled();
    fireEvent.click(pause);
    expect(mocks.stream.stop).not.toHaveBeenCalled();
    expect(mocks.stream.pauseRun).not.toHaveBeenCalled();
  });

  it('pauses with the stream run id once it exists', async () => {
    mocks.stream.isLoading = true;
    mocks.stream.activeRunId = 'stream-run';
    render(<Chat options={baseOptions} />);
    fireEvent.click(screen.getByRole('button', { name: 'threadControl.pause' }));
    await waitFor(() => expect(mocks.stream.pauseRun).toHaveBeenCalledExactlyOnceWith('stream-run'));
    expect(mocks.stream.stop).not.toHaveBeenCalled();
  });

  it('reveals a completed background run from the resume control without starting another execution', async () => {
    mocks.stream.isDisplayPaused = true;
    mocks.stream.displayPause = { executionId: 'finished', pauseId: 'pause-token' };
    mocks.stream.client.conversations.listThreads.mockResolvedValue([{ thread_id: 'thread-1', status: 'idle' }]);
    render(<Chat options={baseOptions} />);
    const resume = await screen.findByRole('button', { name: 'threadControl.resume' });
    await waitFor(() => expect(resume).not.toBeDisabled());
    fireEvent.click(resume);
    await waitFor(() => expect(mocks.stream.resumeDisplay).toHaveBeenCalledTimes(1));
    expect(mocks.stream.resumeRun).not.toHaveBeenCalled();
  });

  it('uses the composer to send a new instruction instead of resuming when edited', async () => {
    mocks.stream.isLoading = true;
    mocks.stream.client.conversations.listThreads.mockResolvedValue([{
      thread_id: 'thread-1', status: 'paused',
      runControl: { executionId: 'source-run', state: 'paused', pauseId: 'pause-1' },
    }]);
    render(<Chat options={baseOptions} />);
    const resume = await screen.findByRole('button', { name: 'threadControl.resume' });
    expect(resume.closest('form')).not.toBeNull();
    expect(screen.getAllByRole('button', { name: 'threadControl.resume' })).toHaveLength(1);
    expect(screen.queryByRole('button', { name: 'threadControl.cancelRun' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'chat.stop' })).toBeNull();
    const textbox = screen.getByRole('textbox');
    textbox.textContent = 'New instruction';
    fireEvent.input(textbox);
    await waitFor(() => expect(screen.getByRole('button', { name: 'chat.send' })).not.toBeDisabled());
    expect(screen.queryByRole('button', { name: 'threadControl.resume' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'chat.send' }));
    await waitFor(() => expect(mocks.stream.submit).toHaveBeenCalled());
    expect(mocks.stream.submit.mock.calls[0][1].followUpMode).toBeUndefined();
    expect(mocks.stream.resumeRun).not.toHaveBeenCalled();
  });
  it('resumes from the composer, blocks duplicate clicks, and allows retry after failure', async () => {
    let rejectResume!: (error: Error) => void;
    mocks.stream.client.conversations.listThreads.mockResolvedValue([{
      thread_id: 'thread-1', status: 'paused',
      runControl: { executionId: 'source-run', state: 'paused', pauseId: 'pause-1' },
    }]);
    mocks.stream.resumeRun.mockReturnValueOnce(new Promise((_resolve, reject) => { rejectResume = reject; }));
    render(<Chat options={baseOptions} />);
    const resume = await screen.findByRole('button', { name: 'threadControl.resume' });
    fireEvent.click(resume);
    expect(resume).toBeDisabled();
    fireEvent.click(resume);
    expect(mocks.stream.resumeRun).toHaveBeenCalledExactlyOnceWith('source-run', 'pause-1');
    await act(async () => { rejectResume(new Error('Resume failed')); });
    expect(await screen.findByRole('alert')).toHaveTextContent('Resume failed');
    expect(resume).not.toBeDisabled();
    fireEvent.click(resume);
    await waitFor(() => expect(mocks.stream.resumeRun).toHaveBeenCalledTimes(2));
    expect(mocks.stream.submit).not.toHaveBeenCalled();
  });

  it.each([
    undefined,
    {
      state: { human: { businessId: 'order-42', input: 'must be replaced' }, locale: 'zh-CN' },
      context: { targetXpertId: 'target-xpert', env: { workspaceId: 'workspace-1' } },
      config: { recursion_limit: 30 },
    },
  ])('forks the selected message and pauses the source before continuing with request defaults %j', async (request) => {
    mocks.stream.isLoading = true;
    mocks.stream.client.conversations.listThreads.mockResolvedValue([
      { thread_id: 'thread-1', status: 'busy' },
    ]);
    mocks.stream.client.threads.copy.mockResolvedValue({
      thread_id: 'edited-branch',
    });
    mocks.stream.loadThread.mockImplementation(async (id: string) => {
      mocks.stream.threadId = id;
    });
    mocks.stream.submit.mockResolvedValue(undefined);
    render(<Chat options={{ ...baseOptions, request }} />);
    await waitFor(() =>
      expect(
        screen.getAllByRole('button', { name: 'threadControl.editMessage' }),
      ).toHaveLength(3),
    );
    fireEvent.click(
      screen.getAllByRole('button', { name: 'threadControl.editMessage' })[1],
    );
    fireEvent.change(
      screen.getByRole('textbox', { name: 'threadControl.editMessage' }),
      { target: { value: 'Revised question' } },
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'threadControl.saveBranch' }),
    );
    await waitFor(() => expect(mocks.stream.submit).toHaveBeenCalled());
    expect(mocks.stream.client.threads.copy).toHaveBeenCalledWith('thread-1', {
      beforeMessageId: 'human-2',
      requestId: expect.any(String),
    });
    expect(mocks.stream.loadThread).toHaveBeenCalledWith('edited-branch');
    expect(mocks.stream.pauseRun).toHaveBeenCalledWith('source-run');
    expect(mocks.stream.client.threads.copy.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.stream.pauseRun.mock.invocationCallOrder[0],
    );
    expect(mocks.stream.pauseRun.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.stream.loadThread.mock.invocationCallOrder[0],
    );
    expect(mocks.stream.submit).toHaveBeenCalledWith(
      expect.objectContaining({
        input: expect.objectContaining({ input: 'Revised question' }),
      }),
      expect.objectContaining({
        threadId: 'edited-branch',
        joinExistingThread: true,
      }),
    );
    expect(mocks.stream.stop).not.toHaveBeenCalled();
    if (request) {
      expect(mocks.stream.submit).toHaveBeenCalledWith(
        expect.objectContaining({
          state: {
            human: expect.objectContaining({ businessId: 'order-42', input: 'Revised question' }),
            locale: 'zh-CN',
          },
        }),
        expect.objectContaining({ context: request.context, config: request.config }),
      );
    }
  });

  it('waits for pause acceptance before starting the new branch', async () => {
    let acceptPause!: () => void;
    mocks.stream.pauseRun.mockReturnValue(new Promise<void>((resolve) => { acceptPause = resolve; }));
    await editSecondMessage();
    await waitFor(() => expect(mocks.stream.pauseRun).toHaveBeenCalledWith('source-run'));
    expect(mocks.stream.loadThread).not.toHaveBeenCalled();
    expect(mocks.stream.submit).not.toHaveBeenCalled();
    await act(async () => { acceptPause(); });
    await waitFor(() => expect(mocks.stream.submit).toHaveBeenCalled());
    // No polling for full pause completion is needed before starting the fork.
    expect(mocks.stream.client.threads.get).toHaveBeenCalledTimes(1);
    expect(mocks.stream.stop).not.toHaveBeenCalled();
  });

  it.each(['idle', 'paused', 'pausing', 'interrupted', 'error'])(
    'continues without another pause when the source is %s', async (status) => {
      mocks.stream.client.threads.get.mockResolvedValue({ thread_id: 'thread-1', status });
      await editSecondMessage();
      await waitFor(() => expect(mocks.stream.submit).toHaveBeenCalled());
      expect(mocks.stream.pauseRun).not.toHaveBeenCalled();
      expect(mocks.stream.stop).not.toHaveBeenCalled();
    },
  );

  it('keeps the edit and source selected on pause failure and reuses the fork request on retry', async () => {
    mocks.stream.pauseRun.mockRejectedValueOnce(new Error('Pause unavailable'));
    await editSecondMessage();
    expect(await screen.findByRole('alert')).toHaveTextContent('Pause unavailable');
    expect(mocks.stream.threadId).toBe('thread-1');
    expect(mocks.stream.reset).not.toHaveBeenCalled();
    expect(mocks.stream.submit).not.toHaveBeenCalled();
    expect(screen.getByRole('textbox', { name: 'threadControl.editMessage' })).toHaveValue('Revised question');
    fireEvent.click(screen.getByRole('button', { name: 'threadControl.saveBranch' }));
    await waitFor(() => expect(mocks.stream.submit).toHaveBeenCalledTimes(1));
    expect(mocks.stream.client.threads.copy.mock.calls[1]).toEqual(mocks.stream.client.threads.copy.mock.calls[0]);
    expect(mocks.stream.stop).not.toHaveBeenCalled();
  });

  it('continues when the source finishes before the pause request arrives', async () => {
    mocks.stream.client.threads.get.mockResolvedValueOnce({
      thread_id: 'thread-1', status: 'busy',
      runControl: { executionId: 'source-run', state: 'running' },
    }).mockResolvedValueOnce({ thread_id: 'thread-1', status: 'idle' });
    mocks.stream.pauseRun.mockRejectedValueOnce(new Error('Run no longer active'));
    await editSecondMessage();
    await waitFor(() => expect(mocks.stream.submit).toHaveBeenCalled());
    expect(mocks.stream.pauseRun).toHaveBeenCalledTimes(1);
  });

  it('does not pause a replacement run or start the fork after a run identity conflict', async () => {
    mocks.stream.client.threads.get.mockResolvedValueOnce({
      thread_id: 'thread-1', status: 'busy',
      runControl: { executionId: 'source-run', state: 'running' },
    }).mockResolvedValueOnce({
      thread_id: 'thread-1', status: 'busy',
      runControl: { executionId: 'replacement-run', state: 'running' },
    });
    mocks.stream.pauseRun.mockRejectedValueOnce(new Error('Run no longer active'));
    await editSecondMessage();
    expect(await screen.findByRole('alert')).toHaveTextContent('Run no longer active');
    expect(mocks.stream.pauseRun).toHaveBeenCalledExactlyOnceWith('source-run');
    expect(mocks.stream.submit).not.toHaveBeenCalled();
  });

  it('blocks continuation if an active source has no pause identity', async () => {
    mocks.stream.client.threads.get.mockResolvedValue({ thread_id: 'thread-1', status: 'busy' });
    await editSecondMessage();
    expect(await screen.findByRole('alert')).toHaveTextContent('threadControl.sourcePauseUnavailable');
    expect(mocks.stream.pauseRun).not.toHaveBeenCalled();
    expect(mocks.stream.submit).not.toHaveBeenCalled();
  });

  it('does not pause or switch branches when a fork response arrives after navigation', async () => {
    let finishCopy!: (branch: { thread_id: string }) => void;
    mocks.stream.client.threads.copy.mockReturnValue(new Promise((resolve) => { finishCopy = resolve; }));
    const { rerender } = await editSecondMessage();
    await waitFor(() => expect(mocks.stream.client.threads.copy).toHaveBeenCalled());
    mocks.stream.threadId = 'other-thread';
    rerender(<Chat options={baseOptions} />);
    await act(async () => { finishCopy({ thread_id: 'edited-branch' }); });
    expect(mocks.stream.pauseRun).not.toHaveBeenCalled();
    expect(mocks.stream.loadThread).not.toHaveBeenCalled();
    expect(mocks.stream.submit).not.toHaveBeenCalled();
  });
});
