import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ThemeProvider } from '../../providers/Theme';
import { WorkbenchTab } from '../WorkbenchTab';
import { WorkbenchTabs } from '../WorkbenchTabs';
import {
  WorkbenchTabDropdown,
  WorkbenchTabMenuProvider,
} from '../WorkbenchTabMenu';
import { useSideChatLifecycleActions } from './useSideChatLifecycleActions';
import type { useWorkbenchSideChat } from '../shell/side-chat/useWorkbenchSideChat';

function chats(): ReturnType<typeof useWorkbenchSideChat> {
  return {
    sessions: [
      {
        threadId: 'side',
        sourceThreadId: 'main',
        title: 'Review 1',
        status: 'idle',
        opened: true,
      },
    ],
    ready: true,
    opening: false,
    activeId: 'side',
    error: null,
    mutatingIds: [],
    archiveSideChat: vi.fn().mockResolvedValue(undefined),
    deleteSideChat: vi.fn().mockResolvedValue(undefined),
    askInSideChat: vi.fn(),
    openSideChat: vi.fn(),
    closeSideChat: vi.fn(),
    renameSideChat: vi.fn(),
    updateStatus: vi.fn(),
    reload: vi.fn(),
  };
}
function Fixture({ value }: { value: ReturnType<typeof chats> }) {
  const lifecycle = useSideChatLifecycleActions(value, vi.fn());
  return (
    <WorkbenchTabMenuProvider
      tabs={[{ key: 'side', actions: lifecycle.actions(value.sessions[0]) }]}
      onError={vi.fn()}
    >
      <WorkbenchTabs activeKey="side">
        <WorkbenchTab
          key="side"
          label="Review 1"
          selected
          icon={null}
          onSelect={vi.fn()}
        />
      </WorkbenchTabs>
      <WorkbenchTabDropdown tabKey="side" />
      {lifecycle.dialog}
    </WorkbenchTabMenuProvider>
  );
}
function open(menu: 'tab' | 'toolbar') {
  if (menu === 'tab')
    fireEvent.contextMenu(screen.getByRole('tab'), {
      button: 2,
      clientX: 50,
      clientY: 50,
    });
  else
    fireEvent.keyDown(screen.getByRole('button', { name: 'More actions' }), {
      key: 'Enter',
    });
}
describe('side-chat lifecycle menus', () => {
  it.each(['tab', 'toolbar'] as const)(
    'archives the correct side chat from the %s menu',
    async (menu) => {
      const value = chats();
      render(<Fixture value={value} />, { wrapper: ThemeProvider });
      open(menu);
      fireEvent.click(await screen.findByRole('menuitem', { name: 'Archive' }));
      await waitFor(() =>
        expect(value.archiveSideChat).toHaveBeenCalledWith('side', true),
      );
      expect(value.deleteSideChat).not.toHaveBeenCalled();
    },
  );

  it.each(['tab', 'toolbar'] as const)(
    'requires confirmation, allows cancel and retries a failed delete from the %s menu',
    async (menu) => {
      const value = chats();
      vi.mocked(value.deleteSideChat).mockRejectedValueOnce(
        new Error('Stop the side chat before deleting it'),
      );
      render(<Fixture value={value} />, { wrapper: ThemeProvider });
      open(menu);
      fireEvent.click(
        await screen.findByRole('menuitem', { name: 'Permanently delete…' }),
      );
      const dialog = await screen.findByRole('dialog');
      expect(value.deleteSideChat).not.toHaveBeenCalled();
      expect(
        within(dialog).getByRole('button', { name: 'Cancel' }),
      ).toHaveFocus();
      fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
      await waitFor(() =>
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
      );
      open(menu);
      fireEvent.click(
        await screen.findByRole('menuitem', { name: 'Permanently delete…' }),
      );
      fireEvent.click(
        await screen.findByRole('button', { name: 'Permanently delete' }),
      );
      expect(await screen.findByRole('alert')).toHaveTextContent(
        'Stop the side chat before deleting it',
      );
      expect(value.deleteSideChat).toHaveBeenCalledWith('side');
      fireEvent.click(
        screen.getByRole('button', { name: 'Permanently delete' }),
      );
      await waitFor(() =>
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
      );
      expect(value.deleteSideChat).toHaveBeenCalledTimes(2);
    },
  );

  it('disables deletion for a running chat', async () => {
    const value = chats();
    value.sessions[0].status = 'busy';
    render(<Fixture value={value} />, { wrapper: ThemeProvider });
    open('tab');
    expect(
      await screen.findByRole('menuitem', { name: 'Permanently delete…' }),
    ).toHaveAttribute('data-disabled');
  });
});
