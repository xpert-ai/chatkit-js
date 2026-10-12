import React from 'react';
import type {
  ChatkitMessage,
  TChatEventMessage,
  TMessageContentComponent,
} from '@xpert-ai/chatkit-types';
import { fireEvent, render as renderUI, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ThemeProvider } from '../../../providers/Theme';
import { AssistantMessage, type AssistantMessageProps } from './ai';

vi.mock('../../../i18n/useChatkitTranslation', () => ({
  useChatkitTranslation: () => ({
    i18n: { language: 'en-US' },
    t: (key: string) =>
      key === 'message.toolGroup.status.success' ? 'Processed' : key,
  }),
}));

function render(ui: React.ReactElement) {
  return renderUI(ui, { wrapper: ThemeProvider });
}

type AssistantChatkitMessage = ChatkitMessage & { type: 'assistant' };

function createToolComponent(
  id: string,
): TMessageContentComponent<TChatEventMessage> {
  return {
    id,
    type: 'component',
    data: {
      category: 'Tool',
      type: 'tool',
      title: id,
      status: 'success',
    },
  };
}

function renderAssistant(
  content: ChatkitMessage['content'],
  overrides: Partial<ChatkitMessage> = {},
  props: Omit<Partial<AssistantMessageProps>, 'message'> = {},
) {
  return render(
    <AssistantMessage
      message={{ ...overrides, id: 'assistant-1', type: 'assistant', content }}
      {...props}
    />,
  );
}

