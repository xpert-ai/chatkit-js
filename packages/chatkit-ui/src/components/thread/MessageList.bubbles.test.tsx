import { ChatMessageStepCategory } from '@xpert-ai/chatkit-types';
import * as React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type {
  ChatkitMessage,
  TMessageContentComponent,
  TMessageComponentStep,
} from '@xpert-ai/chatkit-types';
import { MessageList } from './MessageList';
import { ThemeProvider } from '../../providers/Theme';

const mounts = vi.hoisted(() => ({ widget: vi.fn(), app: vi.fn() }));
vi.mock('../../i18n/useChatkitTranslation', () => ({
  useChatkitTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'en-US' },
  }),
}));
vi.mock('./messages/widget', () => ({
  WidgetMessage: () => {
    React.useEffect(() => {
      mounts.widget();
    }, []);
    return <input aria-label="Widget answer" defaultValue="" />;
  },
}));
vi.mock('./messages/mcp-app', async (original) => ({
  ...(await original<typeof import('./messages/mcp-app')>()),
  McpAppMessage: () => {
    React.useEffect(() => {
      mounts.app();
    }, []);
    return <input aria-label="App answer" defaultValue="" />;
  },
}));
vi.mock('./messages/tool-output-attachments', () => ({
  ToolOutputAttachments: () => <img alt="Declared tool image" />,
}));

const tool: TMessageContentComponent<Partial<TMessageComponentStep>> = {
  id: 'tool',
  type: 'component',
  data: {
    category: 'Tool',
    type: ChatMessageStepCategory.Program,
    tool: 'search',
    title: 'Search',
    status: 'success',
    input: 'private arguments',
    output: 'private tool output',
  },
};
const message: ChatkitMessage = {
  id: 'answer',
  type: 'assistant',
  status: 'success',
  branching: { available: true },
  content: [
    { id: 'first', type: 'text', text: 'Checking files' },
    tool,
    { id: 'last', type: 'text', text: 'The answer' },
  ],
};
const bubble = { mode: 'bubbles' as const, collapseProcess: true };
const wrapper = ThemeProvider;

