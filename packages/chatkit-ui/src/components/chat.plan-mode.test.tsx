import React from 'react';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  return {
    stream: {
      client: {
        contexts: {
          uploadFile: vi.fn(),
          deleteFile: vi.fn(),
        },
        assistants: {
          get: vi.fn().mockResolvedValue(null),
          getModels: vi.fn(),
          setModelPreference: vi.fn(),
          getRuntimeCapabilities: vi.fn().mockRejectedValue({ status: 404 }),
        },
        conversations: {
          search: vi.fn().mockResolvedValue({ items: [] }),
          update: vi.fn(),
        },
        projects: {
          listFiles: vi.fn().mockResolvedValue([]),
        },
        xperts: {
          listWorkspaceFiles: vi.fn().mockResolvedValue([]),
        },
      },
      apiUrl: 'https://api.example.com',
      assistantId: 'assistant-1',
      apiKey: 'secret',
      organizationId: undefined,
      threadId: null as string | null,
      conversationId: null as string | null,
      contextUsageByAgentKey: {},
      values: { messages: [] },
      messages: [] as Array<{
        id?: string;
        type: string;
        content: unknown;
        createdAt?: string;
        updatedAt?: string;
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
      isReady: true,
      error: null as unknown,
      selectedModelId: null as string | null,
      setSelectedModelId: vi.fn(),
      loadThread: vi.fn(),
      loadConversationMessages: vi.fn(),
      loadMoreConversationMessages: vi.fn(),
      submit: vi.fn(),
      stop: vi.fn(),
      reset: vi.fn(),
      removePendingFollowUp: vi.fn(),
      canSendPendingFollowUpNow: vi.fn().mockReturnValue(false),
      sendPendingFollowUpNow: vi.fn(),
      promotePendingFollowUpToSteer: vi.fn(),
      submitRequestUserInput: vi.fn(),
      submitHITLDecision: vi.fn(),
      stopRuntimeActivityItem: vi.fn(),
      setThreadId: vi.fn(),
      connectorBindingIds: [] as string[],
      setConnectorBindingIds: vi.fn().mockResolvedValue(undefined),
    },
    parentMessengerOptions: null as null | {
      onSetComposerValue?: (payload: unknown) => void;
    },
    parentSendCommand: vi.fn().mockResolvedValue(undefined),
    parentSendEvent: vi.fn(),
  };
});

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
    threads: [],
    deleteThread: vi.fn(),
    refreshThreads: vi.fn().mockResolvedValue(undefined),
    isLoading: false,
  }),
}));

vi.mock('../i18n/useChatkitTranslation', () => ({
  useChatkitTranslation: () => ({
    t: (key: string, options?: { defaultValue?: string }) => {
      const labels: Record<string, string> = {
        'composer.slashCommands.commands.plan.label': 'Localized Plan',
        'composer.slashCommands.commands.plan.description':
          'Localized plan mode',
        'composer.slashCommands.commands.plugins.label': 'Localized Plugins',
        'composer.slashCommands.commands.plugins.description':
          'Localized runtime plugins',
        'composer.slashCommands.empty.plugins': 'No localized plugins to add',
        'chat.loadMoreMessages': 'Load more',
        'chat.loadingMoreMessages': 'Loading...',
      };
      return labels[key] ?? options?.defaultValue ?? key;
    },
    i18n: {
      language: 'en-US',
    },
  }),
}));

vi.mock('../providers/Theme', () => ({
  useTheme: () => ({
    theme: {
      radius: 'soft',
    },
    isDarkMode: false,
  }),
}));

vi.mock('../hooks/useParentMessenger', () => ({
  useParentMessenger: (options?: {
    onSetComposerValue?: (payload: unknown) => void;
  }) => {
    if (options?.onSetComposerValue) {
      mocks.parentMessengerOptions = options;
    }
    return {
      isParentAvailable: false,
      sendCommand: mocks.parentSendCommand,
      sendEvent: mocks.parentSendEvent,
    };
  },
}));

vi.mock('./composer/ComposerMenu', () => ({
  ComposerMenu: ({
    planModeEnabled,
    onPlanModeChange,
    goalCommandAvailable,
    goalPanelOpen,
    onGoalPanelOpenChange,
    runtimeCapabilities,
    selectedRuntimeCapabilities,
    onRuntimeCapabilityToggle,
  }: {
    planModeEnabled?: boolean;
    onPlanModeChange?: (enabled: boolean) => void;
    goalCommandAvailable?: boolean;
    goalPanelOpen?: boolean;
    onGoalPanelOpenChange?: (open: boolean) => void;
    runtimeCapabilities?: unknown;
    selectedRuntimeCapabilities?: {
      plugins: { nodeKeys: string[] };
      subAgents?: { nodeKeys: string[] };
    } | null;
    onRuntimeCapabilityToggle?: (
      type: 'skill' | 'plugin' | 'subAgent',
      id: string,
      selected: boolean,
    ) => void;
  }) => (
    <div>
      <button
        type="button"
        data-testid="plan-mode-toggle"
        onClick={() => onPlanModeChange?.(!planModeEnabled)}
      >
        {planModeEnabled ? 'plan-on' : 'plan-off'}
      </button>
      <span data-testid="selected-plugins">
        {selectedRuntimeCapabilities?.plugins.nodeKeys.join(',') ?? ''}
      </span>
      <span data-testid="selected-sub-agents">
        {selectedRuntimeCapabilities?.subAgents?.nodeKeys.join(',') ?? ''}
      </span>
      <span data-testid="runtime-capabilities-ready">
        {runtimeCapabilities ? 'ready' : 'not-ready'}
      </span>
      <span data-testid="goal-command-available">
        {goalCommandAvailable ? 'goal-ready' : 'goal-hidden'}
      </span>
      <button
        type="button"
        data-testid="goal-command"
        onClick={() => onGoalPanelOpenChange?.(!goalPanelOpen)}
      >
        {goalPanelOpen ? 'goal-on' : 'goal-off'}
      </button>
      <button
        type="button"
        data-testid="select-plugin"
        onClick={() =>
          onRuntimeCapabilityToggle?.('plugin', 'middleware-1', true)
        }
      >
        select plugin
      </button>
      <button
        type="button"
        data-testid="clear-plugin"
        onClick={() =>
          onRuntimeCapabilityToggle?.('plugin', 'middleware-1', false)
        }
      >
        clear plugin
      </button>
      <button
        type="button"
        data-testid="select-sub-agent"
        onClick={() =>
          onRuntimeCapabilityToggle?.('subAgent', 'researcher', true)
        }
      >
        select sub-agent
      </button>
    </div>
  ),
}));

vi.mock('./composer/SendButton', () => ({
  SendButton: ({ disabled }: { disabled?: boolean }) => (
    <button type="submit" disabled={disabled}>
      send
    </button>
  ),
}));

