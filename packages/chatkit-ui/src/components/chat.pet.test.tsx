import React from 'react';
import { render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ChatKitOptions } from '@xpert-ai/chatkit-types';

const mocks = vi.hoisted(() => ({
  parentMessengerSendEvent: vi.fn(),
  threads: [] as Array<{
    id: string;
    title?: string;
    status?: string;
    error?: string;
    recordId?: string;
  }>,
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
    messages: [] as Array<{
      id?: string;
      type: string;
      content: string;
      createdAt?: string;
      updatedAt?: string;
    }>,
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
    refreshThreads: vi.fn().mockResolvedValue(undefined),
    isLoading: false,
  }),
}));

vi.mock('../i18n/useChatkitTranslation', () => ({
  useChatkitTranslation: () => ({
    t: (key: string, options?: { defaultValue?: string }) =>
      options?.defaultValue ?? key,
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
  useParentMessenger: () => ({
    isParentAvailable: true,
    sendCommand: vi.fn(),
    sendEvent: mocks.parentMessengerSendEvent,
  }),
}));

vi.mock('./composer/ComposerMenu', () => ({
  ComposerMenu: () => <div data-testid="composer-menu" />,
}));

vi.mock('./composer/SendButton', () => ({
  SendButton: () => <button type="submit">send</button>,
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

vi.mock('./composer/SlashPalette', () => ({
  SlashPalette: () => null,
}));

vi.mock('./thread/context-usage-indicator', () => ({
  ContextUsageIndicator: () => null,
}));

vi.mock('./thread/StartScreen', () => ({
  StartScreen: () => <div data-testid="start-screen" />,
}));

import { Chat } from './chat';

const baseOptions: ChatKitOptions = {
  api: {
    apiUrl: 'https://api.example.com',
    xpertId: 'assistant-1',
    getClientSecret: async () => 'secret',
  },
};

function installMatchMedia() {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

describe('Chat pet integration', () => {
  beforeEach(() => {
    installMatchMedia();
    window.localStorage.clear();
    mocks.stream.client.assistants.get.mockClear();
    mocks.threads = [];
    mocks.stream.messages = [];
    mocks.stream.threadId = null;
    mocks.stream.isLoading = false;
    mocks.stream.isReady = true;
    mocks.stream.error = null;
    mocks.parentMessengerSendEvent.mockClear();
  });

  it('does not send pet bridge events by default', async () => {
    render(<Chat options={baseOptions} />);

    await waitFor(() =>
      expect(mocks.stream.client.assistants.get).toHaveBeenCalled(),
    );
    expect(mocks.parentMessengerSendEvent).not.toHaveBeenCalledWith(
      'pet_state_change',
      expect.anything(),
    );
  });

  it('sends the default pet state when enabled', async () => {
    render(<Chat options={{ ...baseOptions, pet: true }} />);

    await waitFor(() =>
      expect(mocks.stream.client.assistants.get).toHaveBeenCalled(),
    );
    await waitFor(() =>
      expect(mocks.parentMessengerSendEvent).toHaveBeenCalledWith(
        'pet_state_change',
        { state: 'idle' },
      ),
    );
  });

  it('sends the active thread summary through log events', async () => {
    mocks.stream.threadId = 'thread-1';
    mocks.threads = [
      {
        id: 'thread-1',
        title: 'Research pets',
        status: 'completed',
      },
    ];
    mocks.stream.messages = [
      {
        id: 'human-1',
        type: 'human',
        content: 'Please research pet bubbles',
      },
      {
        id: 'assistant-1',
        type: 'assistant',
        content: 'The pet bubble is ready.',
        updatedAt: '2026-05-05T00:00:00.000Z',
      },
    ];

    render(<Chat options={{ ...baseOptions, pet: true }} />);

    await waitFor(() =>
      expect(mocks.parentMessengerSendEvent).toHaveBeenCalledWith(
        'public_event',
        [
          'log',
          {
            name: 'thread.summary',
            data: {
              threadId: 'thread-1',
              title: 'Research pets',
              message: 'The pet bubble is ready.',
              status: 'completed',
              messageId: 'assistant-1',
              updatedAt: '2026-05-05T00:00:00.000Z',
            },
          },
        ],
      ),
    );
  });

  it('marks the pet thread summary as running while the thread is active', async () => {
    mocks.stream.threadId = 'thread-1';
    mocks.stream.isLoading = true;
    mocks.threads = [
      {
        id: 'thread-1',
        title: 'Running thread',
        status: 'running',
      },
    ];
    mocks.stream.messages = [
      {
        id: 'assistant-1',
        type: 'assistant',
        content: 'Working on it.',
      },
    ];

    render(<Chat options={{ ...baseOptions, pet: true }} />);

    await waitFor(() =>
      expect(mocks.parentMessengerSendEvent).toHaveBeenCalledWith(
        'public_event',
        [
          'log',
          {
            name: 'thread.summary',
            data: expect.objectContaining({
              threadId: 'thread-1',
              status: 'running',
            }),
          },
        ],
      ),
    );
  });

  it('marks the pet thread summary as failed on thread errors', async () => {
    mocks.stream.threadId = 'thread-1';
    mocks.stream.error = new Error('Thread failed');
    mocks.threads = [
      {
        id: 'thread-1',
        title: 'Failed thread',
        status: 'completed',
      },
    ];
    mocks.stream.messages = [
      {
        id: 'assistant-1',
        type: 'assistant',
        content: 'I hit an error.',
      },
    ];

    render(<Chat options={{ ...baseOptions, pet: true }} />);

    await waitFor(() =>
      expect(mocks.parentMessengerSendEvent).toHaveBeenCalledWith(
        'public_event',
        [
          'log',
          {
            name: 'thread.summary',
            data: expect.objectContaining({
              threadId: 'thread-1',
              status: 'failed',
            }),
          },
        ],
      ),
    );
  });

  it('sends the pet thread summary with the error message when the thread fails before an assistant message', async () => {
    mocks.stream.threadId = 'thread-1';
    mocks.stream.error = new Error('Conversation failed before output');
    mocks.threads = [
      {
        id: 'thread-1',
        title: 'Failed before output',
        status: 'completed',
      },
    ];
    mocks.stream.messages = [
      {
        id: 'human-1',
        type: 'human',
        content: 'Please do the thing',
      },
    ];

    render(<Chat options={{ ...baseOptions, pet: true }} />);

    await waitFor(() =>
      expect(mocks.parentMessengerSendEvent).toHaveBeenCalledWith(
        'public_event',
        [
          'log',
          {
            name: 'thread.summary',
            data: expect.objectContaining({
              threadId: 'thread-1',
              title: 'Failed before output',
              message: 'Conversation failed before output',
              status: 'failed',
            }),
          },
        ],
      ),
    );
  });
});
