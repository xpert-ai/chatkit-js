import React from 'react';
import {
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
      followUpBehavior: 'queue',
      isLoading: false,
      isReady: true,
      error: null as unknown,
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
      stopRuntimeActivityItem: vi.fn(),
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

import type { ChatKitOptions } from '@xpert-ai/chatkit-types';
import { Chat } from './chat';

function renderChat(extraOptions: Partial<ChatKitOptions> = {}) {
  return render(
    <Chat
      clientSecret="secret"
      options={{
        api: {
          apiUrl: 'https://api.example.com',
          getClientSecret: vi.fn(async () => ({ secret: 'secret' })),
        },
        ...extraOptions,
      }}
    />,
  );
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
    mocks.stream.error = null;
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
    setComposerText(textarea, 'hello');
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
      },
      commandSource: {
        type: 'slash_command',
        name: 'review',
        source: 'runtime',
        executionType: 'submit_prompt',
      },
    });
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

  it('renders selected runtime capabilities on human messages', async () => {
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

  it('keeps the contenteditable node stable during IME composition', async () => {
    renderChat();

    const textbox = screen.getByRole('textbox');
    fireEvent.compositionStart(textbox);
    textbox.textContent = 'pin';
    fireEvent.input(textbox);
    expect(screen.getByRole('textbox')).toBe(textbox);

    textbox.textContent = '拼';
    fireEvent.compositionEnd(textbox);
    expect(screen.getByRole('textbox')).toBe(textbox);

    const send = screen.getByRole('button', { name: 'send' });
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
    expect(composerShell).toHaveAttribute('data-layout', 'inline');

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