describe('bubble message presentation', () => {
  it('renders each text block, hides tools and reasoning, and overrides process folding', () => {
    const { container } = render(
      <MessageList
        messages={[
          {
            ...message,
            reasoning: [{ type: 'reasoning', text: 'Hidden reasoning' }],
          },
        ]}
        messagePresentation={bubble}
      />,
      { wrapper },
    );
    expect(
      container.querySelectorAll('[data-message-bubble="text"]'),
    ).toHaveLength(2);
    expect(screen.getByText('Checking files')).toBeVisible();
    expect(screen.getByText('The answer')).toBeVisible();
    expect(screen.queryByText('private arguments')).toBeNull();
    expect(screen.queryByText('private tool output')).toBeNull();
    expect(screen.queryByText('Hidden reasoning')).toBeNull();
    expect(
      screen.queryByRole('button', { name: 'message.process.title' }),
    ).toBeNull();
  });

  it('copies visible text blocks in order without hidden process payloads', async () => {
    const copy = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: copy },
    });
    render(<MessageList messages={[message]} messagePresentation={bubble} />, {
      wrapper,
    });
    fireEvent.click(
      screen.getByRole('button', { name: 'messageActions.copy' }),
    );
    await waitFor(() =>
      expect(copy).toHaveBeenCalledWith('Checking files\n\nThe answer'),
    );
  });

  it('does not invent a completed status for unfinished tool-only messages', () => {
    render(
      <MessageList
        messages={[{ ...message, status: undefined, content: [tool] }]}
        messagePresentation={bubble}
        isLoading
      />,
      { wrapper },
    );
    expect(screen.queryByText('message.bubbles.completed')).toBeNull();
    expect(screen.getByText('message.thinking')).toBeVisible();
  });

  it('keeps message actions and quote anchors tied to the original message', () => {
    const branch = vi.fn();
    const retry = vi.fn();
    const { container } = render(
      <MessageList
        messages={[message]}
        messagePresentation={bubble}
        onBranch={branch}
        onRetry={retry}
        assistantTitle="Claw Xpert"
      />,
      { wrapper },
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'messageActions.branch' }),
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'messageActions.regenerate' }),
    );
    expect(branch).toHaveBeenCalledWith('answer');
    expect(retry).toHaveBeenCalledWith(0);
    expect(
      container.querySelector('[data-quote-message-id="answer"]'),
    ).toHaveAttribute('data-quote-source', 'Claw Xpert');
    expect(
      screen.getAllByRole('button', { name: 'messageActions.copy' }),
    ).toHaveLength(1);
  });

  it('keeps streamed text nodes stable while appending and prepending history', () => {
    const part = {
      ...message,
      status: 'answering',
      content: [{ id: 'first', type: 'text', text: 'Check' }],
    } as ChatkitMessage;
    const { rerender } = render(
      <MessageList messages={[part]} messagePresentation={bubble} isLoading />,
      { wrapper },
    );
    const node = screen.getByText('Check').closest('[data-message-bubble]');
    rerender(
      <MessageList
        messages={[
          { id: 'older', type: 'user', content: 'Earlier question' },
          {
            ...part,
            content: [{ id: 'first', type: 'text', text: 'Checking files' }],
          },
        ]}
        messagePresentation={bubble}
        isLoading
      />,
    );
    expect(
      screen.getByText('Checking files').closest('[data-message-bubble]'),
    ).toBe(node);
  });

  it('does not remount interactive components when changing modes or adding reasoning', () => {
    mounts.widget.mockClear();
    mounts.app.mockClear();
    const rich: ChatkitMessage = {
      ...message,
      content: [
        { id: 'before', type: 'text', text: 'Before tool' },
        tool,
        { id: 'last', type: 'text', text: 'The answer' },
        {
          id: 'widget',
          type: 'component',
          data: { type: 'Widget', widgets: [] },
        },
        {
          id: 'app',
          type: 'component',
          data: {
            type: 'McpApp',
            appInstanceId: 'app-instance',
            resourceUri: 'ui://app',
            toolName: 'lookup',
          },
        },
      ],
    };
    const { rerender } = render(
      <MessageList messages={[rich]} collapseProcess />,
      { wrapper },
    );
    const widget = screen.getByRole('textbox', { name: 'Widget answer' });
    const app = screen.getByRole('textbox', { name: 'App answer' });
    fireEvent.change(widget, { target: { value: 'Keep draft' } });
    fireEvent.change(app, { target: { value: 'Keep session' } });
    rerender(<MessageList messages={[rich]} messagePresentation={bubble} />);
    expect(screen.getByRole('textbox', { name: 'Widget answer' })).toBe(widget);
    expect(screen.getByRole('textbox', { name: 'App answer' })).toBe(app);
    rerender(
      <MessageList
        messages={[
          {
            ...rich,
            reasoning: [
              { type: 'reasoning', id: 'r', text: 'Later reasoning snapshot' },
            ],
          },
        ]}
        messagePresentation={bubble}
      />,
    );
    expect(screen.getByRole('textbox', { name: 'Widget answer' })).toBe(widget);
    rerender(<MessageList messages={[rich]} collapseProcess />);
    expect(screen.getByRole('textbox', { name: 'Widget answer' })).toHaveValue(
      'Keep draft',
    );
    expect(screen.getByRole('textbox', { name: 'App answer' })).toHaveValue(
      'Keep session',
    );
    expect(mounts.widget).toHaveBeenCalledTimes(1);
    expect(mounts.app).toHaveBeenCalledTimes(1);
  });

  it('preserves approval controls even on a tool-only message', () => {
    const approve = vi.fn();
    render(
      <MessageList
        messages={[{ ...message, status: 'paused', content: [tool] }]}
        messagePresentation={bubble}
        approval={<button onClick={approve}>Approve action</button>}
      />,
      { wrapper },
    );
    fireEvent.click(screen.getByRole('button', { name: 'Approve action' }));
    expect(approve).toHaveBeenCalledOnce();
    expect(
      screen
        .getByRole('button', { name: 'Approve action' })
        .closest('[data-message-bubble]'),
    ).not.toBeNull();
  });

  it.each(['success', 'failed', 'paused', 'interrupted'])(
    'shows %s instead of an empty tool-only reply',
    (status) => {
      render(
        <MessageList
          messages={[{ ...message, status, content: [tool] }]}
          messagePresentation={bubble}
        />,
        { wrapper },
      );
      expect(screen.getByRole('status')).toHaveTextContent(
        `message.bubbles.${status === 'success' ? 'completed' : status}`,
      );
    },
  );

  it('extracts declared image results without exposing tool input/output', () => {
    render(
      <MessageList
        messages={[
          {
            ...message,
            content: [
              {
                ...tool,
                data: {
                  ...tool.data,
                  artifact: {
                    type: 'xpert.tool-output',
                    version: 1,
                    attachments: [
                      {
                        type: 'image',
                        artifactId: 'artifact',
                        artifactVersionId: 'v1',
                        sha256: 'a'.repeat(64),
                        mimeType: 'image/png',
                        source: 'sandbox',
                        modelDetail: 'high',
                      },
                    ],
                  },
                },
              },
            ],
          },
        ]}
        messagePresentation={bubble}
      />,
      { wrapper },
    );
    expect(screen.getByAltText('Declared tool image')).toBeVisible();
    expect(screen.queryByText('private tool output')).toBeNull();
    expect(screen.queryByText('message.bubbles.completed')).toBeNull();
  });

  it('preserves historical app results without mounting the live app', () => {
    mounts.app.mockClear();
    render(
      <MessageList
        messages={[
          {
            ...message,
            historical: true,
            content: [
              {
                id: 'app',
                type: 'component',
                data: {
                  type: 'McpApp',
                  appInstanceId: 'history-app',
                  resourceUri: 'ui://app',
                  toolName: 'lookup',
                  toolResult: {
                    content: [{ type: 'text', text: 'Saved result' }],
                  },
                },
              },
            ],
          },
        ]}
        messagePresentation={bubble}
      />,
      { wrapper },
    );
    expect(screen.getByText(/Saved result/)).toBeVisible();
    expect(mounts.app).not.toHaveBeenCalled();
  });

  it('retains explicit question confirmations and unknown components', () => {
    render(
      <MessageList
        messages={[
          {
            ...message,
            content: [
              {
                id: 'question',
                type: 'component',
                data: {
                  category: 'Tool',
                  type: 'request_user_input_result',
                  status: 'success',
                  output: {
                    type: 'request_user_input_result',
                    answers: [
                      {
                        id: 'color',
                        question: 'Pick a color',
                        value: 'blue',
                        label: 'Blue',
                        type: 'option',
                      },
                    ],
                  },
                },
              },
              { id: 'unknown', type: 'custom-result', text: 'Custom payload' },
            ],
          },
        ]}
        messagePresentation={bubble}
      />,
      { wrapper },
    );
    expect(screen.getByText('Pick a color')).toBeVisible();
    expect(screen.getByText(/Custom payload/)).toBeVisible();
  });

  it('hides standalone tool records and restores them in transcript mode', () => {
    const messages: ChatkitMessage[] = [
      { id: 'raw', type: 'tool', content: 'Raw result' },
      message,
    ];
    const { rerender } = render(
      <MessageList messages={messages} messagePresentation={bubble} />,
      { wrapper },
    );
    expect(screen.queryByText('Raw result')).toBeNull();
    rerender(<MessageList messages={messages} />);
    expect(screen.getByText('Raw result')).toBeVisible();
    expect(screen.getByText('Checking files')).toBeVisible();
  });
});
