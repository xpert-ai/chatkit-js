import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ChatkitMessage } from '@xpert-ai/chatkit-types';
import { MessageList } from './MessageList';

vi.mock('../../i18n/useChatkitTranslation', () => ({
  useChatkitTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'en-US' },
  }),
}));

const message: ChatkitMessage = {
  id: 'final-id',
  type: 'assistant',
  status: 'success',
  branching: { available: true },
  content: [
    { type: 'text', text: 'Checking the files' },
    {
      type: 'component',
      data: {
        category: 'Tool',
        type: 'tool',
        tool: 'search',
        title: 'Search',
        status: 'success',
      },
    },
    { type: 'text', text: 'Final response' },
  ],
};

describe('collapsed process presentation', () => {
  it('is disabled by default', () => {
    render(<MessageList messages={[message]} />);
    expect(screen.getByText('Checking the files')).toBeVisible();
    expect(
      screen.queryByRole('button', { name: 'message.process.title' }),
    ).toBeNull();
  });

  it('collapses process, expands in order and copies only the final text', async () => {
    const copy = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: copy },
    });
    const branch = vi.fn();
    const retry = vi.fn();
    render(
      <MessageList
        messages={[message]}
        collapseProcess
        onBranch={branch}
        onRetry={retry}
      />,
    );
    expect(screen.getByText('Checking the files')).not.toBeVisible();
    expect(screen.getByText('Final response')).toBeVisible();
    fireEvent.click(
      screen.getByRole('button', { name: 'messageActions.copy' }),
    );
    await waitFor(() => expect(copy).toHaveBeenCalledWith('Final response'));
    fireEvent.click(
      screen.getByRole('button', { name: 'messageActions.branch' }),
    );
    expect(branch).toHaveBeenCalledWith('final-id');
    fireEvent.click(
      screen.getByRole('button', { name: 'messageActions.regenerate' }),
    );
    expect(retry).toHaveBeenCalledWith(0);
    fireEvent.click(
      screen.getByRole('button', { name: 'message.process.title' }),
    );
    expect(screen.getByText('Checking the files')).toBeVisible();
    expect(screen.getByText('Final response')).toBeVisible();
  });

  it('groups prior AI/tool records and keeps final action and navigation identities', () => {
    const branch = vi.fn();
    const anchor = vi.fn();
    const messages: ChatkitMessage[] = [
      { id: 'h', type: 'user', content: 'Question' },
      {
        id: 'p',
        type: 'assistant',
        status: 'success',
        content: 'Earlier progress',
      },
      { id: 't', type: 'tool', content: 'Tool result' },
      message,
    ];
    render(
      <MessageList
        messages={messages}
        collapseProcess
        onBranch={branch}
        onMessageAnchor={anchor}
      />,
    );
    expect(screen.getByText('Earlier progress')).not.toBeVisible();
    expect(screen.getByText('Tool result')).not.toBeVisible();
    expect(
      screen.getAllByRole('button', { name: 'message.process.title' }),
    ).toHaveLength(1);
    expect(
      anchor.mock.calls.find(([id, node]) => id === 'p' && node)?.[1],
    ).toBe(
      anchor.mock.calls.find(([id, node]) => id === 'final-id' && node)?.[1],
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'messageActions.branch' }),
    );
    expect(branch).toHaveBeenCalledWith('final-id');
  });

  it('collapses automatically on completion while respecting an explicit expansion', () => {
    const { rerender } = render(
      <MessageList
        messages={[{ ...message, status: 'answering' }]}
        collapseProcess
        isLoading
      />,
    );
    expect(screen.getByText('Checking the files')).toBeVisible();
    rerender(<MessageList messages={[message]} collapseProcess />);
    expect(screen.getByText('Checking the files')).not.toBeVisible();
    fireEvent.click(
      screen.getByRole('button', { name: 'message.process.title' }),
    );
    rerender(
      <MessageList
        messages={[
          {
            ...message,
            content: [
              ...(message.content as Exclude<
                ChatkitMessage['content'],
                string
              >),
              { type: 'text', text: 'More final text' },
            ],
          },
        ]}
        collapseProcess
      />,
    );
    expect(screen.getByText('Checking the files')).toBeVisible();
    expect(screen.getByText('More final text')).toBeVisible();
  });

  it.each(['error', 'paused', 'interrupted', undefined])(
    'keeps %s output visible',
    (status) => {
      render(
        <MessageList messages={[{ ...message, status }]} collapseProcess />,
      );
      expect(screen.getByText('Checking the files')).toBeVisible();
      expect(
        screen.getByRole('button', { name: 'message.process.title' }),
      ).toHaveAttribute('aria-disabled', 'true');
    },
  );

  it('does not hide tool-only output, and can toggle back to the full presentation', () => {
    const toolOnly = {
      ...message,
      content: (
        message.content as Exclude<ChatkitMessage['content'], string>
      ).slice(0, -1),
    };
    const { rerender } = render(
      <MessageList messages={[toolOnly]} collapseProcess />,
    );
    expect(screen.getByText('Checking the files')).toBeVisible();
    expect(
      screen.queryByRole('button', { name: 'message.process.title' }),
    ).toBeNull();
    rerender(<MessageList messages={[message]} collapseProcess />);
    expect(screen.getByText('Checking the files')).not.toBeVisible();
    rerender(<MessageList messages={[message]} collapseProcess={false} />);
    expect(screen.getByText('Checking the files')).toBeVisible();
  });
});
