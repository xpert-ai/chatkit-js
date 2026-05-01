import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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
          getRuntimeCapabilities: vi.fn().mockRejectedValue({ status: 404 }),
        },
        conversations: {
          search: vi.fn().mockResolvedValue({ items: [] }),
          update: vi.fn(),
        },
      },
      apiUrl: 'https://api.example.com',
      assistantId: 'assistant-1',
      apiKey: 'secret',
      organizationId: undefined,
      threadId: null as string | null,
      contextUsageByAgentKey: {},
      values: { messages: [] },
      messages: [],
      todos: null,
      pendingFollowUps: [],
      pendingRequestUserInput: null,
      followUpBehavior: 'queue',
      isLoading: false,
      isReady: true,
      error: null,
      loadThread: vi.fn(),
      loadConversationMessages: vi.fn(),
      submit: vi.fn(),
      stop: vi.fn(),
      reset: vi.fn(),
      setFollowUpBehavior: vi.fn(),
      removePendingFollowUp: vi.fn(),
      canSendPendingFollowUpNow: vi.fn().mockReturnValue(false),
      sendPendingFollowUpNow: vi.fn(),
      promotePendingFollowUpToSteer: vi.fn(),
      submitRequestUserInput: vi.fn(),
      setThreadId: vi.fn(),
    },
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
    t: (key: string) => key,
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
  useParentMessenger: () => undefined,
}));

vi.mock('./composer/ComposerMenu', () => ({
  ComposerMenu: ({
    planModeEnabled,
    onPlanModeChange,
    runtimeCapabilities,
    selectedRuntimeCapabilities,
    onRuntimeCapabilityToggle,
  }: {
    planModeEnabled?: boolean;
    onPlanModeChange?: (enabled: boolean) => void;
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

vi.mock('./history/HistorySidebar', () => ({
  HistorySidebar: () => null,
}));

vi.mock('./composer/pending-follow-ups', () => ({
  PendingFollowUps: () => null,
}));

vi.mock('./composer/pending-todos', () => ({
  PendingTodos: () => null,
}));

vi.mock('./composer/request-user-input-panel', () => ({
  RequestUserInputPanel: () => null,
}));

vi.mock('./thread/messages/ai', () => ({
  AssistantMessage: () => null,
  AssistantStreamingIndicator: () => null,
}));

vi.mock('./thread/MessageActions', () => ({
  MessageActions: () => null,
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
  ContextUsageIndicator: () => null,
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

import { Chat } from './chat';

function renderChat() {
  return render(
    <Chat
      clientSecret="secret"
      options={{
        api: {
          apiUrl: 'https://api.example.com',
          getClientSecret: vi.fn(async () => ({ secret: 'secret' })),
        },
      }}
    />,
  );
}

describe('Chat plan mode payload', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    globalThis.fetch = vi.fn(async () => new Response(null, { status: 404 }));
    mocks.stream.client.assistants.getRuntimeCapabilities.mockClear();
    mocks.stream.client.conversations.search.mockClear();
    mocks.stream.client.conversations.search.mockResolvedValue({ items: [] });
    mocks.stream.client.conversations.update.mockClear();
    mocks.stream.submit.mockClear();
    mocks.stream.threadId = null;
    mocks.stream.messages = [];
    mocks.stream.pendingFollowUps = [];
    mocks.stream.pendingRequestUserInput = null;
    mocks.stream.isLoading = false;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('omits planMode from regular sends by default', async () => {
    renderChat();

    const composerShell = document.querySelector(
      '[data-slot="composer-input-shell"]',
    );
    expect(composerShell).toHaveAttribute('data-layout', 'inline');

    const textarea = screen.getByRole('textbox');
    fireEvent.change(textarea, { target: { value: 'hello' } });
    expect(composerShell).toHaveAttribute('data-layout', 'inline');

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
    fireEvent.change(textarea, { target: { value: 'hello' } });
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
      where: { threadId: 'thread-1' },
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

  it('submits run-only palette capabilities without persisting them to the conversation', async () => {
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

    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
    Object.defineProperty(textarea, 'selectionStart', {
      configurable: true,
      writable: true,
      value: 5,
    });
    Object.defineProperty(textarea, 'selectionEnd', {
      configurable: true,
      writable: true,
      value: 5,
    });
    fireEvent.change(textarea, {
      target: { value: '/sand', selectionStart: 5, selectionEnd: 5 },
    });
    fireEvent.mouseDown(await screen.findByText('Sandbox'));
    fireEvent.change(textarea, { target: { value: 'run it' } });
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

  it('adds planMode to input and state.human when enabled', async () => {
    renderChat();

    const composerShell = document.querySelector(
      '[data-slot="composer-input-shell"]',
    );
    expect(composerShell).toHaveAttribute('data-layout', 'inline');

    fireEvent.click(screen.getByTestId('plan-mode-toggle'));
    expect(composerShell).toHaveAttribute('data-layout', 'stacked');

    const textarea = screen.getByRole('textbox');
    fireEvent.change(textarea, { target: { value: 'plan this' } });
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