describe('AssistantMessage reasoning', () => {
  it('keeps the answer visible while reasoning is collapsed or expanded without tabs', () => {
    renderAssistant('Final answer', {
      reasoning: [{ type: 'reasoning', text: 'Plan the query' }],
    });
    expect(screen.queryByRole('tab')).toBeNull();
    expect(screen.getByText('Final answer')).toBeInTheDocument();
    const toggle = screen.getByRole('button', { name: 'message.reasoning' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('Plan the query')).toBeNull();
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('Plan the query')).toBeInTheDocument();
    expect(screen.getByText('Final answer')).toBeInTheDocument();
    fireEvent.click(toggle);
    expect(screen.queryByText('Plan the query')).toBeNull();
    expect(screen.getByText('Final answer')).toBeInTheDocument();
  });

  it('keeps live reasoning collapsed and shimmers only while thinking', () => {
    const reasoning = [{ type: 'reasoning' as const, text: 'Initial thought' }];
    const { rerender } = renderAssistant(
      '',
      { reasoning, status: 'reasoning' },
      { isStreaming: true },
    );
    const toggle = screen.getByRole('button', { name: 'message.reasoning' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('Initial thought')).toBeNull();
    expect(screen.getByText('message.reasoning')).toHaveClass(
      'ck-tool-call-running-text',
    );
    rerender(
      <AssistantMessage
        message={{
          id: 'assistant-1',
          type: 'assistant',
          content: 'Answer',
          status: 'answering',
          reasoning: [{ type: 'reasoning', text: 'Updated thought' }],
        }}
        isStreaming
      />,
    );
    expect(
      screen.getByRole('button', { name: 'message.reasoning' }),
    ).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('Updated thought')).toBeNull();
    expect(screen.getByText('message.reasoning')).not.toHaveClass(
      'ck-tool-call-running-text',
    );
    expect(screen.getByText('Answer')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'message.reasoning' }));
    expect(screen.getByText('Updated thought')).toBeInTheDocument();
  });

  it('preserves manually expanded reasoning when the stream stops without an answer', () => {
    const message: AssistantChatkitMessage = {
      id: 'assistant-1',
      type: 'assistant',
      content: '',
      status: 'reasoning',
      reasoning: [{ type: 'reasoning', text: 'Thinking content' }],
    };
    const { rerender } = render(
      <AssistantMessage message={message} isStreaming />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'message.reasoning' }));
    expect(screen.getByText('Thinking content')).toBeInTheDocument();
    rerender(<AssistantMessage message={message} isStreaming={false} />);
    expect(screen.getByText('Thinking content')).toBeInTheDocument();
    expect(screen.getByText('message.reasoning')).not.toHaveClass(
      'ck-tool-call-running-text',
    );
    fireEvent.click(screen.getByRole('button', { name: 'message.reasoning' }));
    expect(screen.queryByText('Thinking content')).toBeNull();
  });

  it('keeps manually collapsed reasoning closed across stream updates and restarts', () => {
    const message: AssistantChatkitMessage = {
      id: 'assistant-1',
      type: 'assistant',
      content: '',
      status: 'reasoning',
      reasoning: [{ id: 'r1', type: 'reasoning', text: 'Initial thought' }],
    };
    const { rerender } = render(
      <AssistantMessage message={message} isStreaming />,
    );
    const toggle = screen.getByRole('button', { name: 'message.reasoning' });
    fireEvent.click(toggle);
    expect(screen.getByText('Initial thought')).toBeVisible();
    fireEvent.click(toggle);

    const updatedMessage: AssistantChatkitMessage = {
      ...message,
      reasoning: [
        { id: 'r1', type: 'reasoning', text: 'Initial thought, continued' },
        { id: 'r2', type: 'reasoning', text: 'Another thought' },
      ],
    };
    for (const isStreaming of [true, false, true]) {
      rerender(
        <AssistantMessage message={updatedMessage} isStreaming={isStreaming} />,
      );
      expect(screen.getByRole('button', { name: 'message.reasoning' })).toBe(
        toggle,
      );
      expect(toggle).toHaveAttribute('aria-expanded', 'false');
      expect(screen.queryByText('Initial thought, continued')).toBeNull();
      expect(screen.queryByText('Another thought')).toBeNull();
    }
    fireEvent.click(toggle);
    expect(screen.getByText('Initial thought, continued')).toBeVisible();
    expect(screen.getByText('Another thought')).toBeVisible();
  });

  it('collapses inline reasoning blocks without hiding subsequent content', () => {
    renderAssistant([
      { type: 'reasoning', text: 'Inline thought' },
      { type: 'text', text: 'Inline answer' },
    ]);
    expect(screen.queryByText('Inline thought')).toBeNull();
    expect(screen.getByText('Inline answer')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'message.reasoning' }));
    expect(screen.getByText('Inline thought')).toBeInTheDocument();
  });

  it('groups adjacent reasoning into one disclosure while preserving answer and tool boundaries', () => {
    renderAssistant([
      { id: 'r1', type: 'reasoning', text: 'First thought' },
      { id: 'r2', type: 'reasoning', text: 'Second thought' },
      { type: 'text', text: 'Intermediate answer' },
      { id: 'r3', type: 'reasoning', text: 'Third thought' },
      createToolComponent('query'),
      { id: 'r4', type: 'reasoning', text: 'Fourth thought' },
      { id: 'r5', type: 'reasoning', text: 'Fifth thought' },
    ]);
    const toggles = screen.getAllByRole('button', {
      name: 'message.reasoning',
    });
    expect(toggles).toHaveLength(3);
    fireEvent.click(toggles[0]);
    expect(screen.getByText('First thought')).toBeInTheDocument();
    expect(screen.getByText('Second thought')).toBeInTheDocument();
    expect(screen.queryByText('Third thought')).toBeNull();
    expect(screen.queryByText('Fourth thought')).toBeNull();
    fireEvent.click(toggles[2]);
    expect(screen.getByText('Fourth thought')).toBeInTheDocument();
    expect(screen.getByText('Fifth thought')).toBeInTheDocument();
  });

  it('preserves a manually opened group as reasoning grows and the answer starts', () => {
    const first = {
      id: 'r1',
      type: 'reasoning' as const,
      text: 'First thought',
    };
    const second = {
      id: 'r2',
      type: 'reasoning' as const,
      text: 'Second thought',
    };
    const message: AssistantChatkitMessage = {
      id: 'assistant-1',
      type: 'assistant',
      content: '',
      status: 'reasoning',
      reasoning: [first],
    };
    const { rerender } = render(
      <AssistantMessage message={message} isStreaming />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'message.reasoning' }));
    rerender(
      <AssistantMessage
        message={{ ...message, reasoning: [first, second] }}
        isStreaming
      />,
    );
    expect(
      screen.getAllByRole('button', { name: 'message.reasoning' }),
    ).toHaveLength(1);
    expect(screen.getByText('First thought')).toBeInTheDocument();
    expect(screen.getByText('Second thought')).toBeInTheDocument();
    rerender(
      <AssistantMessage
        message={{
          ...message,
          reasoning: [first, second],
          content: 'Answer',
          status: 'answering',
        }}
        isStreaming
      />,
    );
    expect(
      screen.getByRole('button', { name: 'message.reasoning' }),
    ).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('First thought')).toBeInTheDocument();
    expect(screen.getByText('Second thought')).toBeInTheDocument();
    expect(screen.getByText('Answer')).toBeInTheDocument();
  });

  it('starts a separate latest reasoning section after tool use without reopening the previous round', () => {
    const first = {
      id: 'thought-1',
      type: 'reasoning' as const,
      text: 'Before tool',
      created_date: '2026-09-18T01:00:00Z',
    };
    const second = {
      id: 'thought-2',
      type: 'reasoning' as const,
      text: 'After tool',
      created_date: '2026-09-18T01:00:02Z',
    };
    const tool = {
      ...createToolComponent('query'),
      created_date: '2026-09-18T01:00:01Z',
    };
    const message: AssistantChatkitMessage = {
      id: 'assistant-1',
      type: 'assistant',
      content: [],
      status: 'reasoning',
      reasoning: [first],
    };
    const { rerender } = render(
      <AssistantMessage message={message} isStreaming />,
    );
    expect(screen.queryByText('Before tool')).toBeNull();
    rerender(
      <AssistantMessage
        message={{ ...message, content: [tool], status: 'answering' }}
        isStreaming
      />,
    );
    expect(screen.queryByText('Before tool')).toBeNull();
    rerender(
      <AssistantMessage
        message={{ ...message, content: [tool], reasoning: [first, second] }}
        isStreaming
      />,
    );
    const toggles = screen.getAllByRole('button', {
      name: 'message.reasoning',
    });
    expect(toggles).toHaveLength(2);
    expect(toggles[0]).toHaveAttribute('aria-expanded', 'false');
    expect(toggles[1]).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('Before tool')).toBeNull();
    expect(screen.queryByText('After tool')).toBeNull();
    const labels = screen.getAllByText('message.reasoning');
    expect(labels[0]).not.toHaveClass('ck-tool-call-running-text');
    expect(labels[1]).toHaveClass('ck-tool-call-running-text');
    fireEvent.click(toggles[1]);
    expect(screen.getByText('After tool')).toBeInTheDocument();
    const toolHeader = screen.getByRole('button', { name: /Processed/ });
    expect(
      toggles[0].compareDocumentPosition(toolHeader) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      toolHeader.compareDocumentPosition(toggles[1]) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    rerender(
      <AssistantMessage
        message={{ ...message, content: [tool], reasoning: [first, second] }}
      />,
    );
    expect(toggles[0]).toHaveAttribute('aria-expanded', 'false');
    expect(toggles[1]).toHaveAttribute('aria-expanded', 'true');
    expect(labels[1]).not.toHaveClass('ck-tool-call-running-text');
  });
});
