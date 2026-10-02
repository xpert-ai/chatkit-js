import type { ChatKitTheme } from '@xpert-ai/chatkit-types';
import type { PendingHITLRequest } from '../../../lib/hitl';

import React from 'react';

import { fireEvent, render, screen } from '@testing-library/react';

import { afterEach, beforeEach, expect, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  return {
    theme: { radius: 'soft', density: 'normal' } as ChatKitTheme,
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
        threads: {
          get: vi.fn().mockResolvedValue({ operation: null }),
        },
      },
      apiUrl: 'https://api.example.com',
      assistantId: 'assistant-1',
      apiKey: 'secret',
      organizationId: undefined,
      threadId: null as string | null,
      conversationId: null as string | null,
      projectId: undefined as string | undefined,
      projectScopeResolved: false,
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
      pendingHITLRequest: null as PendingHITLRequest | null,
      isLoading: false,
      isThreadInterrupted: false,
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

vi.mock('../../../providers/Stream', () => ({
  useStreamContext: () => mocks.stream,
}));

vi.mock('../../../hooks/useStream', () => ({
  useStreamManager: () => ({
    stream: mocks.stream,
    streamRef: { current: mocks.stream },
    setStream: vi.fn(),
  }),
}));

vi.mock('../../../hooks/useThreads', () => ({
  useThreads: () => ({
    threads: [],
    deleteThread: vi.fn(),
    refreshThreads: vi.fn().mockResolvedValue(undefined),
    isLoading: false,
  }),
}));

vi.mock('../../../i18n/useChatkitTranslation', () => ({
  useChatkitTranslation: () => ({
    t: (key: string, options?: { defaultValue?: string; name?: string }) => {
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
      if (key === 'composer.capabilities.removeSelection')
        return `Remove selection: ${options?.name}`;
      return labels[key] ?? options?.defaultValue ?? key;
    },
    i18n: {
      language: 'en-US',
    },
  }),
}));

vi.mock('../../../providers/Theme', () => ({
  useTheme: () => ({
    theme: mocks.theme,
    isDarkMode: false,
  }),
}));

vi.mock('../../../hooks/useParentMessenger', () => ({
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

vi.mock('../../composer/ComposerMenu', () => ({
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
      skills: { ids: string[] };
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
      <span data-testid="selected-skills">
        {selectedRuntimeCapabilities?.skills.ids.join(',') ?? ''}
      </span>
      <button
        type="button"
        data-testid="select-skill"
        onClick={() => onRuntimeCapabilityToggle?.('skill', 'skill-docs', true)}
      >
        select skill
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

vi.mock('../../composer/SendButton', () => ({
  SendButton: ({ disabled }: { disabled?: boolean }) => (
    <button type="submit" disabled={disabled}>
      send
    </button>
  ),
}));

vi.mock('../../composer/ProjectSelector', () => ({
  ProjectSelector: ({
    activeProjectId,
    locked,
    disabled,
    onAvailabilityChange,
    onProjectChange,
  }: {
    activeProjectId?: string;
    locked?: boolean;
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
        {locked ? (
          <span data-testid="project-locked">{activeProjectId}</span>
        ) : (
          <button
            type="button"
            data-testid="project-selector"
            disabled={disabled}
            onClick={() => onProjectChange?.('project-2')}
          >
            {activeProjectId ?? 'select project'}
          </button>
        )}
      </div>
    );
  },
}));

vi.mock('../../history/HistorySidebar', () => ({
  HistorySidebar: () => null,
}));

vi.mock('../../composer/pending-follow-ups', () => ({
  PendingFollowUps: () => null,
}));

vi.mock('../../composer/pending-todos', () => ({
  PendingTodos: () => null,
}));

vi.mock('../../composer/pending-runtime-services', () => ({
  PendingRuntimeServices: () => null,
}));

vi.mock('../../composer/request-user-input-panel', () => ({
  RequestUserInputPanel: () => null,
}));

vi.mock('../../thread/messages/ai', () => ({
  AssistantMessage: () => null,
  AssistantStreamingIndicator: () => null,
}));

vi.mock('../../thread/MessageActions', () => ({
  MessageActions: ({ content }: { content: string }) => (
    <div data-testid={`message-actions-${content}`} />
  ),
}));

vi.mock('../../thread/StartScreen', () => ({
  StartScreen: () => null,
}));

vi.mock('../../ui/chatkit-avatar', () => ({
  ChatkitAvatar: () => null,
  extractAssistantAvatar: () => null,
  normalizeChatkitAvatar: (avatar: unknown) => avatar,
}));

vi.mock('../../thread/context-usage-indicator', () => ({
  ContextUsageIndicator: () => <span data-testid="context-usage" />,
}));

vi.mock('../../ui/button', () => ({
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

import { Chat as ChatComponent } from '../../chat';

// Bind after Vitest registers the fixture's hoisted mocks. A direct re-export
// can load the component before those mocks are applied.
export const Chat = ChatComponent;

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

export function setupChatTest() {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    mocks.theme = { radius: 'soft', density: 'normal' };
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
    mocks.stream.projectId = undefined;
    mocks.stream.projectScopeResolved = false;
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
    mocks.stream.pendingHITLRequest = null;
    mocks.stream.isLoading = false;
    mocks.stream.isThreadInterrupted = false;
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
}

export {
  baseChatOptions,
  createGoalAdapter,
  enableGoalRuntimeCommand,
  enableSelectableGoalRuntimeCommand,
  getSubmittedOptimisticMessages,
  goalRuntimeCapabilities,
  insertComposerText,
  mocks,
  placeComposerCaretAtEnd,
  renderChat,
  selectableGoalRuntimeCapabilities,
  setComposerText,
};
