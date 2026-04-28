import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  return {
    stream: {
      client: {
        contexts: {
          uploadFile: vi.fn(),
        },
        assistants: {
          get: vi.fn().mockResolvedValue(null),
        },
      },
      apiUrl: 'https://api.example.com',
      assistantId: 'assistant-1',
      apiKey: 'secret',
      organizationId: undefined,
      threadId: null,
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
  }: {
    planModeEnabled?: boolean;
    onPlanModeChange?: (enabled: boolean) => void;
  }) => (
    <button
      type="button"
      data-testid="plan-mode-toggle"
      onClick={() => onPlanModeChange?.(!planModeEnabled)}
    >
      {planModeEnabled ? 'plan-on' : 'plan-off'}
    </button>
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
  beforeEach(() => {
    mocks.stream.submit.mockClear();
    mocks.stream.messages = [];
    mocks.stream.pendingFollowUps = [];
    mocks.stream.pendingRequestUserInput = null;
    mocks.stream.isLoading = false;
  });

  it('omits planMode from regular sends by default', async () => {
    renderChat();

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
        },
      }),
      expect.any(Object),
    );
    expect(mocks.stream.submit.mock.calls[0][0].input).not.toHaveProperty(
      'planMode',
    );
  });

  it('adds planMode to input and state.human when enabled', async () => {
    renderChat();

    fireEvent.click(screen.getByTestId('plan-mode-toggle'));
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
