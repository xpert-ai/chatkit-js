import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ThemeProvider } from '../../providers/Theme';
import {
  collectLiveTaskSummary,
  mergeTaskSummary,
} from '../../lib/task-summary';
import {
  TaskSummaryPanel,
  TaskSummaryTrigger,
  type TaskSummaryProps,
} from './TaskSummary';

beforeEach(() => {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
});
afterEach(() => vi.unstubAllGlobals());

function setupProps(): TaskSummaryProps & {
  sideChats: NonNullable<TaskSummaryProps['sideChats']>;
} {
  return {
    summary: mergeTaskSummary(null, collectLiveTaskSummary({ messages: [] })),
    onRetryHistory: vi.fn(),
    onLoadSection: vi.fn(),
    onNavigateMessage: vi.fn(),
    onFocusComposer: vi.fn(),
    onOpenResource: vi.fn(),
    sideChats: {
      sessions: [
        {
          threadId: 'side-1',
          sourceThreadId: 'main',
          title: 'Review the design',
          status: 'busy',
          opened: true,
        },
        {
          threadId: 'side-2',
          sourceThreadId: 'main',
          title: 'Check the API',
          status: 'idle',
          opened: false,
        },
      ],
      activeId: 'side-1',
      ready: true,
      opening: false,
      error: null,
      askInSideChat: vi.fn().mockResolvedValue(undefined),
      openSideChat: vi.fn().mockResolvedValue(undefined),
      archiveSideChat: vi.fn().mockResolvedValue(undefined),
      deleteSideChat: vi.fn().mockResolvedValue(undefined),
      mutatingIds: [],
      renameSideChat: vi.fn().mockResolvedValue(undefined),
      closeSideChat: vi.fn(),
      updateStatus: vi.fn(),
      reload: vi.fn(),
    },
  };
}

