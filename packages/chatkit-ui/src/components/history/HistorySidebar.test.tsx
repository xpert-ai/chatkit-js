import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { HistorySidebar } from './HistorySidebar';

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

beforeAll(() => {
  vi.stubGlobal('ResizeObserver', ResizeObserverMock);
});

afterAll(() => {
  vi.unstubAllGlobals();
});

vi.mock('../../i18n/useChatkitTranslation', () => ({
  useChatkitTranslation: () => ({
    t: (key: string, options?: Record<string, string>) => {
      const labels: Record<string, string> = {
        'history.threadHistory': 'Thread history',
        'history.title': 'Threads',
        'history.refresh': 'Refresh threads',
        'history.newThread': 'New Thread',
        'history.empty': 'No threads yet',
        'sheet.close': 'Close',
      };
      return (labels[key] ?? key).replace('{{time}}', options?.time ?? '');
    },
    i18n: { language: 'en-US', resolvedLanguage: 'en-US' },
  }),
}));

function openSidebar(props: React.ComponentProps<typeof HistorySidebar> = {}) {
  const result = render(<HistorySidebar {...props} />);
  fireEvent.click(screen.getByRole('button', { name: 'Thread history' }));
  return result;
}

describe('HistorySidebar', () => {
  it('manually refreshes the thread list from the panel header', () => {
    const onRefresh = vi.fn().mockResolvedValue(undefined);

    openSidebar({ onRefresh });
    fireEvent.click(screen.getByRole('button', { name: 'Refresh threads' }));

    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  it('disables and animates the refresh button while refreshing', () => {
    openSidebar({ onRefresh: vi.fn(), isRefreshing: true });

    const refreshButton = screen.getByRole('button', {
      name: 'Refresh threads',
    });
    expect(refreshButton).toBeDisabled();
    expect(refreshButton).toHaveAttribute('aria-busy', 'true');
    expect(refreshButton.querySelector('svg')).toHaveClass('animate-spin');
  });

  it('uses matching icon button styles for refresh and close', () => {
    openSidebar({ onRefresh: vi.fn() });

    const refreshButton = screen.getByRole('button', {
      name: 'Refresh threads',
    });
    const closeButton = screen.getByRole('button', { name: 'Close' });

    expect(refreshButton).toHaveAttribute('data-size', 'icon-sm');
    expect(closeButton).toHaveAttribute('data-size', 'icon-sm');
    expect(refreshButton).toHaveAttribute('data-variant', 'ghost');
    expect(closeButton).toHaveAttribute('data-variant', 'ghost');
    expect(refreshButton).toHaveClass(
      'hover:bg-accent',
      'hover:text-accent-foreground',
    );
    expect(closeButton).toHaveClass(
      'hover:bg-accent',
      'hover:text-accent-foreground',
    );
  });

  it('keeps the title centered without absolutely positioning header actions', () => {
    openSidebar({ onRefresh: vi.fn() });

    const title = screen.getByRole('heading', { name: 'Threads' });
    const header = title.parentElement;
    const actions = screen.getByRole('button', {
      name: 'Refresh threads',
    }).parentElement;

    expect(header).toHaveClass(
      'grid',
      'grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]',
    );
    expect(title).toHaveClass('col-start-2', 'text-center');
    expect(actions).toHaveClass('col-start-3', 'justify-self-end');
    expect(actions).not.toHaveClass('absolute');
  });

  it('constrains the Radix scroll viewport wrapper to the panel width', () => {
    openSidebar({
      threads: [
        {
          id: 'thread-1',
          recordId: 'record-1',
          title: 'A'.repeat(500),
          status: 'idle',
          lastMessageAt: new Date(),
        },
      ],
    });

    const viewport = document.querySelector(
      '[data-radix-scroll-area-viewport]',
    );
    expect(viewport).toHaveClass('min-w-0', 'max-w-full');
    expect(viewport).toHaveClass('[&>div]:!block', '[&>div]:!w-full');
  });

  it('reveals the updated time to the left of delete on hover or focus', () => {
    const updatedAt = new Date();
    const expectedTime = new Intl.DateTimeFormat('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    }).format(updatedAt);

    openSidebar({
      threads: [
        {
          id: 'thread-1',
          recordId: 'record-1',
          title: 'Thread one',
          status: 'idle',
          lastMessageAt: updatedAt,
        },
      ],
      onDeleteThread: vi.fn(),
    });

    const time = screen.getByText(expectedTime);
    const deleteButton = screen.getByRole('button', {
      name: 'history.deleteThread',
    });

    expect(time.tagName).toBe('TIME');
    expect(time).toHaveAttribute('dateTime', updatedAt.toISOString());
    expect(time).toHaveClass(
      'hidden',
      'group-hover:inline',
      'group-focus-within:inline',
    );
    expect(time.nextElementSibling).toBe(deleteButton);
  });

  it('uses paired accent colors for active and hovered thread items', () => {
    openSidebar({
      threads: [
        {
          id: 'thread-1',
          recordId: 'record-1',
          title: 'Active thread',
          status: 'idle',
          lastMessageAt: new Date(),
        },
      ],
      currentThreadId: 'thread-1',
    });

    const row = screen.getByText('Active thread').parentElement;
    const icon = row?.querySelector('svg')?.parentElement;

    expect(row).toHaveAttribute('data-active', 'true');
    expect(row).toHaveClass(
      'hover:bg-accent',
      'hover:text-accent-foreground',
      'data-[active=true]:bg-accent',
      'data-[active=true]:text-accent-foreground',
    );
    expect(icon).toHaveClass(
      'group-hover:text-accent-foreground',
      'group-data-[active=true]:text-accent-foreground',
    );
    expect(row?.parentElement).not.toHaveClass('space-y-1');
  });
});
