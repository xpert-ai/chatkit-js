import React from 'react';
import {
  createEvent,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const uploadFile = vi.fn();
  const refreshThreads = vi.fn().mockResolvedValue(undefined);

  return {
    uploadFile,
    refreshThreads,
    stream: {
      client: {
        contexts: {
          uploadFile,
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
  ComposerMenu: () => <div data-testid="composer-menu" />,
}));

vi.mock('./composer/SendButton', () => ({
  SendButton: ({ disabled }: { disabled?: boolean }) => (
    <button type="button" disabled={disabled}>
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

function createClipboardImageItem(file: File) {
  return {
    kind: 'file',
    type: file.type,
    getAsFile: () => file,
  };
}

describe('Chat composer paste behavior', () => {
  const originalCreateObjectUrl = URL.createObjectURL;
  const originalRevokeObjectUrl = URL.revokeObjectURL;
  const originalImage = window.Image;

  beforeEach(() => {
    mocks.uploadFile.mockReset();
    mocks.refreshThreads.mockClear();
    mocks.stream.messages = [];
    mocks.stream.pendingFollowUps = [];
    mocks.stream.isLoading = false;

    URL.createObjectURL = vi.fn(() => 'blob:test');
    URL.revokeObjectURL = vi.fn();

    class MockImage {
      naturalWidth = 640;
      naturalHeight = 480;
      onload: null | (() => void) = null;
      onerror: null | (() => void) = null;

      set src(_value: string) {
        queueMicrotask(() => {
          this.onload?.();
        });
      }
    }

    window.Image = MockImage as unknown as typeof window.Image;
  });

  afterEach(() => {
    URL.createObjectURL = originalCreateObjectUrl;
    URL.revokeObjectURL = originalRevokeObjectUrl;
    window.Image = originalImage;
  });

  it('turns pasted long text into a quote reference instead of filling the textarea', () => {
    render(<Chat clientSecret="secret" />);

    const textarea = screen.getByRole('textbox');
    const longText = 'x'.repeat(5001);
    const pasteEvent = createEvent.paste(textarea, {
      clipboardData: {
        items: [],
        getData: (type: string) => (type === 'text/plain' ? longText : ''),
      },
    });

    fireEvent(textarea, pasteEvent);

    expect(pasteEvent.defaultPrevented).toBe(true);
    expect(textarea).toHaveValue('');
    expect(screen.getByText('Pasted text')).toBeInTheDocument();
  });

  it('leaves short pasted text to the browser default behavior', () => {
    render(<Chat clientSecret="secret" />);

    const textarea = screen.getByRole('textbox');
    const pasteEvent = createEvent.paste(textarea, {
      clipboardData: {
        items: [],
        getData: (type: string) => (type === 'text/plain' ? 'short text' : ''),
      },
    });

    fireEvent(textarea, pasteEvent);

    expect(pasteEvent.defaultPrevented).toBe(false);
    expect(screen.queryByText('Pasted text')).not.toBeInTheDocument();
  });

  it('uploads a pasted image and adds it as an image reference chip', async () => {
    mocks.uploadFile.mockResolvedValueOnce({
      id: 'file-1',
      originalName: 'diagram.png',
      mimetype: 'image/png',
      size: 2048,
      url: 'https://example.com/image.png',
    });

    render(
      <Chat
        clientSecret="secret"
        options={{
          api: {
            apiUrl: 'https://api.example.com',
            getClientSecret: async () => 'secret',
          },
          composer: {
            attachments: {
              enabled: true,
              maxCount: 10,
              maxSize: 5 * 1024 * 1024,
            },
          },
        }}
      />,
    );

    const textarea = screen.getByRole('textbox');
    const file = new File(['image-bytes'], 'diagram.png', {
      type: 'image/png',
    });
    const pasteEvent = createEvent.paste(textarea, {
      clipboardData: {
        items: [createClipboardImageItem(file)],
        getData: () => 'https://example.com/image.png',
      },
    });

    fireEvent(textarea, pasteEvent);

    expect(pasteEvent.defaultPrevented).toBe(true);
    await waitFor(() => expect(mocks.uploadFile).toHaveBeenCalledTimes(1));
    expect(mocks.uploadFile).toHaveBeenCalledWith(file);
    await waitFor(() =>
      expect(screen.getByText('diagram.png')).toBeInTheDocument(),
    );
    expect(
      screen.getByText('image/png • 640x480 • 2.0 KB'),
    ).toBeInTheDocument();
    expect(textarea).toHaveValue('');
  });

  it('uploads multiple pasted images in order and creates one reference per image', async () => {
    mocks.uploadFile
      .mockResolvedValueOnce({
        id: 'file-1',
        originalName: 'first.png',
        mimetype: 'image/png',
        size: 1024,
        url: 'https://example.com/first.png',
      })
      .mockResolvedValueOnce({
        id: 'file-2',
        originalName: 'second.png',
        mimetype: 'image/png',
        size: 1536,
        url: 'https://example.com/second.png',
      });

    render(<Chat clientSecret="secret" />);

    const textarea = screen.getByRole('textbox');
    const first = new File(['first'], 'first.png', { type: 'image/png' });
    const second = new File(['second'], 'second.png', { type: 'image/png' });
    fireEvent.paste(textarea, {
      clipboardData: {
        items: [
          createClipboardImageItem(first),
          createClipboardImageItem(second),
        ],
        getData: () => '',
      },
    });

    await waitFor(() => expect(mocks.uploadFile).toHaveBeenCalledTimes(2));
    expect(mocks.uploadFile).toHaveBeenNthCalledWith(1, first);
    expect(mocks.uploadFile).toHaveBeenNthCalledWith(2, second);
    await waitFor(() => {
      expect(screen.getByText('first.png')).toBeInTheDocument();
      expect(screen.getByText('second.png')).toBeInTheDocument();
    });
  });
});