describe('Side chats in the task summary', () => {
  it('collapses only the requested tab and can reopen it from the trailing control', async () => {
    const props = setupProps();
    const view = render(<TaskSummaryTrigger {...props} />, {
      wrapper: ThemeProvider,
    });
    fireEvent.click(screen.getByRole('button', { name: 'Open task summary' }));
    fireEvent.click(
      screen.getByRole('button', {
        name: 'Collapse side chat: Review the design',
      }),
    );
    expect(props.sideChats.closeSideChat).toHaveBeenCalledWith('side-1');
    expect(props.sideChats.openSideChat).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    view.rerender(
      <TaskSummaryTrigger
        {...props}
        sideChats={{
          ...props.sideChats,
          sessions: props.sideChats.sessions.map((session) => ({
            ...session,
            opened: false,
          })),
        }}
      />,
    );
    fireEvent.click(
      screen.getByRole('button', {
        name: 'Reopen side chat: Review the design',
      }),
    );
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    );
    expect(props.sideChats.openSideChat).toHaveBeenCalledWith('side-1');
  });

  it('supports keyboard renaming without opening a side chat', () => {
    const props = setupProps();
    render(<TaskSummaryPanel {...props} />, { wrapper: ThemeProvider });
    fireEvent.keyDown(screen.getByRole('button', { name: /^Check the API/ }), {
      key: 'F2',
    });
    expect(screen.getByRole('textbox', { name: 'Chat name' })).toHaveFocus();
    expect(props.sideChats.openSideChat).not.toHaveBeenCalled();
  });

  it('propagates theme updates to the contextual menu portal', () => {
    const props = setupProps();
    const content = <TaskSummaryPanel {...props} />;
    const view = render(
      <ThemeProvider theme={{ radius: 'sharp', density: 'compact' }}>
        {content}
      </ThemeProvider>,
    );
    fireEvent.contextMenu(
      screen.getByRole('button', { name: /^Check the API/ }),
    );
    expect(screen.getByRole('menu')).toHaveStyle(
      '--chat-panel-radius: 0px; --chat-density-scale: 0.75',
    );
    view.rerender(
      <ThemeProvider theme={{ radius: 'round', density: 'spacious' }}>
        {content}
      </ThemeProvider>,
    );
    expect(screen.getByRole('menu')).toHaveStyle('--chat-density-scale: 1.25');
    expect(screen.getByRole('menu')).not.toHaveStyle(
      '--chat-panel-radius: 0px',
    );
  });

  it('lists open and closed chats between outputs and sources and opens an existing chat', async () => {
    const props = setupProps();
    render(<TaskSummaryTrigger {...props} />, { wrapper: ThemeProvider });
    fireEvent.click(screen.getByRole('button', { name: 'Open task summary' }));
    const panel = screen.getByRole('dialog');
    expect(
      within(panel)
        .getAllByRole('region')
        .map((region) => region.getAttribute('aria-label')),
    ).toEqual(['Outputs', 'Side chats', 'Sources']);
    expect(
      within(panel).getByRole('button', { name: /^Review the design/ }),
    ).toHaveAttribute('aria-current', 'true');
    fireEvent.click(
      within(panel).getByRole('button', { name: /^Check the API/ }),
    );
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    );
    expect(props.sideChats.openSideChat).toHaveBeenCalledWith('side-2');
  });

  it('closes the popover after creation succeeds and prevents repeated creation while busy', async () => {
    const props = setupProps();
    props.sideChats.opening = true;
    const view = render(<TaskSummaryTrigger {...props} />, {
      wrapper: ThemeProvider,
    });
    fireEvent.click(screen.getByRole('button', { name: 'Open task summary' }));
    expect(
      screen.getByRole('button', { name: 'New side chat' }),
    ).toBeDisabled();
    props.sideChats.opening = false;
    view.rerender(<TaskSummaryTrigger {...props} />);
    fireEvent.click(screen.getByRole('button', { name: 'New side chat' }));
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    );
    expect(props.sideChats.askInSideChat).toHaveBeenCalledOnce();
  });

  it('keeps the popover open and the existing list usable when creation fails', async () => {
    const props = setupProps();
    vi.mocked(props.sideChats.askInSideChat).mockRejectedValue(
      new Error('Creation failed'),
    );
    render(<TaskSummaryTrigger {...props} />, { wrapper: ThemeProvider });
    fireEvent.click(screen.getByRole('button', { name: 'Open task summary' }));
    fireEvent.click(screen.getByRole('button', { name: 'New side chat' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Creation failed',
    );
    expect(
      screen.getByRole('button', { name: /^Check the API/ }),
    ).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(props.sideChats.reload).toHaveBeenCalledOnce();
  });

  it('renames a chat in place without navigating away or closing the summary', async () => {
    const props = setupProps();
    render(<TaskSummaryTrigger {...props} />, { wrapper: ThemeProvider });
    fireEvent.click(screen.getByRole('button', { name: 'Open task summary' }));
    fireEvent.contextMenu(
      screen.getByRole('button', { name: /^Check the API/ }),
    );
    fireEvent.click(
      screen.getByRole('menuitem', { name: 'Rename Check the API' }),
    );
    fireEvent.change(
      await screen.findByRole('textbox', { name: 'Chat name' }),
      {
        target: { value: 'API review' },
      },
    );
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() =>
      expect(screen.queryByRole('textbox')).not.toBeInTheDocument(),
    );
    expect(props.sideChats.renameSideChat).toHaveBeenCalledWith(
      'side-2',
      'API review',
    );
    expect(props.sideChats.openSideChat).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('keeps a docked summary visible after opening a chat and reflects refreshed titles and statuses', async () => {
    const props = setupProps();
    const view = render(<TaskSummaryPanel {...props} />, {
      wrapper: ThemeProvider,
    });
    fireEvent.click(screen.getByRole('button', { name: /^Check the API/ }));
    await waitFor(() =>
      expect(props.sideChats.openSideChat).toHaveBeenCalledWith('side-2'),
    );
    const next = {
      ...props,
      sideChats: {
        ...props.sideChats,
        activeId: 'side-2',
        sessions: [
          {
            ...props.sideChats.sessions[1],
            title: 'API review',
            status: 'busy' as const,
            opened: true,
          },
        ],
      },
    };
    view.rerender(<TaskSummaryPanel {...next} />);
    expect(
      screen.getByRole('complementary', { name: 'Task summary' }),
    ).toBeInTheDocument();
    expect(screen.queryByText('Review the design')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^API review/ })).toHaveAttribute(
      'aria-current',
      'true',
    );
  });
});

it('lists archived chats in their own section and restores through the server action', async () => {
  const props = setupProps();
  props.sideChats.sessions[1].archived = true;
  render(<TaskSummaryPanel {...props} />, { wrapper: ThemeProvider });
  expect(screen.getByText('Archived (1)')).toBeInTheDocument();
  fireEvent.click(screen.getByText('Archived (1)'));
  fireEvent.click(
    screen.getByRole('button', { name: 'Restore side chat: Check the API' }),
  );
  await waitFor(() =>
    expect(props.sideChats.archiveSideChat).toHaveBeenCalledWith(
      'side-2',
      false,
    ),
  );
  expect(props.sideChats.openSideChat).not.toHaveBeenCalled();
});
