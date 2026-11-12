import * as React from 'react';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Client, type ChatConversation } from '@xpert-ai/xpert-sdk';
import type { ThreadItem } from '../../hooks/useThreads';
import { setLanguage } from '../../i18n';
import { ThemeProvider } from '../../providers/Theme';
import { HistorySidebar } from '../history/HistorySidebar';
import { ChatHeaderActions } from '../chat/header/ChatHeaderActions';
import {
  WorkbenchContext,
  disabledWorkbenchContext,
} from '../../workbench/context';
import { ConversationMenu } from './ConversationMenu';
import type { ConversationActionContext } from './conversation-actions';

beforeEach(() => {
  setLanguage('en-US');
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function fixture() {
  const client = new Client({ apiUrl: 'https://example.invalid' });
  const target: ThreadItem = {
    recordId: 'record',
    id: 'secondary',
    title: 'Report',
    status: 'idle',
  };
  const detail: ChatConversation = {
    id: 'record',
    threadId: 'original',
    title: 'Report',
    status: 'idle',
  };
  const get = vi.spyOn(client.conversations, 'get').mockResolvedValue(detail);
  const messages = vi
    .spyOn(client.conversations, 'searchMessages')
    .mockResolvedValue({
      items: [
        {
          id: 'question',
          role: 'user',
          content: 'Question',
          createdAt: '2026-01-01T00:00:00Z',
        },
        {
          id: 'reply',
          role: 'assistant',
          content: 'Visible reply',
          branching: { available: true },
          createdAt: '2026-01-01T00:00:01Z',
        },
      ],
      total: 2,
    });
  const branch = vi.spyOn(client.conversations, 'branch').mockResolvedValue({
    id: 'new-record',
    threadId: 'new-thread',
    title: 'Branch',
  });
  const preview = vi
    .spyOn(client.conversations, 'previewShare')
    .mockResolvedValue({
      snapshot: { title: 'Report', messages: [] },
      digest: 'digest',
      publicSharingEnabled: false,
    });
  vi.spyOn(client.conversations, 'listShares').mockResolvedValue([]);
  const createShare = vi.spyOn(client.conversations, 'createShare');
  const context: ConversationActionContext = {
    client,
    scopeKey: 'scope',
    ready: true,
    activeConversationId: 'record',
    activeThreadId: 'secondary',
    running: false,
    history: {},
    branchEnabled: true,
    rename: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
    navigate: vi.fn(),
    sideChat: vi.fn().mockResolvedValue(undefined),
  };
  return {
    context,
    target,
    get,
    messages,
    branch,
    preview,
    createShare,
    detail,
  };
}

async function open(placement: 'header' | 'history' = 'header') {
  fireEvent.keyDown(
    screen.getByRole('button', {
      name: placement === 'header' ? 'More actions' : 'Actions for Report',
    }),
    { key: 'Enter' },
  );
  await screen.findByRole('menuitem', { name: 'Continue in new chat' });
}

describe('shared conversation menu', () => {
  it.each([false, true])(
    'opens the schedule form for the active branch (running = %s)',
    async (running) => {
      const f = fixture();
      const openScheduleForm = vi.fn();
      if (running) f.get.mockResolvedValue({ ...f.detail, status: 'busy' });
      render(
        <WorkbenchContext.Provider
          value={{ ...disabledWorkbenchContext, openScheduleForm }}
        >
          <ConversationMenu context={{ ...f.context, running }} target={f.target} />
        </WorkbenchContext.Provider>,
      );
      fireEvent.keyDown(screen.getByRole('button', { name: 'More actions' }), {
        key: 'Enter',
      });
      fireEvent.click(
        await screen.findByRole('menuitem', { name: 'Add scheduled task…' }),
      );
      expect(openScheduleForm).toHaveBeenCalledWith(f.target.id, f.target.title);
    },
  );

  it('clears cached access and closes a menu when the runtime client changes', async () => {
    const f = fixture();
    const { rerender } = render(
      <ConversationMenu context={f.context} target={f.target} />,
    );
    await open();
    const next = fixture();
    next.get.mockRejectedValue(new Error('Forbidden'));
    rerender(<ConversationMenu context={next.context} target={f.target} />);
    await waitFor(() => expect(screen.queryByRole('menu')).toBeNull());
    fireEvent.keyDown(screen.getByRole('button', { name: 'More actions' }), {
      key: 'Enter',
    });
    await screen.findByRole('alert');
    expect(screen.getByRole('menuitem', { name: /Rename/ })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
    expect(next.messages).not.toHaveBeenCalled();
  });

  it.each(['header', 'history'] as const)(
    'keeps copy/export and branch choices accessible on narrow screens from %s',
    async (placement) => {
      const f = fixture();
      vi.stubGlobal(
        'matchMedia',
        vi.fn().mockReturnValue({
          matches: true,
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
        }),
      );
      const writeText = vi.fn().mockResolvedValue(undefined);
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: { writeText },
      });
      render(
        <ConversationMenu
          context={f.context}
          target={f.target}
          placement={placement}
        />,
      );
      await open(placement);
      fireEvent.click(
        screen.getByRole('menuitem', { name: 'Copy and export' }),
      );
      const dialog = await screen.findByRole('dialog', {
        name: 'Copy and export',
      });
      fireEvent.click(
        within(dialog).getByRole('button', { name: 'Copy as plain text' }),
      );
      await screen.findByText('Copied');
      expect(writeText).toHaveBeenCalledWith(
        expect.stringContaining('Visible reply'),
      );
      fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
      await open(placement);
      fireEvent.click(
        screen.getByRole('menuitem', { name: 'Continue in new chat' }),
      );
      const branchDialog = await screen.findByRole('dialog', {
        name: 'Continue in new chat',
      });
      fireEvent.click(
        within(branchDialog).getByRole('button', { name: 'Visible reply' }),
      );
      await waitFor(() =>
        expect(f.branch).toHaveBeenCalledWith('record', {
          sourceThreadId: 'secondary',
          afterMessageId: 'reply',
          requestId: expect.any(String),
        }),
      );
    },
  );

  it('refreshes an open menu transcript after a new run finishes', async () => {
    const f = fixture();
    const { rerender } = render(
      <ConversationMenu context={f.context} target={f.target} />,
    );
    await open();
    rerender(
      <ConversationMenu
        context={{ ...f.context, running: true }}
        target={f.target}
      />,
    );
    await waitFor(() => expect(f.messages).toHaveBeenCalledTimes(2));
    f.messages.mockResolvedValue({
      items: [
        {
          id: 'new-reply',
          role: 'assistant',
          content: 'Newest reply',
          branching: { available: true },
        },
      ],
      total: 1,
    });
    rerender(<ConversationMenu context={f.context} target={f.target} />);
    await waitFor(() => expect(f.messages).toHaveBeenCalledTimes(3));
    fireEvent.keyDown(
      await screen.findByRole('menuitem', { name: 'Continue in new chat' }),
      { key: 'ArrowRight' },
    );
    fireEvent.click(
      await screen.findByRole('menuitem', { name: 'Choose a reply…' }),
    );
    expect(
      await screen.findByRole('button', { name: 'Newest reply' }),
    ).toBeVisible();
  });
  it('opens side chat only for the selected conversation and only when the host enables it', async () => {
    const f = fixture();
    const { rerender } = render(
      <ConversationMenu context={f.context} target={f.target} />,
    );
    await open();
    fireEvent.click(screen.getByRole('menuitem', { name: 'New side chat' }));
    await waitFor(() => expect(f.context.sideChat).toHaveBeenCalledOnce());
    rerender(
      <ConversationMenu
        context={{
          ...f.context,
          scopeKey: 'other',
          activeConversationId: 'different',
        }}
        target={f.target}
      />,
    );
    await open();
    expect(
      screen.queryByRole('menuitem', { name: 'New side chat' }),
    ).toBeNull();
  });

  it('hides branching when the host opts out or the server has no saved reply boundary', async () => {
    const f = fixture();
    f.messages.mockResolvedValue({
      items: [
        {
          id: 'a',
          role: 'assistant',
          content: 'Answer',
          branching: { available: false },
        },
      ],
      total: 1,
    });
    render(
      <ConversationMenu
        context={{ ...f.context, branchEnabled: false }}
        target={f.target}
      />,
    );
    fireEvent.keyDown(screen.getByRole('button', { name: 'More actions' }), {
      key: 'Enter',
    });
    await waitFor(() =>
      expect(
        screen.getByRole('menuitem', { name: 'Copy and export' }),
      ).not.toHaveAttribute('aria-disabled'),
    );
    expect(
      screen.queryByRole('menuitem', { name: 'Continue in new chat' }),
    ).toBeNull();
    expect(
      screen.queryByRole('menuitem', { name: 'New side chat' }),
    ).toBeNull();
  });

  it('fails closed when conversation access is denied', async () => {
    const f = fixture();
    f.get.mockRejectedValue(new Error('Forbidden'));
    render(<ConversationMenu context={f.context} target={f.target} />);
    fireEvent.keyDown(screen.getByRole('button', { name: 'More actions' }), {
      key: 'Enter',
    });
    await screen.findByRole('alert');
    expect(f.messages).not.toHaveBeenCalled();
    expect(
      screen.getByRole('menuitem', { name: /Delete conversation/ }),
    ).toHaveAttribute('aria-disabled', 'true');
    expect(f.context.delete).not.toHaveBeenCalled();
  });
  it.each(['header', 'history'] as const)(
    'renames the correct conversation from the %s entry and restores focus',
    async (placement) => {
      const f = fixture();
      render(
        <ThemeProvider>
          {placement === 'header' ? (
            <ChatHeaderActions
              conversationMenu={{ context: f.context, target: f.target }}
            />
          ) : (
            <HistorySidebar
              open
              threads={[f.target]}
              conversationActions={f.context}
            />
          )}
        </ThemeProvider>,
      );
      expect(f.get).not.toHaveBeenCalled();
      await open(placement);
      fireEvent.click(screen.getByRole('menuitem', { name: 'Rename' }));
      const dialog = await screen.findByRole('dialog', {
        name: 'Rename conversation',
      });
      const input = within(dialog).getByRole('textbox');
      fireEvent.change(input, { target: { value: '  Updated report  ' } });
      fireEvent.click(
        within(dialog).getByRole('button', { name: 'Save title' }),
      );
      await waitFor(() =>
        expect(f.context.rename).toHaveBeenCalledWith(
          expect.objectContaining({ recordId: 'record', id: 'secondary' }),
          'Updated report',
        ),
      );
      await waitFor(() =>
        expect(
          screen.queryByRole('dialog', { name: 'Rename conversation' }),
        ).toBeNull(),
      );
      await waitFor(() =>
        expect(
          screen.getByRole('button', {
            name:
              placement === 'header' ? 'More actions' : 'Actions for Report',
          }),
        ).toHaveFocus(),
      );
      expect(f.branch).not.toHaveBeenCalled();
    },
  );

  it('uses target metadata for project sharing and hides unsupported host and management actions', async () => {
    const f = fixture();
    f.get.mockResolvedValue({ ...f.detail, projectId: 'other-project' });
    render(
      <ConversationMenu
        context={{
          ...f.context,
          activeConversationId: 'other',
          sideChat: undefined,
          history: { showDelete: false, showRename: false },
        }}
        target={f.target}
        placement="history"
      />,
    );
    await open('history');
    for (const name of [
      'Share…',
      'Rename',
      'Delete conversation…',
      'New side chat',
      'Pin',
      'Archive',
      'Open in new window',
      'Copy conversation link',
    ])
      expect(screen.queryByRole('menuitem', { name })).toBeNull();
    expect(f.preview).not.toHaveBeenCalled();
    expect(f.createShare).not.toHaveBeenCalled();
  });

  it('keeps running conversations renameable but blocks delete, sharing and complete exports', async () => {
    const f = fixture();
    f.get.mockResolvedValue({ ...f.detail, status: 'busy' });
    render(<ConversationMenu context={f.context} target={f.target} />);
    await open();
    expect(
      screen.getByRole('menuitem', { name: 'Rename' }),
    ).not.toHaveAttribute('aria-disabled');
    for (const name of [/Delete conversation/, /Share…/, /Copy and export/])
      expect(screen.getByRole('menuitem', { name })).toHaveAttribute(
        'aria-disabled',
        'true',
      );
  });

  it('confirms deletion, rechecks running state and prevents a stale delete', async () => {
    const f = fixture();
    render(<ConversationMenu context={f.context} target={f.target} />);
    await open();
    fireEvent.click(
      screen.getByRole('menuitem', {
        name: 'Delete conversation…',
      }),
    );
    const dialog = await screen.findByRole('dialog', {
      name: 'Delete conversation',
    });
    expect(f.context.delete).not.toHaveBeenCalled();
    f.get.mockResolvedValue({ ...f.detail, status: 'busy' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' }));
    await within(dialog).findByRole('alert');
    expect(f.context.delete).not.toHaveBeenCalled();
  });

  it('only deletes after confirmation and keeps API failures retryable', async () => {
    const f = fixture();
    vi.mocked(f.context.delete)
      .mockRejectedValueOnce(new Error('Forbidden'))
      .mockResolvedValue(undefined);
    render(<ConversationMenu context={f.context} target={f.target} />);
    await open();
    fireEvent.click(
      screen.getByRole('menuitem', {
        name: 'Delete conversation…',
      }),
    );
    const dialog = await screen.findByRole('dialog', {
      name: 'Delete conversation',
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' }));
    await within(dialog).findByRole('alert');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(f.context.delete).toHaveBeenCalledTimes(2);
  });

  it('shares the selected secondary thread without creating a link on open', async () => {
    const f = fixture();
    render(<ConversationMenu context={f.context} target={f.target} />);
    await open();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Share…' }));
    await waitFor(() =>
      expect(f.preview).toHaveBeenCalledWith('record', 'secondary'),
    );
    expect(f.createShare).not.toHaveBeenCalled();
  });

  it('creates an independent branch from the chosen server-advertised reply', async () => {
    const f = fixture();
    render(<ConversationMenu context={f.context} target={f.target} />);
    await open();
    fireEvent.keyDown(
      screen.getByRole('menuitem', { name: 'Continue in new chat' }),
      { key: 'ArrowRight' },
    );
    fireEvent.click(
      await screen.findByRole('menuitem', { name: 'Choose a reply…' }),
    );
    fireEvent.click(
      await screen.findByRole('button', { name: 'Visible reply' }),
    );
    await waitFor(() =>
      expect(f.context.navigate).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'new-record', threadId: 'new-thread' }),
      ),
    );
    expect(f.branch).toHaveBeenCalledWith('record', {
      sourceThreadId: 'secondary',
      afterMessageId: 'reply',
      requestId: expect.any(String),
    });
  });

  it('ignores a delayed branch response after switching conversation', async () => {
    const f = fixture();
    let resolve!: (value: ChatConversation) => void;
    f.branch.mockReturnValue(
      new Promise((done) => {
        resolve = done;
      }),
    );
    const { rerender } = render(
      <ConversationMenu context={f.context} target={f.target} />,
    );
    await open();
    fireEvent.keyDown(
      screen.getByRole('menuitem', { name: 'Continue in new chat' }),
      { key: 'ArrowRight' },
    );
    fireEvent.click(
      await screen.findByRole('menuitem', {
        name: 'From the latest completed reply',
      }),
    );
    await waitFor(() => expect(f.branch).toHaveBeenCalledOnce());
    rerender(
      <ConversationMenu
        context={{ ...f.context, scopeKey: 'next-scope' }}
        target={{ ...f.target, recordId: 'next-record' }}
      />,
    );
    await act(async () =>
      resolve({ id: 'late-record', threadId: 'late-thread' }),
    );
    expect(f.context.navigate).not.toHaveBeenCalled();
  });

  it('copies only after complete history is loaded and reports actual clipboard failures', async () => {
    const f = fixture();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });
    render(<ConversationMenu context={f.context} target={f.target} />);
    await open();
    fireEvent.keyDown(
      screen.getByRole('menuitem', { name: 'Copy and export' }),
      { key: 'ArrowRight' },
    );
    fireEvent.click(
      await screen.findByRole('menuitem', { name: 'Copy as Markdown' }),
    );
    await screen.findByText('Copied');
    expect(writeText).toHaveBeenCalledWith(
      expect.stringContaining('Visible reply'),
    );
    writeText.mockRejectedValueOnce(new Error('Clipboard denied'));
    fireEvent.click(
      screen.getByRole('menuitem', { name: 'Copy as plain text' }),
    );
    await screen.findByRole('dialog', { name: 'Action failed' });
    expect(screen.queryByText('Copied')).toBeNull();
  });

  it('updates nested menu and dialog theme tokens while surfaces remain open', async () => {
    const f = fixture();
    const renderMenu = (
      radius: 'sharp' | 'round',
      density: 'compact' | 'spacious',
      colorScheme: 'light' | 'dark',
    ) => (
      <ThemeProvider theme={{ radius, density, colorScheme }}>
        <ConversationMenu context={f.context} target={f.target} />
      </ThemeProvider>
    );
    const { rerender } = render(renderMenu('sharp', 'compact', 'light'));
    await open();
    fireEvent.keyDown(
      screen.getByRole('menuitem', { name: 'Copy and export' }),
      { key: 'ArrowRight' },
    );
    const item = await screen.findByRole('menuitem', {
      name: 'Copy as Markdown',
    });
    const sub = item.closest(
      '[data-slot=dropdown-menu-sub-content]',
    ) as HTMLElement;
    expect(sub.style.getPropertyValue('--chat-panel-radius')).toBe('0px');
    expect(sub.style.getPropertyValue('--chat-density-scale')).toBe('0.75');
    rerender(renderMenu('round', 'spacious', 'dark'));
    expect(sub.style.getPropertyValue('--chat-density-scale')).toBe('1.25');
    expect(sub.style.getPropertyValue('--chat-panel-radius')).toContain(
      '+ 4px',
    );
    fireEvent.keyDown(item, { key: 'ArrowLeft' });
    fireEvent.click(screen.getByRole('menuitem', { name: 'Rename' }));
    const dialog = await screen.findByRole('dialog');
    expect(dialog.style.getPropertyValue('--chat-density-scale')).toBe('1.25');
    rerender(renderMenu('sharp', 'compact', 'light'));
    expect(dialog.style.getPropertyValue('--chat-panel-radius')).toBe('0px');
  });
});
