import { describe, expect, it } from 'vitest';
import { setupWorkbenchTests, fixture } from './WorkbenchShell.test-fixture';
const {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  vi,
  mocks,
  WorkbenchShell,
  WorkbenchToggleButton,
  useWorkbench,
  SIDE_CHAT_CLOSE_CONFIRMATION_STORAGE_KEY,
  externalMessages,
  manifest,
  baseOptions,
  setObservedWidth,
} = fixture;

describe('WorkbenchShell', () => {
  setupWorkbenchTests();
  it.each(['assistant.execution', 'assistant.conversation'])(
    'opens %s records from remote views without host navigation or resetting the chat',
    async (target) => {
      mocks.stream.messages = externalMessages();
      mocks.listSlotViews.mockResolvedValue([manifest]);
      const onClientCommand = vi.fn();
      const onNavigate = vi.fn();
      render(
        <WorkbenchShell
          options={{
            ...baseOptions,
            workbench: { enabled: true, onClientCommand },
          }}
          locale="en-US"
          onRequestContextChange={vi.fn()}
          onNavigate={onNavigate}
        >
          <WorkbenchToggleButton />
          <input aria-label="Draft" defaultValue="Keep my draft" />
        </WorkbenchShell>,
      );
      setObservedWidth(1200);
      await waitFor(() =>
        expect(screen.getByLabelText('Open views')).toBeEnabled(),
      );
      fireEvent.click(screen.getByLabelText('Open views'));
      fireEvent.click(await screen.findByRole('tab', { name: 'Documents' }));
      await waitFor(() => expect(mocks.remoteViewProps).not.toBeNull());
      for (let i = 0; i < 2; i++) {
        let response!: Promise<unknown>;
        act(() => {
          response = mocks.remoteViewProps!.onClientCommand(
            'workbench.navigation.open',
            {
              target,
              conversationId: 'conversation-1',
              threadId: 'thread-1',
              projectId: 'project-1',
              executionId: 'external-1',
            },
            manifest,
          );
        });
        expect(await response).toMatchObject({
          success: true,
          status: 'opened',
        });
        expect(
          await screen.findByText('External response'),
        ).toBeInTheDocument();
        if (i === 0)
          fireEvent.click(screen.getByLabelText('Close external assistants'));
      }
      expect(screen.getByLabelText('Draft')).toHaveValue('Keep my draft');
      expect(onClientCommand).not.toHaveBeenCalled();
      expect(onNavigate).not.toHaveBeenCalled();
      expect(mocks.stream.reset).not.toHaveBeenCalled();
      expect(mocks.listSlotViews).toHaveBeenCalledOnce();
    },
  );

  it('forwards manifest client commands to the configured callback', async () => {
    mocks.listSlotViews.mockResolvedValue([manifest]);
    const onClientCommand = vi.fn().mockResolvedValue({ opened: true });
    render(
      <WorkbenchShell
        options={{
          ...baseOptions,
          workbench: { enabled: true, onClientCommand },
        }}
        locale="en-US"
        onRequestContextChange={vi.fn()}
      >
        <WorkbenchToggleButton />
      </WorkbenchShell>,
    );
    setObservedWidth(1200);
    await waitFor(() =>
      expect(screen.getByLabelText('Open views')).toBeEnabled(),
    );
    fireEvent.click(screen.getByLabelText('Open views'));
    await screen.findByTestId('remote-view');

    await expect(
      mocks.remoteViewProps?.onClientCommand(
        'platform.custom.open',
        { url: '/file.pdf' },
        manifest,
      ),
    ).resolves.toEqual({ opened: true });
    expect(onClientCommand).toHaveBeenCalledWith({
      commandKey: 'platform.custom.open',
      payload: { url: '/file.pdf' },
      hostType: 'agent',
      hostId: 'agent-1',
      viewKey: manifest.key,
    });
  });

  it('copies once per source thread and reuses the native side chat for later selections', async () => {
    mocks.copyThread.mockResolvedValue({ thread_id: 'side-thread-1' });

    function SideChatLauncher() {
      const workbench = useWorkbench();
      return (
        <>
          <button
            type="button"
            onClick={() =>
              void workbench.askInSideChat({
                type: 'quote',
                text: 'first selection',
              })
            }
          >
            First
          </button>
          <button
            type="button"
            onClick={() =>
              void workbench.askInSideChat({
                type: 'quote',
                text: 'second selection',
              })
            }
          >
            Second
          </button>
        </>
      );
    }

    render(
      <WorkbenchShell
        options={{
          ...baseOptions,
          workbench: { sideChat: { enabled: true } },
        }}
        locale="en-US"
        onRequestContextChange={vi.fn()}
      >
        <SideChatLauncher />
      </WorkbenchShell>,
    );
    setObservedWidth(1200);

    fireEvent.click(screen.getByRole('button', { name: 'First' }));
    expect(await screen.findByTestId('side-chat')).toBeInTheDocument();
    expect(mocks.copyThread).toHaveBeenCalledTimes(1);
    expect(mocks.copyThread).toHaveBeenCalledWith('thread-1');
    expect(mocks.sideChatProps?.referenceRequest?.reference?.text).toBe(
      'first selection',
    );

    fireEvent.click(screen.getByRole('button', { name: 'Second' }));
    await waitFor(() =>
      expect(mocks.sideChatProps?.referenceRequest?.reference?.text).toBe(
        'second selection',
      ),
    );
    expect(mocks.copyThread).toHaveBeenCalledTimes(1);

    // Collapsing the modal and moving between hosts must keep the running
    // side chat mounted, without retaining a hidden modal pointer lock.
    setObservedWidth(720);
    expect(
      screen.queryByRole('dialog', { hidden: true }),
    ).not.toBeInTheDocument();
    expect(document.body.style.pointerEvents).not.toBe('none');
    fireEvent.click(screen.getByRole('button', { name: 'Second' }));
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(mocks.sideChatMounts).toBe(1);
    fireEvent.click(screen.getByLabelText('Show or hide sidebar'));
    await waitFor(() =>
      expect(
        screen.queryByRole('dialog', { hidden: true }),
      ).not.toBeInTheDocument(),
    );
    expect(document.body.style.pointerEvents).not.toBe('none');
    expect(mocks.sideChatUnmounts).toBe(0);
    setObservedWidth(1200);
    expect(screen.getByTestId('side-chat')).toBeInTheDocument();
    expect(mocks.copyThread).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByLabelText('Close views: Side chat'));
    expect(
      screen.getByRole('alertdialog', { name: 'Close side chat?' }),
    ).toBeInTheDocument();
    expect(mocks.sideChatMounts).toBe(1);
    expect(mocks.sideChatUnmounts).toBe(0);

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(screen.getByTestId('side-chat')).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Close views: Side chat'));
    fireEvent.click(screen.getByRole('checkbox', { name: "Don't ask again" }));
    fireEvent.click(screen.getByRole('button', { name: 'Close side chat' }));

    await waitFor(() =>
      expect(screen.queryByTestId('side-chat')).not.toBeInTheDocument(),
    );
    expect(mocks.sideChatUnmounts).toBe(1);
    expect(mocks.deleteThread).not.toHaveBeenCalled();
    expect(
      window.localStorage.getItem(SIDE_CHAT_CLOSE_CONFIRMATION_STORAGE_KEY),
    ).toBe('true');

    fireEvent.click(screen.getByRole('button', { name: 'Second' }));
    expect(await screen.findByTestId('side-chat')).toBeInTheDocument();
    expect(mocks.copyThread).toHaveBeenCalledTimes(2);

    fireEvent.click(screen.getByLabelText('Close views: Side chat'));
    await waitFor(() =>
      expect(screen.queryByTestId('side-chat')).not.toBeInTheDocument(),
    );
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(mocks.deleteThread).not.toHaveBeenCalled();
  });
});
