import React from 'react';
import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../i18n/useChatkitTranslation', () => ({
  useChatkitTranslation: () => ({
    t: (key: string) => key,
  }),
}));

import { AssistantMessage } from './ai';

describe('AssistantMessage tool components', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows a finished tool duration from created_date to end_date', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-24T12:24:54.398Z'));

    render(
      <AssistantMessage
        message={{
          id: 'assistant-1',
          type: 'assistant',
          content: [
            {
              id: 'tool-1',
              type: 'component',
              data: {
                category: 'Tool',
                toolset: 'todoListMiddleware',
                tool: 'write_todos',
                title: 'write_todos',
                created_date: '2026-04-24T12:24:52.898Z',
                end_date: '2026-04-24T12:24:54.398Z',
                status: 'success',
              },
            },
          ],
        } as any}
      />,
    );

    expect(screen.getByText('1.5s')).toBeInTheDocument();
  });

  it('updates the running tool duration over time', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-24T12:24:54.398Z'));

    render(
      <AssistantMessage
        message={{
          id: 'assistant-1',
          type: 'assistant',
          content: [
            {
              id: 'tool-1',
              type: 'component',
              data: {
                category: 'Tool',
                toolset: 'todoListMiddleware',
                tool: 'write_todos',
                title: 'write_todos',
                created_date: '2026-04-24T12:24:52.898Z',
                status: 'running',
              },
            },
          ],
        } as any}
      />,
    );

    expect(screen.getByText('1.5s')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(1_000);
    });

    expect(screen.getByText('2.5s')).toBeInTheDocument();
  });
});
