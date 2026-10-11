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
import { ThemeProvider } from '../../providers/Theme';

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
  it('keeps the nested scope menu connected to radius and density while open', async () => {
    const onScopeChange = vi.fn();
    const { rerender } = render(
      <ThemeProvider theme={{ radius: 'sharp', density: 'compact' }}>
        <HistorySidebar
          open
          showTrigger={false}
          onScopeChange={onScopeChange}
        />
      </ThemeProvider>,
    );
    const dialog = screen.getByRole('dialog');
    fireEvent.keyDown(
      screen.getByRole('combobox', { name: 'Conversation scope' }),
      { key: 'ArrowDown' },
    );
    const menu = await screen.findByRole('listbox');
    expect(dialog.contains(menu)).toBe(false);
    expect(menu.style.getPropertyValue('--chat-panel-radius')).toBe('0px');
    expect(menu.style.getPropertyValue('--chat-density-scale')).toBe('0.75');
    rerender(
      <ThemeProvider theme={{ radius: 'round', density: 'spacious' }}>
        <HistorySidebar
          open
          showTrigger={false}
          onScopeChange={onScopeChange}
        />
      </ThemeProvider>,
    );
    expect(screen.getByRole('listbox')).toBe(menu);
    expect(menu.style.getPropertyValue('--chat-panel-radius')).toBe(
      'calc(var(--radius, 0.625rem) + 4px)',
    );
    expect(menu.style.getPropertyValue('--chat-density-scale')).toBe('1.25');
    fireEvent.keyDown(screen.getByRole('option', { name: 'No project' }), {
      key: 'Enter',
    });
    expect(onScopeChange).toHaveBeenCalledWith('no-project');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('updates radius tokens across the dialog portal while it stays open', () => {
    const { container, rerender } = render(
      <ThemeProvider theme={{ radius: 'sharp' }}>
        <HistorySidebar open showTrigger={false} />
      </ThemeProvider>,
    );
    const dialog = screen.getByRole('dialog', { name: 'Message history' });
    expect(container.contains(dialog)).toBe(false);
    expect(dialog.style.getPropertyValue('--chat-panel-radius')).toBe('0px');
    expect(dialog.style.getPropertyValue('--chat-item-radius')).toBe('0px');

    rerender(
      <ThemeProvider theme={{ radius: 'round' }}>
        <HistorySidebar open showTrigger={false} />
      </ThemeProvider>,
    );
    expect(screen.getByRole('dialog', { name: 'Message history' })).toBe(
      dialog,
    );
    expect(dialog.style.getPropertyValue('--chat-panel-radius')).toBe(
      'calc(var(--radius, 0.625rem) + 4px)',
    );
    expect(dialog.style.getPropertyValue('--chat-item-radius')).toBe(
      'var(--radius, 0.625rem)',
    );
  });

  it('defaults to all conversations and offers explicit Project filters', async () => {
    const onScopeChange = vi.fn();
    openSidebar({ onScopeChange, hasCurrentProject: true });
    const select = screen.getByRole('combobox', {
      name: 'Conversation scope',
    });
    expect(select).toHaveTextContent('All conversations');
    fireEvent.keyDown(select, { key: 'ArrowDown' });
    fireEvent.keyDown(
      await screen.findByRole('option', { name: 'Current project' }),
      { key: 'Enter' },
    );
    expect(onScopeChange).toHaveBeenLastCalledWith('current-project');
    fireEvent.keyDown(select, { key: 'ArrowDown' });
    fireEvent.keyDown(
      await screen.findByRole('option', { name: 'No project' }),
      { key: 'Enter' },
    );
    expect(onScopeChange).toHaveBeenLastCalledWith('no-project');
  });

  it('disables the current Project filter when no Project is selected', async () => {
    openSidebar({ onScopeChange: vi.fn() });
    fireEvent.keyDown(
      screen.getByRole('combobox', { name: 'Conversation scope' }),
      { key: 'ArrowDown' },
    );
    expect(
      await screen.findByRole('option', { name: 'Current project' }),
    ).toHaveAttribute('aria-disabled', 'true');
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

  it('keeps the update time available to assistive technology in a single-line row', () => {
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
    expect(time).toHaveAccessibleName(/^Updated/);
    expect(
      screen.getByRole('button', { name: 'Thread one' }).querySelector('svg'),
    ).toBeNull();
    expect(deleteButton).toBeInTheDocument();
  });

  it('filters by a recent conversation project tag without opening the conversation', async () => {
    const onProjectFilterChange = vi.fn();
    const onSelectThread = vi.fn();
    const onScopeChange = vi.fn();
    const onOpenChange = vi.fn();
    const props = {
      open: true,
      showTrigger: false,
      onProjectFilterChange,
      onSelectThread,
      onScopeChange,
      onOpenChange,
      threads: [
        {
          id: 'a',
          recordId: 'record-a',
          title: 'Design review',
          projectId: 'p1',
          projectName: 'Design',
          status: 'idle' as const,
        },
        {
          id: 'b',
          recordId: 'record-b',
          title: 'Personal note',
          status: 'idle' as const,
        },
      ],
    };
    const { rerender } = render(<HistorySidebar {...props} />);
    expect(
      screen.queryByRole('button', { name: 'Filter by project: Design' }),
    ).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Recent' }));
    const tag = screen.getByRole('button', {
      name: 'Filter by project: Design',
    });
    expect(tag.closest('button')).toBe(tag);
    fireEvent.click(tag);
    expect(onProjectFilterChange).toHaveBeenCalledWith({
      id: 'p1',
      name: 'Design',
    });
    expect(onSelectThread).not.toHaveBeenCalled();
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    rerender(
      <HistorySidebar
        {...props}
        projectFilter={{ id: 'p1', name: 'Design' }}
      />,
    );
    expect(tag).toHaveAttribute('aria-pressed', 'true');
    const scope = screen.getByRole('combobox', { name: 'Conversation scope' });
    expect(scope).toHaveTextContent('Design');
    fireEvent.keyDown(scope, { key: 'ArrowDown' });
    fireEvent.keyDown(
      await screen.findByRole('option', { name: 'All conversations' }),
      { key: 'Enter' },
    );
    expect(onScopeChange).toHaveBeenCalledWith('all');
    fireEvent.click(screen.getByRole('button', { name: 'Design review' }));
    expect(onSelectThread).toHaveBeenCalledWith(props.threads[0]);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('identifies the active conversation for assistive technology', () => {
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
    fireEvent.click(screen.getByRole('button', { name: 'Recent' }));
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
