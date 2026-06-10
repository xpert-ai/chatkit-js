import React from 'react';
import {
  createEvent,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ChatKitOptions } from '@xpert-ai/chatkit-types';

const mocks = vi.hoisted(() => {
  const uploadFile = vi.fn();
  const getFileStatus = vi.fn();
  const fetchContextFile = vi.fn(
    async (path: string, options?: { body?: BodyInit | null }) => {
      if (path.includes('/status')) {
        return getFileStatus(path, options);
      }
      const body = options?.body;
      const file = body instanceof FormData ? body.get('file') : null;
      return uploadFile(file);
    },
  );

  return {
    uploadFile,
    getFileStatus,
    refreshThreads: vi.fn().mockResolvedValue(undefined),
    stream: {
      client: {
        contexts: {
          fetch: fetchContextFile,
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
    refreshThreads: mocks.refreshThreads,
    isLoading: false,
  }),
}));

vi.mock('../i18n/useChatkitTranslation', () => ({
  useChatkitTranslation: () => ({
    t: (key: string, options?: { defaultValue?: string }) => {
      const labels: Record<string, string> = {
        'chat.attachmentStatus.ready': 'Ready',
        'chat.poweredBy': 'Powered by Xpert AI',
        'chat.referencedContentOnly': 'Referenced content',
        'composer.removeReference': 'Remove reference',
        'startScreen.editPrompt': 'Edit prompt',
        'startScreen.greeting': 'What can I help with today?',
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
  useParentMessenger: () => undefined,
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

const baseOptions: ChatKitOptions = {
  api: {
    apiUrl: 'https://api.example.com',
    xpertId: 'assistant-1',
    getClientSecret: async () => 'secret',
  },
  composer: {
    attachments: {
      enabled: true,
    },
  },
  startScreen: {
    prompts: [
      {
        label: 'Analyze notice',
        prompt: 'Analyze this technical notice',
        icon: 'circle-question',
      },
    ],
  },
};

function renderChat() {
  return render(<Chat clientSecret="secret" options={baseOptions} />);
}

function pasteLongReference(textbox: HTMLElement, text: string) {
  const pasteEvent = createEvent.paste(textbox, {
    clipboardData: {
      items: [],
      getData: (type: string) => (type === 'text/plain' ? text : ''),
    },
  });

  fireEvent(textbox, pasteEvent);
}

function setComposerText(element: HTMLElement, value: string) {
  element.textContent = value;
  const range = document.createRange();
  range.selectNodeContents(element);
  range.collapse(false);
  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
  fireEvent.input(element);
  return screen.getByRole('textbox');
}

describe('Chat start screen prompts', () => {
  beforeEach(() => {
    mocks.uploadFile.mockReset();
    mocks.uploadFile.mockResolvedValue({
      id: 'asset-1',
      fileId: 'asset-1',
      storageFileId: 'storage-1',
      originalName: 'notice.pdf',
      mimeType: 'application/pdf',
      size: 1024,
      status: 'ready',
      parseStatus: 'ready',
    });
    mocks.getFileStatus.mockReset();
    mocks.stream.client.contexts.fetch.mockClear();
    mocks.stream.client.assistants.get.mockClear();
    mocks.stream.client.assistants.getRuntimeCapabilities.mockClear();
    mocks.refreshThreads.mockClear();
    mocks.stream.messages = [];
    mocks.stream.threadId = null;
    mocks.stream.pendingFollowUps = [];
    mocks.stream.pendingRequestUserInput = null;
    mocks.stream.pendingHITLRequest = null;
    mocks.stream.isLoading = false;
    mocks.stream.submit.mockClear();
  });

  it('submits a start-screen prompt with existing attachments and references', async () => {
    const { container } = renderChat();
    const fileInput = container.querySelector('input[type="file"]');
    const file = new File(['content'], 'notice.pdf', {
      type: 'application/pdf',
    });

    fireEvent.change(fileInput as HTMLInputElement, {
      target: { files: [file] },
    });

    await waitFor(() => expect(mocks.uploadFile).toHaveBeenCalledWith(file));
    await screen.findByText('notice.pdf');

    const textbox = screen.getByRole('textbox');
    pasteLongReference(textbox, 'quoted '.repeat(900));
    expect(screen.getByText('Pasted text')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Analyze notice'));

    await waitFor(() => expect(mocks.stream.submit).toHaveBeenCalledTimes(1));
    expect(mocks.stream.submit.mock.calls[0][0].input).toMatchObject({
      input: 'Analyze this technical notice',
      files: [
        expect.objectContaining({
          fileId: 'asset-1',
          originalName: 'notice.pdf',
        }),
      ],
      references: [
        expect.objectContaining({
          type: 'quote',
          source: 'Pasted text',
        }),
      ],
      referenceComposition: 'compose',
    });

    const optimisticValues =
      mocks.stream.submit.mock.calls[0][1].optimisticValues;
    expect(optimisticValues?.({ messages: [] })).toMatchObject({
      messages: [
        expect.objectContaining({
          type: 'human',
          content: 'Analyze this technical notice',
          submittedInput: 'Analyze this technical notice',
          fileAssets: [
            expect.objectContaining({
              fileId: 'asset-1',
              originalName: 'notice.pdf',
            }),
          ],
          references: [
            expect.objectContaining({
              type: 'quote',
              source: 'Pasted text',
            }),
          ],
          referenceComposition: 'compose',
        }),
      ],
    });
  });

  it('edits a start-screen prompt into the composer without sending or clearing context', async () => {
    const { container } = renderChat();
    const textbox = screen.getByRole('textbox');
    const fileInput = container.querySelector('input[type="file"]');
    const file = new File(['content'], 'notice.pdf', {
      type: 'application/pdf',
    });

    setComposerText(textbox, 'old draft');
    expect(screen.getByRole('textbox')).toHaveTextContent('old draft');

    fireEvent.change(fileInput as HTMLInputElement, {
      target: { files: [file] },
    });
    await waitFor(() => expect(mocks.uploadFile).toHaveBeenCalledWith(file));
    await screen.findByText('notice.pdf');

    pasteLongReference(textbox, 'quoted '.repeat(900));
    expect(screen.getByText('Pasted text')).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Edit prompt'));

    expect(mocks.stream.submit).not.toHaveBeenCalled();
    await waitFor(() =>
      expect(screen.getByRole('textbox')).toHaveTextContent(
        'Analyze this technical notice',
      ),
    );
    expect(screen.queryByText('old draft')).not.toBeInTheDocument();
    expect(screen.getByText('notice.pdf')).toBeInTheDocument();
    expect(screen.getByText('Pasted text')).toBeInTheDocument();
  });
});
