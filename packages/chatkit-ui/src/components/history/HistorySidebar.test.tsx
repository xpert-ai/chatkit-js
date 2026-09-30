import React from 'react';
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { HistorySidebar } from './HistorySidebar';
import { setLanguage } from '../../i18n';

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

beforeAll(() => {
  setLanguage('en-US');
  vi.stubGlobal('ResizeObserver', ResizeObserverMock);
});

afterAll(() => {
  vi.unstubAllGlobals();
});

function openSidebar(props: React.ComponentProps<typeof HistorySidebar> = {}) {
  const result = render(<HistorySidebar {...props} />);
  fireEvent.click(screen.getByRole('button', { name: 'Message history' }));
  return result;
}

describe('HistorySidebar', () => {
  it('defaults to all conversations and offers explicit Project filters', () => {
    const onScopeChange = vi.fn();
    openSidebar({ onScopeChange, hasCurrentProject: true });
    const select = screen.getByRole('combobox', {
      name: 'Conversation scope',
    });
    expect(select).toHaveValue('all');
    fireEvent.change(select, { target: { value: 'current-project' } });
    expect(onScopeChange).toHaveBeenLastCalledWith('current-project');
    fireEvent.change(select, { target: { value: 'no-project' } });
    expect(onScopeChange).toHaveBeenLastCalledWith('no-project');
  });

  it('disables the current Project filter when no Project is selected', () => {
    openSidebar({ onScopeChange: vi.fn() });
    expect(
      screen.getByRole('option', { name: 'Current project' }),
    ).toBeDisabled();
  });

  it('manually refreshes the thread list from the panel header', () => {
    const onRefresh = vi.fn().mockResolvedValue(undefined);

    openSidebar({ onRefresh });
    fireEvent.click(
      screen.getByRole('button', { name: 'Refresh message history' }),
    );

    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  it('disables and animates the refresh button while refreshing', () => {
    openSidebar({ onRefresh: vi.fn(), isRefreshing: true });

    const refreshButton = screen.getByRole('button', {
      name: 'Refresh message history',
    });
    expect(refreshButton).toBeDisabled();
    expect(refreshButton).toHaveAttribute('aria-busy', 'true');
    expect(refreshButton.querySelector('svg')).toHaveClass('animate-spin');
  });

  it('uses matching icon button styles for refresh and close', () => {
    openSidebar({ onRefresh: vi.fn() });

    const refreshButton = screen.getByRole('button', {
      name: 'Refresh message history',
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

  it('opens a dialog with search focused and an accessible description', async () => {
    openSidebar();
    const dialog = screen.getByRole('dialog', { name: 'Message history' });
    expect(dialog).toHaveAccessibleDescription(
      'Search and continue past conversations with this assistant.',
    );
    await waitFor(() =>
      expect(
        screen.getByRole('searchbox', { name: 'Search message history' }),
      ).toHaveFocus(),
    );
    fireEvent.keyDown(dialog, { key: 'Escape' });
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    );
    expect(
      screen.getByRole('button', { name: 'Message history' }),
    ).toHaveFocus();
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

  it('shows the update time without requiring hover', () => {
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
      name: 'Delete Thread one',
    });

    expect(time.tagName).toBe('TIME');
    expect(time).toHaveAttribute('dateTime', updatedAt.toISOString());
    expect(time).not.toHaveClass('hidden');
    expect(deleteButton).toBeInTheDocument();
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

    expect(
      screen.getByRole('button', { name: 'Active thread' }),
    ).toHaveAttribute('aria-current', 'true');
    expect(screen.getByText('Current conversation')).toBeInTheDocument();
  });
  it('groups by project, collapses groups, and switches to a recent list', () => {
    openSidebar({
      threads: [
        {
          id: 'a',
          recordId: 'record-a',
          title: 'Design review',
          projectId: 'p1',
          projectName: 'Design',
          status: 'idle',
        },
        {
          id: 'b',
          recordId: 'record-b',
          title: 'Build review',
          projectId: 'p2',
          projectName: 'Build',
          status: 'idle',
        },
        {
          id: 'c',
          recordId: 'record-c',
          title: 'Personal note',
          status: 'idle',
        },
      ],
    });
    const design = screen.getByRole('button', { name: 'Design 1' });
    expect(design).toHaveAttribute('aria-expanded', 'true');
    expect(
      screen.getByRole('button', { name: 'No project 1' }),
    ).toBeInTheDocument();
    fireEvent.click(design);
    expect(
      screen.queryByRole('button', { name: 'Design review' }),
    ).not.toBeInTheDocument();
    fireEvent.click(
      screen.getByRole('button', { name: 'Recent' }),
    );
    expect(
      screen.getByRole('button', { name: 'Design review' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Design 1' }),
    ).not.toBeInTheDocument();
  });

  it('passes server search input and reports no matches', () => {
    const onQueryChange = vi.fn();
    openSidebar({ query: 'report', onQueryChange });
    const search = screen.getByRole('searchbox');
    fireEvent.change(search, { target: { value: 'budget' } });
    expect(onQueryChange).toHaveBeenCalledWith('budget');
    expect(
      screen.getByText(
        'No matching conversations. Try another search or scope.',
      ),
    ).toBeInTheDocument();
  });

  it('opens the selected search result using its record and thread ids', async () => {
    const thread = {
      id: 'older-thread',
      recordId: 'older-record',
      title: 'Older result',
      status: 'idle' as const,
    };
    const onSelectThread = vi.fn();
    openSidebar({ threads: [thread], onSelectThread });
    fireEvent.click(screen.getByRole('button', { name: 'Older result' }));
    expect(onSelectThread).toHaveBeenCalledWith(thread);
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    );
  });

  it('keeps deletion failures visible without selecting the conversation', async () => {
    const onSelectThread = vi.fn();
    const onDeleteThread = vi.fn().mockRejectedValue(new Error('Rejected'));
    openSidebar({
      threads: [
        { id: 'a', recordId: 'record-a', title: 'Report', status: 'idle' },
      ],
      onSelectThread,
      onDeleteThread,
    });
    fireEvent.click(screen.getByRole('button', { name: 'Delete Report' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Could not delete this conversation. Try again.',
    );
    expect(onSelectThread).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('shows loaded and total counts and retries older pages without discarding results', () => {
    const onLoadMore = vi.fn();
    openSidebar({
      threads: [
        { id: 'a', recordId: 'record-a', title: 'Report', status: 'idle' },
      ],
      total: 70,
      hasMore: true,
      onLoadMore,
      loadMoreError: true,
    });
    expect(
      screen.getByText('1 of 70 conversations loaded'),
    ).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Could not load older conversations',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(onLoadMore).toHaveBeenCalledOnce();
    expect(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: 'Report',
      }),
    ).toBeInTheDocument();
  });
});