vi.mock('./composer/ProjectSelector', () => ({
  ProjectSelector: ({
    activeProjectId,
    disabled,
    onAvailabilityChange,
    onProjectChange,
  }: {
    activeProjectId?: string;
    disabled?: boolean;
    onAvailabilityChange?: (available: boolean) => void;
    onProjectChange?: (projectId: string | null) => void;
  }) => {
    React.useEffect(() => {
      onAvailabilityChange?.(true);
    }, [onAvailabilityChange]);

    return (
      <div
        data-slot="composer-project-rail"
        className="flex h-10 min-w-0 items-center px-1"
      >
        <button
          type="button"
          data-testid="project-selector"
          disabled={disabled}
          onClick={() => onProjectChange?.('project-2')}
        >
          {activeProjectId ?? 'select project'}
        </button>
      </div>
    );
  },
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

vi.mock('./thread/messages/ai', () => ({
  AssistantMessage: () => null,
  AssistantStreamingIndicator: () => null,
}));

vi.mock('./thread/MessageActions', () => ({
  MessageActions: ({ content }: { content: string }) => (
    <div data-testid={`message-actions-${content}`} />
  ),
}));

vi.mock('./thread/StartScreen', () => ({
  StartScreen: () => null,
}));

vi.mock('./ui/chatkit-avatar', () => ({
  ChatkitAvatar: () => null,
  extractAssistantAvatar: () => null,
  normalizeChatkitAvatar: (avatar: unknown) => avatar,
}));

vi.mock('./thread/context-usage-indicator', () => ({
  ContextUsageIndicator: () => <span data-testid="context-usage" />,
}));

vi.mock('./ui/button', () => ({
  Button: ({
    children,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button type="button" {...props}>
      {children}
    </button>
  ),
}));

import type {
  ChatKitGoalAdapter,
  ChatKitOptions,
  ThreadGoal,
} from '@xpert-ai/chatkit-types';
import { Chat } from './chat';

const baseChatOptions: ChatKitOptions = {
  api: {
    apiUrl: 'https://api.example.com',
    getClientSecret: async () => ({ secret: 'secret' }),
  },
};

function renderChat(extraOptions: Partial<ChatKitOptions> = {}) {
  return render(
    <Chat
      clientSecret="secret"
      options={{
        ...baseChatOptions,
        ...extraOptions,
      }}
    />,
  );
}

const goalRuntimeCapabilities = {
  skills: [],
  plugins: [],
  subAgents: [],
  commands: [
    {
      name: 'goal',
      label: 'Goal',
      action: {
        type: 'insert_invocation',
        template: '/goal {{args}}',
      },
    },
  ],
};

const selectableGoalRuntimeCapabilities = {
  skills: [],
  plugins: [
    {
      nodeKey: 'middleware-1',
      provider: 'ralph-loop',
      label: 'Ralph Loop',
    },
  ],
  subAgents: [],
  commands: [
    {
      name: 'goal',
      label: 'Goal',
      action: {
        type: 'client_action',
        action: {
          type: 'chatkit.conversation_goal.command',
        },
        runtimeCapabilities: {
          mode: 'allowlist',
          skills: {
            ids: [],
          },
          plugins: {
            nodeKeys: ['middleware-1'],
          },
          subAgents: {
            nodeKeys: [],
          },
        },
      },
    },
  ],
};

function enableGoalRuntimeCommand() {
  mocks.stream.client.assistants.getRuntimeCapabilities.mockResolvedValue(
    goalRuntimeCapabilities,
  );
}

function enableSelectableGoalRuntimeCommand() {
  mocks.stream.client.assistants.getRuntimeCapabilities.mockResolvedValue(
    selectableGoalRuntimeCapabilities,
  );
}

function createGoalAdapter(
  overrides: Partial<ChatKitGoalAdapter> = {},
): ChatKitGoalAdapter {
  return {
    getGoal: vi.fn(async () => null),
    setGoal: vi.fn(async ({ threadId, objective }) => ({
      threadId: threadId ?? 'thread-1',
      goal: {
        id: 'goal-1',
        threadId: threadId ?? 'thread-1',
        objective,
        status: 'active' as const,
        tokensUsed: 0,
        elapsedSeconds: 0,
        continuationCount: 0,
      },
    })),
    updateGoal: vi.fn(async ({ threadId, objective, status }) => ({
      id: 'goal-1',
      threadId,
      objective: objective ?? 'ship feature',
      status: (status ?? 'active') as ThreadGoal['status'],
      tokensUsed: 0,
      elapsedSeconds: 0,
      continuationCount: 0,
    })),
    clearGoal: vi.fn(async () => null),
    ...overrides,
  };
}

function getSubmittedOptimisticMessages(callIndex = 0) {
  const submitOptions = mocks.stream.submit.mock.calls[callIndex]?.[1];
  const optimisticValues = submitOptions?.optimisticValues;

  expect(optimisticValues).toBeTypeOf('function');

  return optimisticValues({ messages: [] }).messages;
}

function setComposerText(element: HTMLElement, value: string) {
  element.textContent = value;
  placeComposerCaretAtEnd(element);
  fireEvent.input(element);
  return screen.getByRole('textbox');
}

function insertComposerText(element: HTMLElement, value: string) {
  const selection = window.getSelection();
  const range =
    selection && selection.rangeCount > 0
      ? selection.getRangeAt(0)
      : document.createRange();

  if (!selection || selection.rangeCount === 0) {
    range.selectNodeContents(element);
    range.collapse(false);
  }

  range.deleteContents();
  const text = document.createTextNode(value);
  range.insertNode(text);
  range.setStartAfter(text);
  range.collapse(true);
  selection?.removeAllRanges();
  selection?.addRange(range);
  fireEvent.input(element);
  return screen.getByRole('textbox');
}

function placeComposerCaretAtEnd(element: HTMLElement) {
  const range = document.createRange();
  range.selectNodeContents(element);
  range.collapse(false);
  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
}

describe('Chat plan mode payload', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    globalThis.fetch = vi.fn(async () => new Response(null, { status: 404 }));
    mocks.stream.client.assistants.getRuntimeCapabilities.mockReset();
    mocks.stream.client.assistants.getRuntimeCapabilities.mockRejectedValue({
      status: 404,
    });
    mocks.stream.client.assistants.getModels.mockReset();
    mocks.stream.client.assistants.getModels.mockRejectedValue({ status: 404 });
    mocks.stream.client.assistants.setModelPreference.mockReset();
    mocks.stream.client.assistants.setModelPreference.mockResolvedValue({});
    mocks.stream.selectedModelId = null;
    mocks.stream.setSelectedModelId.mockReset();
    mocks.stream.setSelectedModelId.mockImplementation(
      (modelId: string | null) => {
        mocks.stream.selectedModelId = modelId;
      },
    );
    mocks.stream.client.conversations.search.mockClear();
    mocks.stream.client.conversations.search.mockResolvedValue({ items: [] });
    mocks.stream.client.conversations.update.mockClear();
    mocks.stream.client.projects.listFiles.mockClear();
    mocks.stream.client.projects.listFiles.mockResolvedValue([]);
    mocks.stream.client.xperts.listWorkspaceFiles.mockClear();
    mocks.stream.client.xperts.listWorkspaceFiles.mockResolvedValue([]);
    mocks.stream.setConnectorBindingIds.mockClear();
    mocks.stream.setConnectorBindingIds.mockResolvedValue(undefined);
    mocks.stream.connectorBindingIds = [];
    mocks.stream.submit.mockClear();
    mocks.stream.loadMoreConversationMessages.mockClear();
    mocks.stream.loadMoreConversationMessages.mockResolvedValue([]);
    mocks.stream.reset.mockClear();
    mocks.stream.reset.mockImplementation((threadId?: string | null) => {
      mocks.stream.threadId = threadId ?? null;
    });
    mocks.stream.threadId = null;
    mocks.stream.conversationId = null;
    mocks.stream.messages = [];
    mocks.stream.historyMessagePagination = {
      conversationId: null,
      loadedCount: 0,
      total: 0,
      hasMore: false,
      isLoadingMore: false,
    };
    mocks.stream.pendingFollowUps = [];
    mocks.stream.pendingRequestUserInput = null;
    mocks.stream.isLoading = false;
    mocks.stream.error = null;
    mocks.stream.submit.mockResolvedValue(undefined);
    (mocks.stream as { threadGoal?: ThreadGoal | null }).threadGoal = null;
    mocks.parentMessengerOptions = null;
    mocks.parentSendCommand.mockClear();
    mocks.parentSendEvent.mockClear();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('renders the stacked WorkBuddy composer with project rail and context before send', async () => {
    const onProjectChange = vi.fn();
    render(
      <Chat
        clientSecret="secret"
        options={baseChatOptions}
        activeProjectId="project-1"
        projectsEnabled
        connectorsEnabled
        onProjectChange={onProjectChange}
      />,
    );
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    const composerShell = document.querySelector(
      '[data-slot="composer-input-shell"]',
    );
    expect(composerShell).toHaveAttribute('data-layout', 'stacked');
    expect(composerShell).toHaveClass(
      'bg-composer-shell',
      'px-composer-inset',
      'pt-composer-inset',
      'rounded-composer-shell',
      'shadow-composer-shell',
    );
    expect(composerShell).not.toHaveClass(
      'p-3',
      'px-0.5',
      'pt-0.5',
      'pb-composer-inset',
    );
    expect(composerShell).not.toHaveClass(
      'border',
      'border-border',
      'focus-within:border-muted-foreground/30',
    );
    expect(composerShell).not.toHaveClass('shadow-sm', 'shadow-md');
    const chatComposer = document.querySelector(
      '[data-slot="chatkit-chat-composer"]',
    );
    expect(chatComposer).toHaveAttribute('data-position', 'centered');
    expect(chatComposer).toHaveClass(
      'mx-auto',
      'w-full',
      'max-w-2xl',
      'px-4',
      'pt-2',
      'pb-4',
    );
    expect(chatComposer).not.toHaveClass('p-2', 'py-2');
    expect(chatComposer).toHaveClass('mb-auto');
    expect(chatComposer).not.toHaveClass('my-auto');
    expect(chatComposer).not.toHaveClass('absolute', 'top-1/2');
    const editorSurface = document.querySelector(
      '[data-slot="composer-editor-surface"]',
    );
    expect(editorSurface).toBeInTheDocument();
    expect(editorSurface).toHaveClass(
      'bg-background',
      'min-h-[6.5rem]',
      'rounded-composer-editor',
    );
    expect(editorSurface).not.toHaveClass('min-h-[10rem]');
    expect(editorSurface).not.toHaveClass('border', 'border-border');
    expect(editorSurface).not.toHaveClass('shadow-sm', 'shadow-md');
    const composerEditor = screen.getByRole('textbox');
    expect(composerEditor).toHaveClass('min-h-10', 'max-h-36');
    expect(composerEditor).not.toHaveClass('min-h-20');
    const projectRail = document.querySelector(
      '[data-slot="composer-project-rail"]',
    );
    expect(projectRail).toBeInTheDocument();
    expect(projectRail).toHaveClass('h-10', 'items-center');
    expect(projectRail).not.toHaveClass('mt-1');

    const contextUsage = screen.getByTestId('context-usage');
    const send = screen.getByRole('button', { name: 'send' });
    expect(
      contextUsage.compareDocumentPosition(send) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();

    fireEvent.click(screen.getByTestId('project-selector'));
    expect(onProjectChange).toHaveBeenCalledOnce();
    expect(onProjectChange).toHaveBeenCalledWith('project-2');
  });

  it('hides the project selector as soon as the conversation has started', async () => {
    mocks.stream.threadId = 'thread-1';
    render(
      <Chat
        clientSecret="secret"
        options={baseChatOptions}
        activeProjectId="project-1"
        projectsEnabled
        onProjectChange={vi.fn()}
      />,
    );
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.queryByTestId('project-selector')).not.toBeInTheDocument();
    expect(
      document.querySelector('[data-slot="composer-project-rail"]'),
    ).not.toBeInTheDocument();
    expect(
      document.querySelector('[data-slot="composer-input-shell"]'),
    ).toHaveClass('pb-composer-inset');
  });

  it('preserves plain text and clears conversation-scoped Connectors when the Project changes', async () => {
    const onProjectChange = vi.fn();
    const onConnectorsChange = vi.fn();
    mocks.stream.connectorBindingIds = ['binding-1'];
    render(
      <Chat
        clientSecret="secret"
        options={baseChatOptions}
        activeProjectId="project-1"
        projectsEnabled
        connectorsEnabled
        onProjectChange={onProjectChange}
        onConnectorsChange={onConnectorsChange}
      />,
    );
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    const textbox = setComposerText(screen.getByRole('textbox'), 'Keep me');
    fireEvent.click(screen.getByTestId('project-selector'));

    expect(textbox.textContent).toBe('Keep me');
    expect(mocks.stream.setConnectorBindingIds).toHaveBeenCalledWith([]);
    expect(onConnectorsChange).toHaveBeenCalledWith([]);
    expect(onProjectChange).toHaveBeenCalledWith('project-2');
  });

  it('hides the project selector on the optimistic message before the thread id resolves', async () => {
    mocks.stream.messages = [
      {
        id: 'human-1',
        type: 'human',
        content: 'Hello',
      },
    ];
    render(
      <Chat
        clientSecret="secret"
        options={baseChatOptions}
        activeProjectId="project-1"
        projectsEnabled
        onProjectChange={vi.fn()}
      />,
    );
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.queryByTestId('project-selector')).not.toBeInTheDocument();
  });

  it('keeps equal shell insets when the project rail is disabled', async () => {
    renderChat();
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    const composerShell = document.querySelector(
      '[data-slot="composer-input-shell"]',
    );
    expect(composerShell).toHaveClass(
      'px-composer-inset',
      'pt-composer-inset',
      'pb-composer-inset',
      'rounded-composer-shell',
    );
    expect(
      document.querySelector('[data-slot="composer-project-rail"]'),
    ).not.toBeInTheDocument();

    expect(
      document.querySelector('[data-slot="composer-editor-surface"]'),
    ).toHaveClass('rounded-composer-editor');
  });

  it.each([
    { id: 'plan', label: 'Plan' },
    { id: 'goal', label: 'Goal' },
  ])(
    'reveals the $label tool remove action without reserving idle space',
    async ({ id, label }) => {
      renderChat({
        composer: {
          tools: [
            {
              id,
              label,
              icon: 'write',
              pinned: true,
            },
          ],
        },
      });

      await act(async () => {
        mocks.parentMessengerOptions?.onSetComposerValue?.({
          selectedToolId: id,
        });
      });

      const tool = document.querySelector(
        '[data-slot="composer-selected-tool"]',
      );
      const remove = document.querySelector(
        '[data-slot="composer-selected-tool-remove"]',
      );

      expect(tool).toHaveTextContent(label);
      expect(tool).not.toHaveClass('gap-1.5');
      expect(remove).toHaveClass(
        'w-0',
        'opacity-0',
        'group-hover/tool:w-4',
        'group-hover/tool:opacity-100',
        'focus-visible:w-4',
        'focus-visible:opacity-100',
      );
    },
  );

  it('references an assistant workspace file from the @ palette before a conversation exists', async () => {
    mocks.stream.client.xperts.listWorkspaceFiles.mockResolvedValue([
      {
        filePath: 'Product brief.pdf',
        fullPath: 'briefs/Product brief.pdf',
        fileType: 'pdf',
        hasChildren: false,
        mimeType: 'application/pdf',
        size: 2048,
      },
    ]);
    renderChat();

    const composer = screen.getByRole('textbox');
    setComposerText(composer, '@prod');
    fireEvent.mouseDown(
      await screen.findByRole('button', { name: /Product brief.pdf/ }),
    );

    expect(screen.getByText('Product brief.pdf')).toBeInTheDocument();
    const nextComposer = screen.getByRole('textbox');
    expect(nextComposer).toBeEmptyDOMElement();
    setComposerText(nextComposer, 'Summarize it');
    fireEvent.click(screen.getByRole('button', { name: 'send' }));

    await waitFor(() => expect(mocks.stream.submit).toHaveBeenCalledOnce());
    expect(mocks.stream.client.xperts.listWorkspaceFiles).toHaveBeenCalledWith(
      'assistant-1',
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    expect(mocks.stream.submit.mock.calls[0][0]).toMatchObject({
      input: {
        input: 'Summarize it',
        files: [
          expect.objectContaining({
            filePath: 'briefs/Product brief.pdf',
            workspacePath: 'briefs/Product brief.pdf',
            originalName: 'Product brief.pdf',
            purpose: 'workspace',
          }),
        ],
      },
    });
  });

  it('restores a workspace file reference when first submission setup fails', async () => {
    let rejectSubmission: ((reason: unknown) => void) | undefined;
    mocks.stream.submit.mockImplementation(
      () =>
        new Promise<void>((_resolve, reject) => {
          rejectSubmission = reject;
        }),
    );
    mocks.stream.client.xperts.listWorkspaceFiles.mockResolvedValue([
      {
        filePath: 'Product brief.pdf',
        fullPath: 'briefs/Product brief.pdf',
        fileType: 'pdf',
        hasChildren: false,
        mimeType: 'application/pdf',
        size: 2048,
      },
    ]);
    renderChat();

    const composer = screen.getByRole('textbox');
    setComposerText(composer, '@prod');
    fireEvent.mouseDown(
      await screen.findByRole('button', { name: /Product brief.pdf/ }),
    );
    setComposerText(screen.getByRole('textbox'), 'Summarize it');
    fireEvent.click(screen.getByRole('button', { name: 'send' }));
    await waitFor(() => expect(mocks.stream.submit).toHaveBeenCalledOnce());

    await act(async () => {
      rejectSubmission?.(new Error('Thread creation failed'));
      await Promise.resolve();
    });

    await waitFor(() =>
      expect(screen.getByRole('textbox')).toHaveTextContent('Summarize it'),
    );
    expect(screen.getByText('Product brief.pdf')).toBeInTheDocument();
  });

  it('returns the composer to the bottom after the conversation has messages', async () => {
    mocks.stream.messages = [
      {
        id: 'message-1',
        type: 'human',
        content: 'Hello',
      },
    ];

    renderChat();
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    const chatComposer = document.querySelector(
      '[data-slot="chatkit-chat-composer"]',
    );
    expect(chatComposer).toHaveAttribute('data-position', 'bottom');
    expect(chatComposer).toHaveClass('sticky', 'bottom-0');
    expect(chatComposer).not.toHaveClass('absolute', 'top-1/2');
  });

  it('omits planMode from regular sends by default', async () => {
    renderChat();

    const composerShell = document.querySelector(
      '[data-slot="composer-input-shell"]',
    );
    expect(composerShell).toHaveAttribute('data-layout', 'stacked');

    const textarea = screen.getByRole('textbox');
    setComposerText(textarea, 'hello');
    expect(composerShell).toHaveAttribute('data-layout', 'stacked');

    const send = screen.getByRole('button', { name: 'send' });
    await waitFor(() => expect(send).not.toBeDisabled());
    fireEvent.click(send);

    await waitFor(() => expect(mocks.stream.submit).toHaveBeenCalledTimes(1));
    expect(mocks.stream.submit).toHaveBeenCalledWith(
      expect.objectContaining({
        input: {
          input: 'hello',
        },
      }),
      expect.any(Object),
    );
    expect(mocks.stream.submit.mock.calls[0][0].input).not.toHaveProperty(
      'planMode',
    );
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('loads hosted models, submits the selection, and saves picker changes', async () => {
    mocks.stream.client.assistants.getModels.mockResolvedValue({
      models: [
        {
          id: 'mdl_primary',
          label: 'Primary',
          default: true,
          avatar: {
            url: 'https://cdn.example.com/provider-primary.svg',
            background: '#f7f7f7',
          },
        },
        {
          id: 'mdl_fast',
          label: 'Fast',
          avatar: { url: 'https://cdn.example.com/provider-fast.svg' },
        },
      ],
      selected_model_id: 'mdl_primary',
      preference_persistable: true,
    });

    renderChat();

    const picker = await screen.findByRole('button', {
      name: 'chat.modelPicker.label: Primary',
    });
    const actionBar = picker.closest('[data-slot="composer-action-bar"]');
    expect(actionBar).not.toBeNull();
    expect(picker.closest('[data-slot="chat-footer"]')).toBeNull();
    const contextUsage = within(actionBar as HTMLElement).getByTestId(
      'context-usage',
    );
    const sendButton = within(actionBar as HTMLElement).getByRole('button', {
      name: 'send',
    });
    expect(
      contextUsage.compareDocumentPosition(picker) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      picker.compareDocumentPosition(sendButton) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    picker.focus();
    fireEvent.keyDown(picker, { key: 'Enter', code: 'Enter' });
    expect(
      await screen.findByText('chat.modelPicker.futureTitle'),
    ).toBeInTheDocument();
    expect(screen.getByText('chat.modelPicker.title')).toHaveClass(
      'text-popover-foreground',
    );
    expect(
      within(screen.getByRole('menuitemradio', { name: /Primary/ })).getByText(
        'Primary',
      ),
    ).toHaveClass('text-popover-foreground');
    expect(screen.getByText('chat.modelPicker.futureTitle')).toHaveClass(
      'text-popover-foreground',
    );
    const primaryOption = screen.getByRole('menuitemradio', {
      name: /Primary/,
    });
    expect(primaryOption.querySelector('img')).toHaveAttribute(
      'src',
      'https://cdn.example.com/provider-primary.svg',
    );
    const pickerHeader = screen
      .getByText('chat.modelPicker.title')
      .closest('div');
    expect(pickerHeader?.querySelector('img')).toHaveAttribute(
      'src',
      'https://cdn.example.com/provider-primary.svg',
    );
    fireEvent.click(await screen.findByRole('menuitemradio', { name: 'Fast' }));

    await waitFor(() =>
      expect(
        mocks.stream.client.assistants.setModelPreference,
      ).toHaveBeenCalledWith('assistant-1', 'mdl_fast'),
    );

    setComposerText(screen.getByRole('textbox'), 'use fast');
    fireEvent.click(screen.getByRole('button', { name: 'send' }));

    expect(mocks.stream.submit.mock.calls[0]?.[0]).toMatchObject({
      input: { input: 'use fast', model: 'mdl_fast' },
    });
  });

  it('treats a missing hosted model endpoint as an unsupported optional capability', async () => {
    let rejectCatalog!: (reason?: unknown) => void;
    mocks.stream.client.assistants.getModels.mockReturnValue(
      new Promise((_resolve, reject) => {
        rejectCatalog = reject;
      }),
    );

    renderChat();
    await waitFor(() =>
      expect(mocks.stream.client.assistants.getModels).toHaveBeenCalledWith(
        'assistant-1',
        { signal: expect.any(AbortSignal) },
      ),
    );

    await act(async () => {
      rejectCatalog({ status: 404 });
      await Promise.resolve();
    });

    expect(mocks.parentSendEvent).not.toHaveBeenCalledWith('public_event', [
      'error',
      expect.any(Object),
    ]);
  });

  it('still reports hosted model catalog failures other than not found', async () => {
    mocks.stream.client.assistants.getModels.mockRejectedValue({ status: 500 });

    renderChat();

    await waitFor(() =>
      expect(mocks.parentSendEvent).toHaveBeenCalledWith('public_event', [
        'error',
        { error: expect.any(Error) },
      ]),
    );
  });

  it('keeps a programmatic model selection made before the hosted catalog loads', async () => {
    let resolveCatalog!: (value: {
      models: Array<{ id: string; label: string; default?: boolean }>;
      selected_model_id: string;
      preference_persistable: boolean;
    }) => void;
    mocks.stream.client.assistants.getModels.mockReturnValue(
      new Promise((resolve) => {
        resolveCatalog = resolve;
      }),
    );

    renderChat();
    act(() => {
      mocks.parentMessengerOptions?.onSetComposerValue?.({
        selectedModelId: 'mdl_fast',
      });
    });
    act(() => {
      resolveCatalog({
        models: [
          { id: 'mdl_primary', label: 'Primary', default: true },
          { id: 'mdl_fast', label: 'Fast' },
        ],
        selected_model_id: 'mdl_primary',
        preference_persistable: true,
      });
    });

    expect(
      await screen.findByRole('button', {
        name: 'chat.modelPicker.label: Fast',
      }),
    ).toBeInTheDocument();
  });

  it('uses custom composer models without calling the hosted catalog', async () => {
    renderChat({
      composer: {
        models: [
          { id: 'custom-primary', label: 'Custom Primary', default: true },
          { id: 'custom-fast', label: 'Custom Fast' },
        ],
      },
    });

    expect(
      await screen.findByRole('button', {
        name: 'chat.modelPicker.label: Custom Primary',
      }),
    ).toBeInTheDocument();
    expect(mocks.stream.client.assistants.getModels).not.toHaveBeenCalled();
  });

  it('does not silently select another model when the hosted Primary is unavailable', async () => {
    mocks.stream.client.assistants.getModels.mockResolvedValue({
      models: [
        {
          id: 'mdl_primary',
          label: 'Primary',
          default: false,
          disabled: true,
        },
        { id: 'mdl_fast', label: 'Fast' },
      ],
      selected_model_id: null,
      preference_persistable: true,
    });

    renderChat();
    await waitFor(() =>
      expect(mocks.stream.setSelectedModelId.mock.calls.length).toBeGreaterThan(
        1,
      ),
    );
    expect(mocks.stream.selectedModelId).toBeNull();

    setComposerText(screen.getByRole('textbox'), 'keep primary behavior');
    fireEvent.click(screen.getByRole('button', { name: 'send' }));

    const payload = mocks.stream.submit.mock.calls[0]?.[0];
    expect(payload).toMatchObject({
      input: { input: 'keep primary behavior' },
    });
    expect(payload?.input?.model).toBeUndefined();
    expect(payload?.state?.human?.model).toBeUndefined();
  });

  it('queues composer sends by default while a run is active', async () => {
    mocks.stream.isLoading = true;
    renderChat();

    setComposerText(screen.getByRole('textbox'), 'follow up');

    const send = screen.getByRole('button', { name: 'send' });
    await waitFor(() => expect(send).not.toBeDisabled());
    fireEvent.click(send);

    await waitFor(() => expect(mocks.stream.submit).toHaveBeenCalledTimes(1));
    expect(mocks.stream.submit.mock.calls[0][0]).toMatchObject({
      input: {
        input: 'follow up',
      },
    });
    expect(mocks.stream.submit.mock.calls[0][1]).toMatchObject({
      followUpMode: 'queue',
    });
  });

  it('shows active stream errors in the thread error area', async () => {
    mocks.stream.error = new Error(
      'Invalid node name "sandbox_service_stop" in Send packet',
    );

    renderChat();

    await waitFor(() => {
      expect(
        screen.getAllByText(
          'Invalid node name "sandbox_service_stop" in Send packet',
        ),
      ).toHaveLength(1);
    });
  });

  it('loads older messages from the top history divider', async () => {
    mocks.stream.threadId = 'thread-1';
    mocks.stream.messages = [
      {
        id: 'message-1',
        type: 'human',
        content: 'Hello from the latest page',
        createdAt: '2026-01-01T00:00:00.000Z',
      },
    ];
    mocks.stream.historyMessagePagination = {
      conversationId: 'conversation-1',
      loadedCount: 50,
      total: 75,
      hasMore: true,
      isLoadingMore: false,
    };

    renderChat();

    const loadMore = screen.getByRole('button', { name: 'Load more' });
    expect(loadMore).not.toBeDisabled();
    fireEvent.click(loadMore);

    await waitFor(() =>
      expect(mocks.stream.loadMoreConversationMessages).toHaveBeenCalledTimes(
        1,
      ),
    );
  });

  it('disables the top history divider while older messages are loading', async () => {
    mocks.stream.threadId = 'thread-1';
    mocks.stream.messages = [
      {
        id: 'message-1',
        type: 'human',
        content: 'Hello from the latest page',
        createdAt: '2026-01-01T00:00:00.000Z',
      },
    ];
    mocks.stream.historyMessagePagination = {
      conversationId: 'conversation-1',
      loadedCount: 50,
      total: 75,
      hasMore: true,
      isLoadingMore: true,
    };

    renderChat();

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Loading...' })).toBeDisabled(),
    );
  });

  it('loads runtime capabilities through the SDK client and submits the default allow-list', async () => {
    mocks.stream.client.assistants.getRuntimeCapabilities.mockResolvedValueOnce(
      {
        skills: [
          {
            id: 'skill-default',
            workspaceId: 'workspace-1',
            label: 'Default Skill',
            default: true,
          },
        ],
        plugins: [
          {
            nodeKey: 'middleware-1',
            provider: 'sandbox',
            label: 'Sandbox',
            meta: {
              icon: {
                type: 'svg',
                value:
                  '<svg viewBox="0 0 16 16"><path d="M2 2h12v12H2z" /></svg>',
              },
            },
          },
        ],
      },
    );

    renderChat();

    await waitFor(() =>
      expect(
        mocks.stream.client.assistants.getRuntimeCapabilities,
      ).toHaveBeenCalledWith(
        'assistant-1',
        expect.objectContaining({ signal: expect.any(AbortSignal) }),
      ),
    );
    expect(globalThis.fetch).not.toHaveBeenCalled();

    const textarea = screen.getByRole('textbox');
    setComposerText(textarea, 'hello');
    const send = screen.getByRole('button', { name: 'send' });
    await waitFor(() => expect(send).not.toBeDisabled());
    fireEvent.click(send);

    await waitFor(() => expect(mocks.stream.submit).toHaveBeenCalledTimes(1));
    expect(mocks.stream.submit).toHaveBeenCalledWith(
      expect.objectContaining({
        input: {
          input: 'hello',
          runtimeCapabilities: {
            mode: 'allowlist',
            skills: {
              workspaceId: 'workspace-1',
              ids: ['skill-default'],
            },
            plugins: {
              nodeKeys: [],
            },
            subAgents: {
              nodeKeys: [],
            },
          },
        },
        state: {
          human: {
            input: 'hello',
            runtimeCapabilities: {
              mode: 'allowlist',
              skills: {
                workspaceId: 'workspace-1',
                ids: ['skill-default'],
              },
              plugins: {
                nodeKeys: [],
              },
              subAgents: {
                nodeKeys: [],
              },
            },
          },
        },
      }),
      expect.any(Object),
    );
  });

  it('executes host slash commands with args as submitted prompts', async () => {
    renderChat({
      composer: {
        slashCommands: [
          {
            name: 'review',
            label: 'Review',
            description: 'Review the current target',
            action: {
              type: 'submit_prompt',
              template: 'Review this: {{args}}',
            },
          },
        ],
      },
    });

    const textarea = screen.getByRole('textbox');
    setComposerText(textarea, '/review src/app.ts');
    const send = screen.getByRole('button', { name: 'send' });
    await waitFor(() => expect(send).not.toBeDisabled());
    fireEvent.click(send);

    await waitFor(() => expect(mocks.stream.submit).toHaveBeenCalledTimes(1));
    expect(mocks.stream.submit).toHaveBeenCalledWith(
      expect.objectContaining({
        input: {
          input: 'Review this: src/app.ts',
          commandSource: {
            type: 'slash_command',
            name: 'review',
            source: 'host',
            executionType: 'submit_prompt',
          },
        },
      }),
      expect.any(Object),
    );
  });

  it('executes /plan with args as a plan-mode prompt', async () => {
    renderChat();

    const textarea = screen.getByRole('textbox');
    setComposerText(textarea, '/plan investigate the bug');
    const send = screen.getByRole('button', { name: 'send' });
    await waitFor(() => expect(send).not.toBeDisabled());
    fireEvent.click(send);

    await waitFor(() => expect(mocks.stream.submit).toHaveBeenCalledTimes(1));
    expect(mocks.stream.submit).toHaveBeenCalledWith(
      expect.objectContaining({
        input: {
          input: 'investigate the bug',
          planMode: true,
          commandSource: {
            type: 'slash_command',
            name: 'plan',
            source: 'builtin',
            executionType: 'client_action',
          },
        },
        state: {
          human: {
            input: 'investigate the bug',
            planMode: true,
            commandSource: {
              type: 'slash_command',
              name: 'plan',
              source: 'builtin',
              executionType: 'client_action',
            },
          },
        },
      }),
      expect.any(Object),
    );
  });

  it('does not show a goal card when /goal returns no existing goal', async () => {
    enableGoalRuntimeCommand();
    mocks.stream.threadId = 'thread-1';
    const adapter = createGoalAdapter();

    renderChat({ goal: adapter });

    await waitFor(() =>
      expect(adapter.getGoal).toHaveBeenCalledWith({
        threadId: 'thread-1',
        signal: expect.any(AbortSignal),
      }),
    );
    await waitFor(() =>
      expect(screen.queryByText('chat.goal.label')).toBeNull(),
    );

    const textarea = screen.getByRole('textbox');
    setComposerText(textarea, '/goal');
    const send = screen.getByRole('button', { name: 'send' });
    await waitFor(() => expect(send).not.toBeDisabled());
    fireEvent.click(send);

    await waitFor(() => expect(adapter.getGoal).toHaveBeenCalledTimes(2));
    expect(screen.queryByText('chat.goal.label')).toBeNull();
    expect(mocks.stream.submit).not.toHaveBeenCalled();
  });

  it('does not show a goal card for /goal before a thread exists', async () => {
    enableGoalRuntimeCommand();
    const adapter = createGoalAdapter();

    renderChat({ goal: adapter });

    await waitFor(() =>
      expect(
        screen.getByTestId('runtime-capabilities-ready'),
      ).toHaveTextContent('ready'),
    );

    const textarea = screen.getByRole('textbox');
    setComposerText(textarea, '/goal');
    const send = screen.getByRole('button', { name: 'send' });
    await waitFor(() => expect(send).not.toBeDisabled());
    fireEvent.click(send);

    expect(screen.queryByText('chat.goal.label')).toBeNull();
    expect(screen.queryByText('chat.goal.startThreadRequired')).toBeNull();
    expect(adapter.getGoal).not.toHaveBeenCalled();
    expect(mocks.stream.submit).not.toHaveBeenCalled();
  });

  it('starts a hidden goal run after creating a goal on a new thread', async () => {
    enableGoalRuntimeCommand();
    const adapter = createGoalAdapter();

    renderChat({ goal: adapter });

    await waitFor(() =>
      expect(
        screen.getByTestId('runtime-capabilities-ready'),
      ).toHaveTextContent('ready'),
    );

    const textarea = screen.getByRole('textbox');
    setComposerText(textarea, '/goal ship feature');
    const send = screen.getByRole('button', { name: 'send' });
    await waitFor(() => expect(send).not.toBeDisabled());
    fireEvent.click(send);

    await waitFor(() =>
      expect(adapter.setGoal).toHaveBeenCalledWith(
        expect.objectContaining({
          threadId: null,
          objective: 'ship feature',
        }),
      ),
    );
    await waitFor(() => expect(mocks.stream.submit).toHaveBeenCalledTimes(1));

    expect(mocks.stream.reset).toHaveBeenCalledWith('thread-1', []);
    expect(mocks.stream.submit.mock.calls[0][0].input).toMatchObject({
      input: 'Continue working toward the active goal.',
      commandSource: expect.objectContaining({
        type: 'slash_command',
        name: 'goal',
        source: 'runtime',
      }),
      goalRun: true,
    });
    expect(mocks.stream.submit.mock.calls[0][1]).toMatchObject({
      threadId: 'thread-1',
      joinExistingThread: true,
    });
    expect(mocks.stream.submit.mock.calls[0][1]).not.toHaveProperty(
      'optimisticValues',
    );
    expect(screen.queryByText('ship feature')).toBeNull();
  });

  it('passes the selected Project into first-goal conversation setup', async () => {
    enableGoalRuntimeCommand();
    const adapter = createGoalAdapter();
    mocks.stream.connectorBindingIds = ['binding-1'];

    render(
      <Chat
        clientSecret="secret"
        options={{ ...baseChatOptions, goal: adapter }}
        activeProjectId="project-1"
        projectsEnabled
      />,
    );

    await waitFor(() =>
      expect(
        screen.getByTestId('runtime-capabilities-ready'),
      ).toHaveTextContent('ready'),
    );

    setComposerText(screen.getByRole('textbox'), '/goal ship feature');
    fireEvent.click(screen.getByRole('button', { name: 'send' }));

    await waitFor(() =>
      expect(adapter.setGoal).toHaveBeenCalledWith(
        expect.objectContaining({
          threadId: null,
          assistantId: mocks.stream.assistantId,
          projectId: 'project-1',
          objective: 'ship feature',
          runtimeCapabilities: expect.objectContaining({
            connectors: { bindingIds: ['binding-1'] },
          }),
        }),
      ),
    );
  });

  it('uses the latest selected Project when a stable Goal adapter is reused', async () => {
    enableGoalRuntimeCommand();
    const adapter = createGoalAdapter();
    const options = { ...baseChatOptions, goal: adapter };
    const { rerender } = render(
      <Chat
        clientSecret="secret"
        options={options}
        activeProjectId="project-1"
        projectsEnabled
      />,
    );

    await waitFor(() =>
      expect(
        screen.getByTestId('runtime-capabilities-ready'),
      ).toHaveTextContent('ready'),
    );

    rerender(
      <Chat
        clientSecret="secret"
        options={options}
        activeProjectId="project-2"
        projectsEnabled
      />,
    );
    await waitFor(() =>
      expect(
        screen.getByTestId('runtime-capabilities-ready'),
      ).toHaveTextContent('ready'),
    );

    setComposerText(screen.getByRole('textbox'), '/goal ship feature');
    fireEvent.click(screen.getByRole('button', { name: 'send' }));

    await waitFor(() =>
      expect(adapter.setGoal).toHaveBeenCalledWith(
        expect.objectContaining({
          threadId: null,
          projectId: 'project-2',
          objective: 'ship feature',
        }),
      ),
    );
  });

  it('locks Project selection and ignores a stale first-goal result after the Project changes', async () => {
    enableGoalRuntimeCommand();
    let resolveGoal:
      | ((value: { threadId: string; goal: ThreadGoal }) => void)
      | null = null;
    const adapter = createGoalAdapter({
      setGoal: vi.fn(
        () =>
          new Promise<{ threadId: string; goal: ThreadGoal }>((resolve) => {
            resolveGoal = resolve;
          }),
      ),
    });
    const options = { ...baseChatOptions, goal: adapter };
    const onProjectChange = vi.fn();
    const { rerender } = render(
      <Chat
        clientSecret="secret"
        options={options}
        activeProjectId="project-1"
        projectsEnabled
        onProjectChange={onProjectChange}
      />,
    );

    await waitFor(() =>
      expect(
        screen.getByTestId('runtime-capabilities-ready'),
      ).toHaveTextContent('ready'),
    );

    setComposerText(screen.getByRole('textbox'), '/goal ship feature');
    fireEvent.click(screen.getByRole('button', { name: 'send' }));

    await waitFor(() => expect(adapter.setGoal).toHaveBeenCalledTimes(1));
    const goalSignal = vi.mocked(adapter.setGoal).mock.calls[0]?.[0].signal;
    expect(goalSignal).toBeDefined();
    expect(screen.getByTestId('project-selector')).toBeDisabled();
    fireEvent.click(screen.getByTestId('project-selector'));
    expect(onProjectChange).not.toHaveBeenCalled();

    rerender(
      <Chat
        clientSecret="secret"
        options={options}
        activeProjectId="project-2"
        projectsEnabled
        onProjectChange={onProjectChange}
      />,
    );
    expect(goalSignal?.aborted).toBe(true);
    await act(async () => {
      resolveGoal?.({
        threadId: 'thread-project-1',
        goal: {
          id: 'goal-project-1',
          threadId: 'thread-project-1',
          objective: 'ship feature',
          status: 'active',
          tokensUsed: 0,
          elapsedSeconds: 0,
          continuationCount: 0,
        },
      });
      await Promise.resolve();
    });

    await waitFor(() =>
      expect(screen.getByTestId('project-selector')).not.toBeDisabled(),
    );
    expect(mocks.stream.reset).not.toHaveBeenCalled();
    expect(mocks.stream.submit).not.toHaveBeenCalled();
    expect(screen.queryByText('ship feature')).toBeNull();
  });

  it('keeps the draft thread state clean when first-goal setup fails', async () => {
    enableGoalRuntimeCommand();
    const adapter = createGoalAdapter({
      setGoal: vi.fn(async () => {
        throw new Error('Goal setup failed');
      }),
    });

    renderChat({ goal: adapter });

    await waitFor(() =>
      expect(
        screen.getByTestId('runtime-capabilities-ready'),
      ).toHaveTextContent('ready'),
    );

    setComposerText(screen.getByRole('textbox'), '/goal ship feature');
    fireEvent.click(screen.getByRole('button', { name: 'send' }));

    expect(await screen.findByText('Goal setup failed')).toBeInTheDocument();
    expect(mocks.stream.reset).not.toHaveBeenCalled();
    expect(mocks.stream.submit).not.toHaveBeenCalled();
    expect(mocks.stream.threadId).toBeNull();
  });

  it('toggles the goal switch without showing an empty card when no goal exists', async () => {
    enableGoalRuntimeCommand();

    renderChat();

    await waitFor(() =>
      expect(screen.getByTestId('goal-command-available')).toHaveTextContent(
        'goal-ready',
      ),
    );
    const composerShell = document.querySelector(
      '[data-slot="composer-input-shell"]',
    );
    expect(composerShell).toHaveAttribute('data-layout', 'stacked');

    fireEvent.click(screen.getByTestId('goal-command'));

    expect(screen.getByTestId('goal-command')).toHaveTextContent('goal-on');
    expect(composerShell).toHaveAttribute('data-layout', 'stacked');
    expect(screen.queryByText('chat.goal.label')).toBeNull();
    expect(screen.getByRole('textbox').textContent).toBe('');

    fireEvent.click(screen.getByTestId('goal-command'));

    expect(screen.getByTestId('goal-command')).toHaveTextContent('goal-off');
    expect(composerShell).toHaveAttribute('data-layout', 'stacked');
  });

  it('shows the goal switch only when the runtime goal plugin is selected', async () => {
    enableSelectableGoalRuntimeCommand();

    renderChat();

    await waitFor(() =>
      expect(
        screen.getByTestId('runtime-capabilities-ready'),
      ).toHaveTextContent('ready'),
    );
    expect(screen.getByTestId('goal-command-available')).toHaveTextContent(
      'goal-hidden',
    );

    fireEvent.click(screen.getByTestId('select-plugin'));

    await waitFor(() =>
      expect(screen.getByTestId('selected-plugins')).toHaveTextContent(
        'middleware-1',
      ),
    );
    expect(screen.getByTestId('goal-command-available')).toHaveTextContent(
      'goal-ready',
    );

    fireEvent.click(screen.getByTestId('clear-plugin'));

    await waitFor(() =>
      expect(screen.getByTestId('selected-plugins')).toHaveTextContent(''),
    );
    expect(screen.getByTestId('goal-command-available')).toHaveTextContent(
      'goal-hidden',
    );
  });

  it('submits goal mode input as a goal instead of a regular prompt', async () => {
    enableGoalRuntimeCommand();
    mocks.stream.threadId = 'thread-1';
    const adapter = createGoalAdapter();

    renderChat({ goal: adapter });

    await waitFor(() =>
      expect(screen.getByTestId('goal-command-available')).toHaveTextContent(
        'goal-ready',
      ),
    );

    fireEvent.click(screen.getByTestId('goal-command'));
    setComposerText(screen.getByRole('textbox'), 'find the top AI repos');
    const send = screen.getByRole('button', { name: 'send' });
    await waitFor(() => expect(send).not.toBeDisabled());
    fireEvent.click(send);

    await waitFor(() =>
      expect(adapter.setGoal).toHaveBeenCalledWith(
        expect.objectContaining({
          threadId: 'thread-1',
          objective: 'find the top AI repos',
        }),
      ),
    );
    await waitFor(() => expect(mocks.stream.submit).toHaveBeenCalledTimes(1));

    expect(mocks.stream.submit.mock.calls[0][0].input).toMatchObject({
      input: 'Continue working toward the active goal.',
      goalRun: true,
    });
    expect(mocks.stream.submit.mock.calls[0][0].input.input).not.toBe(
      'find the top AI repos',
    );
    expect(getSubmittedOptimisticMessages()).toEqual([
      expect.objectContaining({
        type: 'human',
        content: 'find the top AI repos',
        submittedInput: 'find the top AI repos',
      }),
    ]);
    expect(screen.getByTestId('goal-command')).toHaveTextContent('goal-off');
    expect(screen.getByRole('textbox').textContent).toBe('');
  });

  it('submits goal mode input as a goal before a thread exists', async () => {
    enableGoalRuntimeCommand();
    const adapter = createGoalAdapter();

    renderChat({ goal: adapter });

    await waitFor(() =>
      expect(screen.getByTestId('goal-command-available')).toHaveTextContent(
        'goal-ready',
      ),
    );

    fireEvent.click(screen.getByTestId('goal-command'));
    setComposerText(screen.getByRole('textbox'), 'find the top AI repos');
    const send = screen.getByRole('button', { name: 'send' });
    await waitFor(() => expect(send).not.toBeDisabled());
    fireEvent.click(send);

    await waitFor(() =>
      expect(adapter.setGoal).toHaveBeenCalledWith(
        expect.objectContaining({
          threadId: null,
          objective: 'find the top AI repos',
        }),
      ),
    );
    await waitFor(() => expect(mocks.stream.submit).toHaveBeenCalledTimes(1));

    expect(mocks.stream.reset).toHaveBeenCalledWith('thread-1', []);
    expect(mocks.stream.submit.mock.calls[0][0].input).toMatchObject({
      input: 'Continue working toward the active goal.',
      goalRun: true,
    });
    expect(mocks.stream.submit.mock.calls[0][1]).toMatchObject({
      threadId: 'thread-1',
      joinExistingThread: true,
    });
    expect(mocks.stream.submit.mock.calls[0][0].input.input).not.toBe(
      'find the top AI repos',
    );
    expect(getSubmittedOptimisticMessages()).toEqual([
      expect.objectContaining({
        type: 'human',
        content: 'find the top AI repos',
        submittedInput: 'find the top AI repos',
      }),
    ]);
    expect(screen.getByTestId('goal-command')).toHaveTextContent('goal-off');
    expect(screen.getByRole('textbox').textContent).toBe('');
  });

  it('submits goal mode input as a goal when pressing Enter', async () => {
    enableGoalRuntimeCommand();
    mocks.stream.threadId = 'thread-1';
    const adapter = createGoalAdapter();

    renderChat({ goal: adapter });

    await waitFor(() =>
      expect(screen.getByTestId('goal-command-available')).toHaveTextContent(
        'goal-ready',
      ),
    );

    fireEvent.click(screen.getByTestId('goal-command'));
    setComposerText(screen.getByRole('textbox'), 'find the top AI repos');
    fireEvent.keyDown(screen.getByRole('textbox'), {
      key: 'Enter',
      code: 'Enter',
    });

    await waitFor(() =>
      expect(adapter.setGoal).toHaveBeenCalledWith(
        expect.objectContaining({
          threadId: 'thread-1',
          objective: 'find the top AI repos',
        }),
      ),
    );
    await waitFor(() => expect(mocks.stream.submit).toHaveBeenCalledTimes(1));

    expect(mocks.stream.submit.mock.calls[0][0].input).toMatchObject({
      input: 'Continue working toward the active goal.',
      goalRun: true,
    });
    expect(mocks.stream.submit.mock.calls[0][0].input.input).not.toBe(
      'find the top AI repos',
    );
    expect(getSubmittedOptimisticMessages()).toEqual([
      expect.objectContaining({
        type: 'human',
        content: 'find the top AI repos',
        submittedInput: 'find the top AI repos',
      }),
    ]);
  });

  it('keeps the goal switch as input mode without showing an existing goal summary', async () => {
    enableGoalRuntimeCommand();
    mocks.stream.threadId = 'thread-1';
    const activeGoal: ThreadGoal = {
      id: 'goal-1',
      threadId: 'thread-1',
      objective: 'ship the feature',
      status: 'active',
      tokensUsed: 0,
      elapsedSeconds: 0,
      continuationCount: 0,
    };
    const adapter = createGoalAdapter({
      getGoal: vi.fn(async () => activeGoal),
    });

    renderChat({ goal: adapter });

    await waitFor(() => expect(adapter.getGoal).toHaveBeenCalled());
    expect(screen.queryByText('ship the feature')).toBeNull();

    fireEvent.click(screen.getByTestId('goal-command'));

    expect(screen.getByTestId('goal-command')).toHaveTextContent('goal-on');
    expect(screen.queryByText('ship the feature')).toBeNull();

    fireEvent.click(screen.getByTestId('goal-command'));

    expect(screen.getByTestId('goal-command')).toHaveTextContent('goal-off');
    expect(screen.queryByText('ship the feature')).toBeNull();
  });

  it('hides the goal status when the stream marks the goal complete', async () => {
    enableGoalRuntimeCommand();
    mocks.stream.threadId = 'thread-1';
    const adapter = createGoalAdapter();
    const options = { goal: adapter };
    const view = renderChat(options);

    await waitFor(() =>
      expect(screen.getByTestId('goal-command-available')).toHaveTextContent(
        'goal-ready',
      ),
    );

    fireEvent.click(screen.getByTestId('goal-command'));
    setComposerText(screen.getByRole('textbox'), 'find the top AI repos');
    const send = screen.getByRole('button', { name: 'send' });
    await waitFor(() => expect(send).not.toBeDisabled());
    fireEvent.click(send);

    await waitFor(() =>
      expect(screen.getByTestId('goal-command')).toHaveTextContent('goal-off'),
    );

    (mocks.stream as { threadGoal?: ThreadGoal | null }).threadGoal = {
      id: 'goal-1',
      threadId: 'thread-1',
      objective: 'find the top AI repos',
      status: 'complete',
      tokensUsed: 0,
      elapsedSeconds: 0,
      continuationCount: 0,
    };
    mocks.stream.isLoading = false;

    view.rerender(
      <Chat
        clientSecret="secret"
        options={{
          ...baseChatOptions,
          ...options,
        }}
      />,
    );

    await waitFor(() =>
      expect(screen.getByTestId('goal-command')).toHaveTextContent('goal-off'),
    );
    expect(screen.queryByText('chat.goal.status.complete')).toBeNull();
  });

  it('keeps the active goal card while the goal run is loading and hides it when loading ends', async () => {
    enableGoalRuntimeCommand();
    mocks.stream.threadId = 'thread-1';
    const activeGoal: ThreadGoal = {
      id: 'goal-1',
      threadId: 'thread-1',
      objective: 'find the top AI repos',
      status: 'active',
      tokensUsed: 0,
      elapsedSeconds: 0,
      continuationCount: 0,
    };
    const adapter = createGoalAdapter({
      getGoal: vi.fn(async () => activeGoal),
    });
    const options = { goal: adapter };
    const view = renderChat(options);

    await waitFor(() =>
      expect(screen.getByTestId('goal-command-available')).toHaveTextContent(
        'goal-ready',
      ),
    );

    fireEvent.click(screen.getByTestId('goal-command'));
    setComposerText(screen.getByRole('textbox'), 'find the top AI repos');
    const send = screen.getByRole('button', { name: 'send' });
    await waitFor(() => expect(send).not.toBeDisabled());
    fireEvent.click(send);

    await waitFor(() =>
      expect(screen.getByTestId('goal-command')).toHaveTextContent('goal-off'),
    );

    (mocks.stream as { threadGoal?: ThreadGoal | null }).threadGoal =
      activeGoal;
    mocks.stream.isLoading = true;

    view.rerender(
      <Chat
        clientSecret="secret"
        options={{
          ...baseChatOptions,
          ...options,
        }}
      />,
    );

    await waitFor(() =>
      expect(screen.getByText('find the top AI repos')).toBeInTheDocument(),
    );
    expect(screen.getByTestId('goal-command')).toHaveTextContent('goal-off');

    mocks.stream.isLoading = false;

    view.rerender(
      <Chat
        clientSecret="secret"
        options={{
          ...baseChatOptions,
          ...options,
        }}
      />,
    );

    await waitFor(() =>
      expect(screen.queryByText('find the top AI repos')).toBeNull(),
    );
    expect(screen.getByTestId('goal-command')).toHaveTextContent('goal-off');
  });

  it('allows goal mode to be enabled again after a previous goal completes', async () => {
    enableGoalRuntimeCommand();
    mocks.stream.threadId = 'thread-1';
    const completedGoal: ThreadGoal = {
      id: 'goal-1',
      threadId: 'thread-1',
      objective: 'find the top AI repos',
      status: 'complete',
      tokensUsed: 0,
      elapsedSeconds: 0,
      continuationCount: 0,
    };
    const adapter = createGoalAdapter({
      getGoal: vi.fn(async () => completedGoal),
    });

    renderChat({ goal: adapter });

    await waitFor(() => expect(adapter.getGoal).toHaveBeenCalled());
    expect(screen.getByTestId('goal-command')).toHaveTextContent('goal-off');
    expect(screen.queryByText('chat.goal.status.complete')).toBeNull();

    fireEvent.click(screen.getByTestId('goal-command'));

    expect(screen.getByTestId('goal-command')).toHaveTextContent('goal-on');
    expect(screen.queryByText('chat.goal.status.complete')).toBeNull();

    setComposerText(screen.getByRole('textbox'), 'ship the next goal');
    const send = screen.getByRole('button', { name: 'send' });
    await waitFor(() => expect(send).not.toBeDisabled());
    fireEvent.click(send);

    await waitFor(() =>
      expect(adapter.setGoal).toHaveBeenCalledWith(
        expect.objectContaining({
          threadId: 'thread-1',
          objective: 'ship the next goal',
        }),
      ),
    );
    await waitFor(() => expect(mocks.stream.submit).toHaveBeenCalledTimes(1));
  });

  it('expands and collapses the active goal objective', async () => {
    enableGoalRuntimeCommand();
    mocks.stream.threadId = 'thread-1';
    mocks.stream.isLoading = true;
    const activeGoal: ThreadGoal = {
      id: 'goal-1',
      threadId: 'thread-1',
      objective:
        'ship the feature with a long objective that should be collapsible',
      status: 'active',
      tokensUsed: 0,
      elapsedSeconds: 0,
      continuationCount: 0,
    };
    (mocks.stream as { threadGoal?: ThreadGoal | null }).threadGoal =
      activeGoal;
    const adapter = createGoalAdapter({
      getGoal: vi.fn(async () => activeGoal),
    });

    renderChat({ goal: adapter });

    await waitFor(() => expect(adapter.getGoal).toHaveBeenCalled());

    const objective = await screen.findByText(activeGoal.objective);
    expect(objective).toHaveClass('truncate');

    fireEvent.click(
      screen.getByRole('button', { name: 'chat.goal.expandObjective' }),
    );

    expect(objective).not.toHaveClass('truncate');
    expect(objective).toHaveClass('whitespace-pre-wrap');

    fireEvent.click(
      screen.getByRole('button', { name: 'chat.goal.collapseObjective' }),
    );

    expect(objective).toHaveClass('truncate');
  });

  it('toggles goal mode from the slash palette without inserting /goal', async () => {
    enableGoalRuntimeCommand();
    const adapter = createGoalAdapter();

    renderChat({ goal: adapter });

    await waitFor(() =>
      expect(
        screen.getByTestId('runtime-capabilities-ready'),
      ).toHaveTextContent('ready'),
    );

    const textarea = screen.getByRole('textbox');
    setComposerText(textarea, '/go');
    fireEvent.mouseDown(await screen.findByText('Goal'));

    expect(screen.getByRole('textbox').textContent).toBe('');
    expect(screen.getByTestId('goal-command')).toHaveTextContent('goal-on');
    expect(screen.queryByText('chat.goal.label')).toBeNull();
    expect(adapter.getGoal).not.toHaveBeenCalled();
    expect(mocks.stream.submit).not.toHaveBeenCalled();

    setComposerText(screen.getByRole('textbox'), '/go');
    fireEvent.mouseDown(await screen.findByText('Goal'));

    expect(screen.getByRole('textbox').textContent).toBe('');
    expect(screen.getByTestId('goal-command')).toHaveTextContent('goal-off');
  });

  it('clears stale goal UI when the goal adapter becomes unavailable', async () => {
    enableGoalRuntimeCommand();
    mocks.stream.threadId = 'thread-1';
    mocks.stream.isLoading = true;
    const activeGoal: ThreadGoal = {
      id: 'goal-1',
      threadId: 'thread-1',
      objective: 'ship feature',
      status: 'active',
      tokensUsed: 0,
      elapsedSeconds: 0,
      continuationCount: 0,
    };
    const adapter = createGoalAdapter({
      getGoal: vi.fn(async () => activeGoal),
    });

    const { rerender } = render(
      <Chat
        clientSecret="secret"
        options={{
          ...baseChatOptions,
          goal: adapter,
        }}
      />,
    );

    await waitFor(() =>
      expect(screen.getByText('ship feature')).toBeInTheDocument(),
    );

    rerender(<Chat clientSecret="secret" options={baseChatOptions} />);

    await waitFor(() => expect(screen.queryByText('ship feature')).toBeNull());
  });

  it('localizes remaining built-in slash command labels and descriptions', async () => {
    mocks.stream.client.assistants.getRuntimeCapabilities.mockResolvedValueOnce(
      {
        skills: [],
        plugins: [],
        subAgents: [],
        commands: [],
      },
    );

    renderChat();

    await waitFor(() =>
      expect(
        screen.getByTestId('runtime-capabilities-ready'),
      ).toHaveTextContent('ready'),
    );

    const textarea = screen.getByRole('textbox');
    setComposerText(textarea, '/plan');

    expect(screen.getByText('Localized Plan')).toBeInTheDocument();
    expect(
      screen.getByText('[prompt] Localized plan mode'),
    ).toBeInTheDocument();
  });

  it('merges runtime command capability selections into submitted prompts', async () => {
    mocks.stream.client.assistants.getRuntimeCapabilities.mockResolvedValueOnce(
      {
        skills: [
          {
            id: 'skill-review',
            workspaceId: 'workspace-1',
            label: 'Review Skill',
          },
        ],
        plugins: [],
        subAgents: [],
        commands: [
          {
            name: 'review',
            label: 'Review',
            kind: 'prompt_workflow',
            workflow: {
              type: 'prompt_workflow',
              name: 'review',
              label: 'Review',
              description: 'Review the current target',
              tags: ['quality'],
            },
            action: {
              type: 'submit_prompt',
              template: 'Review this: {{args}}',
              runtimeCapabilities: {
                mode: 'allowlist',
                skills: { workspaceId: 'workspace-1', ids: ['skill-review'] },
                plugins: { nodeKeys: [] },
                subAgents: { nodeKeys: [] },
              },
            },
          },
        ],
      },
    );

    renderChat();

    await waitFor(() =>
      expect(
        screen.getByTestId('runtime-capabilities-ready'),
      ).toHaveTextContent('ready'),
    );

    const textarea = screen.getByRole('textbox');
    setComposerText(textarea, '/review src/app.ts');
    const send = screen.getByRole('button', { name: 'send' });
    await waitFor(() => expect(send).not.toBeDisabled());
    fireEvent.click(send);

    await waitFor(() => expect(mocks.stream.submit).toHaveBeenCalledTimes(1));
    expect(mocks.stream.submit.mock.calls[0][0].input).toEqual({
      input: 'Review this: src/app.ts',
      runtimeCapabilities: {
        mode: 'allowlist',
        skills: { workspaceId: 'workspace-1', ids: ['skill-review'] },
        plugins: { nodeKeys: [] },
        subAgents: { nodeKeys: [] },
        recommended: {
          skills: { workspaceId: 'workspace-1', ids: ['skill-review'] },
          plugins: { nodeKeys: [] },
          subAgents: { nodeKeys: [] },
        },
      },
      commandSource: {
        type: 'slash_command',
        name: 'review',
        source: 'runtime',
        executionType: 'submit_prompt',
        kind: 'prompt_workflow',
        workflow: {
          type: 'prompt_workflow',
          name: 'review',
          label: 'Review',
          description: 'Review the current target',
          tags: ['quality'],
        },
      },
    });
  });

  it('opens a skill-only selector from the /skills command', async () => {
    mocks.stream.client.assistants.getRuntimeCapabilities.mockResolvedValueOnce(
      {
        skills: [
          {
            id: 'skill-review',
            workspaceId: 'workspace-1',
            label: 'Review Skill',
          },
        ],
        plugins: [
          {
            nodeKey: 'plugin-search',
            provider: 'search',
            label: 'Search Plugin',
          },
        ],
        subAgents: [],
        commands: [],
      },
    );

    renderChat();

    await waitFor(() =>
      expect(
        screen.getByTestId('runtime-capabilities-ready'),
      ).toHaveTextContent('ready'),
    );

    const textarea = screen.getByRole('textbox');
    setComposerText(textarea, '/skills');
    const send = screen.getByRole('button', { name: 'send' });
    await waitFor(() => expect(send).not.toBeDisabled());
    fireEvent.click(send);

    expect(mocks.stream.submit).not.toHaveBeenCalled();
    expect(screen.getByText('Review Skill')).toBeInTheDocument();
    expect(screen.queryByText('Search Plugin')).not.toBeInTheDocument();
  });

  it('opens a plugin-only selector from the localized slash palette item', async () => {
    mocks.stream.client.assistants.getRuntimeCapabilities.mockResolvedValueOnce(
      {
        skills: [
          {
            id: 'skill-review',
            workspaceId: 'workspace-1',
            label: 'Review Skill',
          },
        ],
        plugins: [
          {
            nodeKey: 'plugin-search',
            provider: 'search',
            label: 'Search Plugin',
          },
        ],
        subAgents: [],
        commands: [],
      },
    );

    renderChat();

    await waitFor(() =>
      expect(
        screen.getByTestId('runtime-capabilities-ready'),
      ).toHaveTextContent('ready'),
    );

    const textarea = screen.getByRole('textbox');
    setComposerText(textarea, '/');
    fireEvent.mouseDown(screen.getByText('Localized Plugins'));

    await waitFor(() =>
      expect(screen.getByText('Search Plugin')).toBeInTheDocument(),
    );
    expect(screen.queryByText('Review Skill')).not.toBeInTheDocument();
    expect(screen.getByText('Localized Plan')).toBeInTheDocument();
    expect(
      screen.getByText('Localized Plugins').closest('button'),
    ).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('Search Plugin').closest('button')).toHaveAttribute(
      'data-depth',
      '1',
    );
  });

  it('shows a specific empty state for slash capability panels', async () => {
    mocks.stream.client.assistants.getRuntimeCapabilities.mockResolvedValueOnce(
      {
        skills: [
          {
            id: 'skill-review',
            workspaceId: 'workspace-1',
            label: 'Review Skill',
          },
        ],
        plugins: [],
        subAgents: [],
        commands: [],
      },
    );

    renderChat();

    await waitFor(() =>
      expect(
        screen.getByTestId('runtime-capabilities-ready'),
      ).toHaveTextContent('ready'),
    );

    const textarea = screen.getByRole('textbox');
    setComposerText(textarea, '/');
    fireEvent.mouseDown(screen.getByText('Localized Plugins'));

    await waitFor(() =>
      expect(
        screen.getByText('No localized plugins to add'),
      ).toBeInTheDocument(),
    );
  });

  it('hydrates session runtime capabilities from the active conversation options', async () => {
    mocks.stream.threadId = 'thread-1';
    mocks.stream.client.assistants.getRuntimeCapabilities.mockResolvedValueOnce(
      {
        skills: [
          {
            id: 'skill-default',
            workspaceId: 'workspace-1',
            label: 'Default Skill',
            default: true,
          },
        ],
        plugins: [
          {
            nodeKey: 'middleware-1',
            provider: 'sandbox',
            label: 'Sandbox',
          },
        ],
        subAgents: [
          {
            nodeKey: 'researcher',
            type: 'agent',
            label: 'Researcher',
          },
        ],
      },
    );
    mocks.stream.client.conversations.search.mockResolvedValueOnce({
      items: [
        {
          id: 'conversation-1',
          threadId: 'thread-1',
          options: {
            runtimeCapabilities: {
              mode: 'allowlist',
              skills: { workspaceId: 'workspace-1', ids: [] },
              plugins: { nodeKeys: ['middleware-1'] },
              subAgents: { nodeKeys: ['researcher'] },
            },
          },
        },
      ],
    });

    renderChat();

    await waitFor(() =>
      expect(screen.getByTestId('selected-plugins')).toHaveTextContent(
        'middleware-1',
      ),
    );
    expect(screen.getByTestId('selected-sub-agents')).toHaveTextContent(
      'researcher',
    );
    expect(mocks.stream.client.conversations.search).toHaveBeenCalledWith({
      where: {
        threadId: 'thread-1',
        xpertId: 'assistant-1',
        projectId: null,
      },
      limit: 1,
    });
  });

  it('persists session capability toggles without replacing other conversation options', async () => {
    mocks.stream.threadId = 'thread-1';
    mocks.stream.client.assistants.getRuntimeCapabilities.mockResolvedValueOnce(
      {
        skills: [],
        plugins: [
          {
            nodeKey: 'middleware-1',
            provider: 'sandbox',
            label: 'Sandbox',
          },
        ],
        subAgents: [
          {
            nodeKey: 'researcher',
            type: 'agent',
            label: 'Researcher',
          },
        ],
      },
    );
    mocks.stream.client.conversations.search.mockResolvedValue({
      items: [
        {
          id: 'conversation-1',
          threadId: 'thread-1',
          options: {
            parameters: { input: 'hello' },
            features: ['files'],
            runtimeCapabilities: {
              mode: 'allowlist',
              skills: { ids: [] },
              plugins: { nodeKeys: ['middleware-1'] },
              subAgents: { nodeKeys: [] },
            },
          },
        },
      ],
    });

    renderChat();

    await waitFor(() =>
      expect(screen.getByTestId('selected-plugins')).toHaveTextContent(
        'middleware-1',
      ),
    );
    fireEvent.click(screen.getByTestId('clear-plugin'));

    await waitFor(() =>
      expect(mocks.stream.client.conversations.update).toHaveBeenCalledWith(
        'conversation-1',
        {
          options: {
            parameters: { input: 'hello' },
            features: ['files'],
            runtimeCapabilities: {
              mode: 'allowlist',
              skills: { ids: [] },
              plugins: { nodeKeys: [] },
              subAgents: { nodeKeys: [] },
            },
          },
        },
      ),
    );

    fireEvent.click(screen.getByTestId('select-sub-agent'));

    await waitFor(() =>
      expect(mocks.stream.client.conversations.update).toHaveBeenLastCalledWith(
        'conversation-1',
        expect.objectContaining({
          options: expect.objectContaining({
            parameters: { input: 'hello' },
            runtimeCapabilities: expect.objectContaining({
              subAgents: { nodeKeys: ['researcher'] },
            }),
          }),
        }),
      ),
    );
  });

  it('submits composer-selected capabilities as available without human message chips', async () => {
    mocks.stream.client.assistants.getRuntimeCapabilities.mockResolvedValueOnce(
      {
        skills: [],
        plugins: [
          {
            nodeKey: 'middleware-1',
            provider: 'sandbox',
            label: 'Sandbox',
          },
        ],
        subAgents: [],
      },
    );

    renderChat();

    await waitFor(() =>
      expect(
        screen.getByTestId('runtime-capabilities-ready'),
      ).toHaveTextContent('ready'),
    );

    fireEvent.click(screen.getByTestId('select-plugin'));
    const textarea = screen.getByRole('textbox');
    setComposerText(textarea, 'run it');
    const send = screen.getByRole('button', { name: 'send' });
    await waitFor(() => expect(send).not.toBeDisabled());
    fireEvent.click(send);

    await waitFor(() => expect(mocks.stream.submit).toHaveBeenCalledTimes(1));
    expect(
      mocks.stream.submit.mock.calls[0][0].input.runtimeCapabilities,
    ).toEqual({
      mode: 'allowlist',
      skills: { ids: [] },
      plugins: { nodeKeys: ['middleware-1'] },
      subAgents: { nodeKeys: [] },
    });

    const optimisticValues =
      mocks.stream.submit.mock.calls[0][1].optimisticValues?.({
        messages: [],
      });
    expect(optimisticValues?.messages[0].runtimeCapabilityOptions).toBe(
      undefined,
    );
  });

  it('keeps composer-available capabilities selectable from the slash palette', async () => {
    mocks.stream.client.assistants.getRuntimeCapabilities.mockResolvedValueOnce(
      {
        skills: [],
        plugins: [
          {
            nodeKey: 'middleware-1',
            provider: 'sandbox',
            label: 'Sandbox',
          },
        ],
        subAgents: [],
      },
    );

    renderChat();

    await waitFor(() =>
      expect(
        screen.getByTestId('runtime-capabilities-ready'),
      ).toHaveTextContent('ready'),
    );

    fireEvent.click(screen.getByTestId('select-plugin'));
    const textarea = screen.getByRole('textbox');
    setComposerText(textarea, '/sand');

    expect(await screen.findByText('Sandbox')).toBeInTheDocument();
  });

  it('submits run-only palette capabilities without persisting them to the conversation', async () => {
    mocks.stream.client.assistants.getRuntimeCapabilities.mockResolvedValueOnce(
      {
        skills: [],
        plugins: [
          {
            nodeKey: 'middleware-1',
            provider: 'sandbox',
            label: 'Sandbox',
            meta: {
              icon: {
                type: 'svg',
                value:
                  '<svg viewBox="0 0 16 16"><path d="M2 2h12v12H2z" /></svg>',
              },
            },
          },
        ],
        subAgents: [],
      },
    );
    mocks.stream.client.conversations.search.mockResolvedValue({
      items: [
        {
          id: 'conversation-1',
          threadId: 'thread-new',
          options: {
            parameters: { input: 'seed' },
          },
        },
      ],
    });
    mocks.stream.submit.mockImplementationOnce(
      async (_values: any, options: any) => {
        await options?.onThreadResolved?.('thread-new');
      },
    );

    renderChat();

    await waitFor(() =>
      expect(
        screen.getByTestId('runtime-capabilities-ready'),
      ).toHaveTextContent('ready'),
    );

    let textarea = screen.getByRole('textbox');
    textarea = setComposerText(textarea, '/sand');
    fireEvent.mouseDown(await screen.findByText('Sandbox'));
    textarea = screen.getByRole('textbox');
    placeComposerCaretAtEnd(textarea);
    textarea = insertComposerText(textarea, 'run it');
    const send = screen.getByRole('button', { name: 'send' });
    await waitFor(() => expect(send).not.toBeDisabled());
    fireEvent.click(send);

    await waitFor(() => expect(mocks.stream.submit).toHaveBeenCalledTimes(1));
    expect(
      mocks.stream.submit.mock.calls[0][0].input.runtimeCapabilities,
    ).toEqual({
      mode: 'allowlist',
      skills: { ids: [] },
      plugins: { nodeKeys: ['middleware-1'] },
      subAgents: { nodeKeys: [] },
      recommended: {
        skills: { ids: [] },
        plugins: { nodeKeys: ['middleware-1'] },
        subAgents: { nodeKeys: [] },
      },
    });
    const optimisticValues =
      mocks.stream.submit.mock.calls[0][1].optimisticValues?.({
        messages: [],
      });
    expect(optimisticValues?.messages[0].runtimeCapabilities).toEqual({
      mode: 'allowlist',
      skills: { ids: [] },
      plugins: { nodeKeys: ['middleware-1'] },
      subAgents: { nodeKeys: [] },
      recommended: {
        skills: { ids: [] },
        plugins: { nodeKeys: ['middleware-1'] },
        subAgents: { nodeKeys: [] },
      },
    });
    expect(optimisticValues?.messages[0].runtimeCapabilityOptions).toEqual([
      expect.objectContaining({
        id: 'middleware-1',
        label: 'Sandbox',
        type: 'plugin',
      }),
    ]);
    await waitFor(() =>
      expect(mocks.stream.client.conversations.update).toHaveBeenCalledWith(
        'conversation-1',
        {
          options: {
            parameters: { input: 'seed' },
            runtimeCapabilities: {
              mode: 'allowlist',
              skills: { ids: [] },
              plugins: { nodeKeys: [] },
              subAgents: { nodeKeys: [] },
            },
          },
        },
      ),
    );
  });

  it('renders only recommended runtime capabilities on human messages', async () => {
    mocks.stream.client.assistants.getRuntimeCapabilities.mockResolvedValueOnce(
      {
        skills: [],
        plugins: [
          {
            nodeKey: 'middleware-1',
            provider: 'sandbox',
            label: 'Sandbox',
          },
          {
            nodeKey: 'middleware-available',
            provider: 'available',
            label: 'Available Only',
          },
        ],
        subAgents: [],
      },
    );
    mocks.stream.messages = [
      {
        id: 'human-1',
        type: 'human',
        content: 'run it',
        runtimeCapabilities: {
          mode: 'allowlist',
          skills: { ids: [] },
          plugins: { nodeKeys: ['middleware-1'] },
          subAgents: { nodeKeys: [] },
          recommended: {
            skills: { ids: [] },
            plugins: { nodeKeys: ['middleware-1'] },
            subAgents: { nodeKeys: [] },
          },
        },
      },
      {
        id: 'human-2',
        type: 'human',
        content: 'available only',
        runtimeCapabilities: {
          mode: 'allowlist',
          skills: { ids: [] },
          plugins: { nodeKeys: ['middleware-available'] },
          subAgents: { nodeKeys: [] },
        },
      },
    ] as any;

    renderChat();

    await waitFor(() =>
      expect(
        screen.getByTestId('runtime-capabilities-ready'),
      ).toHaveTextContent('ready'),
    );

    expect(screen.getByText('Sandbox')).toBeInTheDocument();
    expect(screen.queryByText('Available Only')).not.toBeInTheDocument();
    expect(screen.getByText('run it')).toBeInTheDocument();
  });

  it('inserts slash-selected runtime capabilities as atomic composer tokens', async () => {
    mocks.stream.client.assistants.getRuntimeCapabilities.mockResolvedValueOnce(
      {
        skills: [],
        plugins: [
          {
            nodeKey: 'middleware-1',
            provider: 'sandbox',
            label: 'Sandbox',
            meta: {
              icon: {
                type: 'svg',
                value:
                  '<svg viewBox="0 0 16 16"><path d="M2 2h12v12H2z" /></svg>',
              },
            },
          },
        ],
        subAgents: [],
      },
    );

    renderChat();

    await waitFor(() =>
      expect(
        screen.getByTestId('runtime-capabilities-ready'),
      ).toHaveTextContent('ready'),
    );

    let textbox = screen.getByRole('textbox');
    textbox = setComposerText(textbox, '/sand');
    fireEvent.mouseDown(await screen.findByText('Sandbox'));
    textbox = screen.getByRole('textbox');

    await waitFor(() =>
      expect(within(textbox).getByText('Sandbox')).toBeInTheDocument(),
    );
    expect(
      textbox.querySelector('[data-slot="runtime-capability-meta-icon"] svg'),
    ).toBeInTheDocument();

    placeComposerCaretAtEnd(textbox);
    fireEvent.keyDown(textbox, { key: 'Backspace' });

    await waitFor(() =>
      expect(screen.getByRole('textbox')).not.toHaveTextContent('Sandbox'),
    );

    setComposerText(screen.getByRole('textbox'), 'run it');
    const send = screen.getByRole('button', { name: 'send' });
    await waitFor(() => expect(send).not.toBeDisabled());
    fireEvent.click(send);

    await waitFor(() => expect(mocks.stream.submit).toHaveBeenCalledTimes(1));
    expect(
      mocks.stream.submit.mock.calls[0][0].input.runtimeCapabilities,
    ).toEqual({
      mode: 'allowlist',
      skills: { ids: [] },
      plugins: { nodeKeys: [] },
      subAgents: { nodeKeys: [] },
    });
  });

  it('inserts parent-requested runtime capabilities as atomic composer tokens', async () => {
    mocks.stream.client.assistants.getRuntimeCapabilities.mockResolvedValueOnce(
      {
        skills: [
          {
            id: 'skill-docs',
            workspaceId: 'workspace-1',
            label: 'documents',
            repositoryName: 'Documents',
            meta: {
              color: '#2563EB',
            },
          },
        ],
        plugins: [],
        subAgents: [],
      },
    );

    renderChat();

    await waitFor(() =>
      expect(
        screen.getByTestId('runtime-capabilities-ready'),
      ).toHaveTextContent('ready'),
    );

    expect(mocks.parentMessengerOptions?.onSetComposerValue).toEqual(
      expect.any(Function),
    );
    await act(async () => {
      mocks.parentMessengerOptions?.onSetComposerValue?.({
        runtimeCapabilities: {
          mode: 'allowlist',
          skills: { workspaceId: 'workspace-1', ids: ['skill-docs'] },
          plugins: { nodeKeys: [] },
          subAgents: { nodeKeys: [] },
        },
        insertRuntimeCapabilities: true,
      });
    });

    await waitFor(() =>
      expect(
        within(screen.getByRole('textbox')).getByText('documents'),
      ).toBeInTheDocument(),
    );

    let textbox = screen.getByRole('textbox');
    const capabilityToken = textbox.querySelector(
      '[data-composer-capability-key]',
    );
    expect(capabilityToken).toHaveAttribute('data-capability-id', 'skill-docs');
    expect(capabilityToken).toHaveStyle({ color: '#2563EB' });
    expect(textbox.textContent).toContain('documents ');

    textbox = insertComposerText(textbox, 'create a doc');
    const send = screen.getByRole('button', { name: 'send' });
    await waitFor(() => expect(send).not.toBeDisabled());
    fireEvent.click(send);

    await waitFor(() => expect(mocks.stream.submit).toHaveBeenCalledTimes(1));
    expect(
      mocks.stream.submit.mock.calls[0][0].input.runtimeCapabilities,
    ).toEqual({
      mode: 'allowlist',
      skills: { workspaceId: 'workspace-1', ids: ['skill-docs'] },
      plugins: { nodeKeys: [] },
      subAgents: { nodeKeys: [] },
      recommended: {
        skills: { workspaceId: 'workspace-1', ids: ['skill-docs'] },
        plugins: { nodeKeys: [] },
        subAgents: { nodeKeys: [] },
      },
    });
  });

  it('places parent-requested runtime capability tokens before prompt text', async () => {
    mocks.stream.client.assistants.getRuntimeCapabilities.mockResolvedValueOnce(
      {
        skills: [
          {
            id: 'skill-docs',
            workspaceId: 'workspace-1',
            label: 'documents',
            repositoryName: 'Documents',
          },
        ],
        plugins: [],
        subAgents: [],
      },
    );

    renderChat();

    await waitFor(() =>
      expect(
        screen.getByTestId('runtime-capabilities-ready'),
      ).toHaveTextContent('ready'),
    );

    const prompt = 'Draft a project memo as a document';
    await act(async () => {
      mocks.parentMessengerOptions?.onSetComposerValue?.({
        text: prompt,
        runtimeCapabilities: {
          mode: 'allowlist',
          skills: { workspaceId: 'workspace-1', ids: ['skill-docs'] },
          plugins: { nodeKeys: [] },
          subAgents: { nodeKeys: [] },
        },
        insertRuntimeCapabilities: true,
      });
    });

    await waitFor(() =>
      expect(
        within(screen.getByRole('textbox')).getByText('documents'),
      ).toBeInTheDocument(),
    );
    expect(screen.getByRole('textbox')).toHaveTextContent(prompt);

    const textContent = screen.getByRole('textbox').textContent ?? '';
    expect(textContent).toContain(`documents ${prompt}`);
    expect(textContent.indexOf('documents')).toBeLessThan(
      textContent.indexOf(prompt),
    );
  });

  it('keeps the contenteditable node stable during IME composition', async () => {
    renderChat();

    const textbox = screen.getByRole('textbox');
    const send = screen.getByRole('button', { name: 'send' });
    fireEvent.compositionStart(textbox);
    textbox.textContent = 'pin';
    fireEvent.input(textbox, { isComposing: true });
    expect(screen.getByRole('textbox')).toBe(textbox);
    expect(send).toBeDisabled();

    textbox.textContent = '拼';
    fireEvent.compositionEnd(textbox);
    expect(screen.getByRole('textbox')).toBe(textbox);

    await waitFor(() => expect(send).not.toBeDisabled());
    fireEvent.click(send);

    await waitFor(() => expect(mocks.stream.submit).toHaveBeenCalledTimes(1));
    expect(mocks.stream.submit.mock.calls[0][0].input).toEqual({
      input: '拼',
    });
  });

  it('scrolls the slash palette active item into view during keyboard navigation', async () => {
    renderChat({
      composer: {
        slashCommands: Array.from({ length: 6 }, (_, index) => ({
          name: `cmd-${index}`,
          label: `Command ${index}`,
          action: {
            type: 'insert_text',
            template: `Command ${index}`,
          },
        })),
      },
    });

    let textbox = screen.getByRole('textbox');
    textbox = setComposerText(textbox, '/');

    const palette = document.querySelector(
      '[data-slot="slash-palette"]',
    ) as HTMLDivElement | null;
    if (!palette) {
      throw new Error('Expected slash palette to be rendered.');
    }
    const options = Array.from(
      document.querySelectorAll('[data-slot="slash-palette-option"]'),
    ) as HTMLButtonElement[];
    expect(options.length).toBeGreaterThan(3);

    let scrollTop = 0;
    Object.defineProperty(palette, 'scrollTop', {
      configurable: true,
      get: () => scrollTop,
      set: (value) => {
        scrollTop = value;
      },
    });
    palette.getBoundingClientRect = () =>
      ({
        top: 0,
        bottom: 100,
        left: 0,
        right: 300,
        width: 300,
        height: 100,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      }) as DOMRect;
    options.forEach((option, index) => {
      option.getBoundingClientRect = () =>
        ({
          top: index * 40 - scrollTop,
          bottom: index * 40 + 40 - scrollTop,
          left: 0,
          right: 300,
          width: 300,
          height: 40,
          x: 0,
          y: index * 40 - scrollTop,
          toJSON: () => ({}),
        }) as DOMRect;
    });

    fireEvent.keyDown(textbox, { key: 'ArrowDown' });
    fireEvent.keyDown(textbox, { key: 'ArrowDown' });

    await waitFor(() => expect(scrollTop).toBeGreaterThan(0));
  });

  it('adds planMode to input and state.human when enabled', async () => {
    renderChat();

    const composerShell = document.querySelector(
      '[data-slot="composer-input-shell"]',
    );
    expect(composerShell).toHaveAttribute('data-layout', 'stacked');

    fireEvent.click(screen.getByTestId('plan-mode-toggle'));
    expect(composerShell).toHaveAttribute('data-layout', 'stacked');

    const textarea = screen.getByRole('textbox');
    setComposerText(textarea, 'plan this');
    const send = screen.getByRole('button', { name: 'send' });
    await waitFor(() => expect(send).not.toBeDisabled());
    fireEvent.click(send);

    await waitFor(() => expect(mocks.stream.submit).toHaveBeenCalledTimes(1));
    expect(mocks.stream.submit).toHaveBeenCalledWith(
      expect.objectContaining({
        input: {
          input: 'plan this',
          planMode: true,
        },
        state: {
          human: {
            input: 'plan this',
            planMode: true,
          },
        },
      }),
      expect.any(Object),
    );
  });
});
