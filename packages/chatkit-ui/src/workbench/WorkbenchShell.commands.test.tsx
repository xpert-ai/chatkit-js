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
  it('inserts an editable task into the composer without submitting or changing threads', async () => {
    mocks.listSlotViews.mockResolvedValue([manifest]);
    render(
      <WorkbenchShell
        options={{ ...baseOptions, workbench: { enabled: true } }}
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
    await waitFor(() => expect(mocks.remoteViewProps).not.toBeNull());
    let result: unknown;
    await act(async () => {
      result = await mocks.remoteViewProps!.onClientCommand(
        'assistant.composer.insert',
        {
          text: 'Hotel example',
          workspaceFiles: [{ path: '/workspace/demo.json', name: 'Demo.json' }],
        },
        manifest,
      );
    });
    expect(result).toEqual({ success: true, status: 'inserted' });
    expect(mocks.updateComposer).toHaveBeenCalledWith(
      expect.objectContaining({
        text: 'Hotel example',
        appendText: true,
        workspaceFiles: [{ path: '/workspace/demo.json', name: 'Demo.json' }],
      }),
    );
    expect(mocks.stream.submit).not.toHaveBeenCalled();
    expect(mocks.stream.reset).not.toHaveBeenCalled();
  });

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

  it.each([true, false, undefined])(
    'forwards custom commands with shell activation %s instead of the payload claim',
    async (isActive) => {
      const original = Object.getOwnPropertyDescriptor(
        navigator,
        'userActivation',
      );
      Object.defineProperty(navigator, 'userActivation', {
        configurable: true,
        value: isActive === undefined ? undefined : { isActive },
      });
      try {
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
            { url: '/file.pdf', userActivated: !isActive },
            manifest,
          ),
        ).resolves.toEqual({ opened: true });
        expect(onClientCommand).toHaveBeenCalledWith({
          commandKey: 'platform.custom.open',
          userActivated: isActive === true,
          payload: { url: '/file.pdf', userActivated: !isActive },
          hostType: 'agent',
          hostId: 'agent-1',
          viewKey: manifest.key,
        });
      } finally {
        if (original)
          Object.defineProperty(navigator, 'userActivation', original);
        else Reflect.deleteProperty(navigator, 'userActivation');
      }
    },
  );

  it('keeps independent side-chat runtimes mounted across tab close and reopen', async () => {
    mocks.copyThread
      .mockResolvedValueOnce({ thread_id: 'side-thread-1' })
      .mockResolvedValueOnce({ thread_id: 'side-thread-2' });
    function Launcher() {
      const workbench = useWorkbench();
      return (
        <>
          <button
            onClick={() =>
              void workbench.askInSideChat({
                type: 'quote',
                text: 'First topic',
              })
            }
          >
            First
          </button>
          <button
            onClick={() =>
              void workbench.askInSideChat({
                type: 'quote',
                text: 'Second topic',
              })
            }
          >
            Second
          </button>
          <button
            onClick={() =>
              void workbench.sideChats?.openSideChat('side-thread-1')
            }
          >
            Reopen first
          </button>
        </>
      );
    }
    render(
      <WorkbenchShell
        options={{ ...baseOptions, workbench: { sideChat: { enabled: true } } }}
        locale="en-US"
        onRequestContextChange={vi.fn()}
      >
        <Launcher />
      </WorkbenchShell>,
    );
    setObservedWidth(1200);
    fireEvent.click(screen.getByRole('button', { name: 'First' }));
    await screen.findByRole('tab', { name: 'First topic' });
    fireEvent.click(screen.getByRole('button', { name: 'Second' }));
    await screen.findByRole('tab', { name: 'Second topic' });
    expect(mocks.copyThread).toHaveBeenCalledTimes(2);
    expect(mocks.sideChatMounts).toBe(2);
    fireEvent.click(screen.getByLabelText('Close views: First topic'));
    expect(
      screen.queryByRole('tab', { name: 'First topic' }),
    ).not.toBeInTheDocument();
    expect(mocks.sideChatUnmounts).toBe(0);
    expect(mocks.deleteThread).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Reopen first' }));
    expect(
      await screen.findByRole('tab', { name: 'First topic' }),
    ).toHaveAttribute('aria-selected', 'true');
    expect(mocks.copyThread).toHaveBeenCalledTimes(2);
    expect(mocks.sideChatMounts).toBe(2);
  });
});
