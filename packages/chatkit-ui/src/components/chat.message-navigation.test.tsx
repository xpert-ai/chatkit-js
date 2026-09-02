import React from 'react';
import { render, screen } from '@testing-library/react';
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
      contexts: {
        fetch: vi.fn(),
        deleteFile: vi.fn(),
      },
      assistants: {
        get: vi.fn(() => new Promise(() => undefined)),
        getRuntimeCapabilities: vi.fn(() => new Promise(() => undefined)),
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
    threadId: 'thread-1' as string | null,
    contextUsageByAgentKey: {},
    values: {
      messages: [] as Array<{
        id?: string;
        type: string;
        content: unknown;
        createdAt?: string;
        updatedAt?: string;
      }>,
    },
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

vi.mock('./composer/hitl-approval-panel', () => ({
  HITLApprovalPanel: () => null,
}));

vi.mock('./thread/messages/ai', () => ({
  AssistantMessage: () => null,
  AssistantStreamingIndicator: () => null,
}));

vi.mock('./thread/MessageActions', () => ({
  MessageActions: () => null,
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
    setMessages(3);
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
});
