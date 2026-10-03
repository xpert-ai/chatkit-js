import { describe, expect, it } from 'vitest';
import { setupWorkbenchTests, fixture } from './WorkbenchShell.test-fixture';
const {
  React,
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
  vi,
  mocks,
  WorkbenchShell,
  WorkbenchToggleButton,
  workbenchLayoutKey,
  writeWorkbenchLayout,
  manifest,
  baseOptions,
  setObservedWidth,
} = fixture;
import type { XpertExtensionViewManifest } from './WorkbenchShell.test-fixture';

describe('WorkbenchShell', () => {
  setupWorkbenchTests();
  it('swaps panes without remounting the draft or remote view and preserves their widths', async () => {
    mocks.listSlotViews.mockResolvedValue([manifest]);
    const { container } = render(
      <WorkbenchShell
        options={{ ...baseOptions, workbench: { enabled: true } }}
        locale="en-US"
        onRequestContextChange={vi.fn()}
      >
        <WorkbenchToggleButton />
        <input aria-label="Draft message" defaultValue="Keep my draft" />
      </WorkbenchShell>,
    );
    setObservedWidth(1200);
    await waitFor(() =>
      expect(screen.getByLabelText('Open views')).toBeEnabled(),
    );
    expect(
      screen.queryByLabelText('Swap left and right panes'),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Open views'));
    const remote = await screen.findByTestId('remote-view');
    const draft = screen.getByLabelText('Draft message');
    const root = container.querySelector('[data-chatkit-workbench-root]');
    fireEvent.click(screen.getByLabelText('Swap left and right panes'));
    expect(root).toHaveClass('flex-row-reverse');
    expect(screen.getByLabelText('Draft message')).toBe(draft);
    expect(draft).toHaveValue('Keep my draft');
    expect(screen.getByTestId('remote-view')).toBe(remote);
    expect(mocks.remoteUnmounts).toBe(0);
    expect(screen.getByRole('separator')).toHaveAttribute(
      'aria-valuenow',
      '540',
    );
    fireEvent.keyDown(screen.getByRole('separator'), { key: 'ArrowRight' });
    expect(screen.getByRole('separator')).toHaveAttribute(
      'aria-valuenow',
      '524',
    );
    fireEvent.keyDown(screen.getByRole('separator'), { key: 'ArrowLeft' });
    expect(screen.getByRole('separator')).toHaveAttribute(
      'aria-valuenow',
      '540',
    );
    fireEvent.click(screen.getByLabelText('Expand panel'));
    expect(
      screen.queryByLabelText('Swap left and right panes'),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Restore panel'));
    expect(root).toHaveClass('flex-row-reverse');
    fireEvent.click(screen.getByLabelText('Swap left and right panes'));
    expect(root).not.toHaveClass('flex-row-reverse');
    expect(screen.getByRole('separator')).toHaveAttribute(
      'aria-valuenow',
      '540',
    );
    expect(mocks.remoteUnmounts).toBe(0);
  });

  it('resizes a left workbench in the pointer direction and collapses chat toward the right', async () => {
    vi.stubGlobal(
      'PointerEvent',
      class extends MouseEvent {
        readonly pointerId: number;
        constructor(type: string, init: PointerEventInit = {}) {
          super(type, init);
          this.pointerId = init.pointerId ?? 1;
        }
      },
    );
    mocks.listSlotViews.mockResolvedValue([manifest]);
    const { container } = render(
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
    await screen.findByTestId('remote-view');
    fireEvent.click(screen.getByLabelText('Swap left and right panes'));
    const root = container.querySelector('[data-chatkit-workbench-root]');
    if (!root) throw new Error('Missing workbench root');
    vi.spyOn(root, 'getBoundingClientRect').mockReturnValue(
      new DOMRect(100, 0, 1200, 800),
    );
    fireEvent.pointerDown(screen.getByRole('separator'), {
      button: 0,
      clientX: 760,
      pointerId: 1,
    });
    fireEvent.pointerMove(window, { clientX: 660, pointerId: 1 });
    expect(screen.getByRole('separator')).toHaveAttribute(
      'aria-valuenow',
      '640',
    );
    fireEvent.pointerMove(window, { clientX: 860, pointerId: 1 });
    expect(screen.getByRole('separator')).toHaveAttribute(
      'aria-valuenow',
      '440',
    );
    fireEvent.pointerMove(window, { clientX: 1100, pointerId: 1 });
    expect(screen.getByRole('separator')).toHaveAttribute(
      'aria-valuenow',
      '384',
    );
    fireEvent.pointerMove(window, { clientX: 1109, pointerId: 1 });
    expect(screen.queryByRole('separator')).not.toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Restore panel'));
    expect(root).toHaveClass('flex-row-reverse');
    expect(screen.getByRole('separator')).toHaveAttribute(
      'aria-valuenow',
      '384',
    );
    vi.unstubAllGlobals();
  });

  it('remembers pane positions per assistant while narrow drawers leave the desktop preference intact', async () => {
    mocks.listSlotViews.mockResolvedValue([manifest]);
    const tree = () => (
      <WorkbenchShell
        options={{ ...baseOptions, workbench: { enabled: true } }}
        locale="en-US"
        onRequestContextChange={vi.fn()}
      >
        <WorkbenchToggleButton />
      </WorkbenchShell>
    );
    const first = render(tree());
    setObservedWidth(1200);
    await waitFor(() =>
      expect(screen.getByLabelText('Open views')).toBeEnabled(),
    );
    fireEvent.click(screen.getByLabelText('Open views'));
    fireEvent.click(screen.getByLabelText('Swap left and right panes'));
    first.unmount();
    const second = render(tree());
    setObservedWidth(1200);
    await screen.findByRole('separator');
    const root = second.container.querySelector(
      '[data-chatkit-workbench-root]',
    );
    expect(root).toHaveClass('flex-row-reverse');
    setObservedWidth(720);
    expect(root).not.toHaveClass('flex-row-reverse');
    expect(
      screen.queryByLabelText('Swap left and right panes'),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Open views'));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Show or hide sidebar'));
    setObservedWidth(1200);
    expect(root).toHaveClass('flex-row-reverse');
    expect(screen.getByRole('separator')).toHaveAttribute(
      'aria-valuenow',
      '540',
    );
    mocks.stream.assistantId = 'agent-2';
    second.rerender(tree());
    expect(root).not.toHaveClass('flex-row-reverse');
    await waitFor(() =>
      expect(screen.getByLabelText('Open views')).toBeEnabled(),
    );
    mocks.stream.assistantId = 'agent-1';
    second.rerender(tree());
    expect(root).toHaveClass('flex-row-reverse');
    await screen.findByRole('separator');
  });

  it('restores each assistant layout after remount, preserving chat width when the window changes', async () => {
    mocks.listSlotViews.mockResolvedValue([manifest]);
    const onContext = vi.fn();
    const tree = () => (
      <WorkbenchShell
        options={{ ...baseOptions, workbench: { enabled: true } }}
        locale="en-US"
        onRequestContextChange={onContext}
      >
        <WorkbenchToggleButton />
        <input aria-label="Draft message" />
      </WorkbenchShell>
    );
    const first = render(tree());
    setObservedWidth(1200);
    await waitFor(() =>
      expect(screen.getByLabelText('Open views')).toBeEnabled(),
    );
    fireEvent.click(screen.getByLabelText('Open views'));
    fireEvent.keyDown(screen.getByRole('separator'), { key: 'ArrowRight' });
    expect(screen.getByRole('separator')).toHaveAttribute(
      'aria-valuenow',
      '556',
    );
    fireEvent.click(screen.getByLabelText('Expand panel'));
    first.unmount();

    const second = render(tree());
    setObservedWidth(1400);
    await screen.findByLabelText('Restore panel');
    expect(screen.getByLabelText('Draft message')).not.toBeVisible();
    fireEvent.click(screen.getByLabelText('Restore panel'));
    expect(screen.getByRole('separator')).toHaveAttribute(
      'aria-valuenow',
      '556',
    );

    mocks.stream.assistantId = 'agent-2';
    second.rerender(tree());
    await waitFor(() =>
      expect(screen.getByLabelText('Open views')).toBeEnabled(),
    );
    expect(screen.queryByRole('separator')).not.toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Open views'));
    fireEvent.keyDown(screen.getByRole('separator'), { key: 'End' });
    expect(screen.getByRole('separator')).toHaveAttribute(
      'aria-valuenow',
      '920',
    );
    mocks.stream.assistantId = 'agent-1';
    second.rerender(tree());
    await waitFor(() =>
      expect(screen.getByRole('separator')).toHaveAttribute(
        'aria-valuenow',
        '556',
      ),
    );
    mocks.stream.threadId = 'another-thread';
    second.rerender(tree());
    expect(screen.getByRole('separator')).toHaveAttribute(
      'aria-valuenow',
      '556',
    );
    fireEvent.click(screen.getByLabelText('Show or hide sidebar'));
    second.unmount();
    render(tree());
    setObservedWidth(1200);
    await waitFor(() =>
      expect(screen.getByLabelText('Open views')).toBeEnabled(),
    );
    expect(screen.queryByRole('separator')).not.toBeInTheDocument();
  });

  it('keeps desktop preferences while narrow drawers use a temporary layout', async () => {
    const key = workbenchLayoutKey('/api/ai', 'organization-1', 'agent-1');
    writeWorkbenchLayout(key, {
      open: true,
      expanded: true,
      chatWidth: 600,
      workbenchSide: 'right',
    });
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
    setObservedWidth(800);
    await waitFor(() =>
      expect(screen.getByLabelText('Open views')).toBeEnabled(),
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Open views'));
    fireEvent.click(screen.getByLabelText('Expand panel'));
    fireEvent.click(screen.getByLabelText('Show or hide sidebar'));
    setObservedWidth(1400);
    await screen.findByLabelText('Restore panel');
    fireEvent.click(screen.getByLabelText('Restore panel'));
    expect(screen.getByRole('separator')).toHaveAttribute(
      'aria-valuenow',
      '600',
    );
    setObservedWidth(1000);
    expect(screen.getByRole('separator')).toHaveAttribute(
      'aria-valuenow',
      '520',
    );
    setObservedWidth(1400);
    expect(screen.getByRole('separator')).toHaveAttribute(
      'aria-valuenow',
      '600',
    );
  });

  it('does not hide chat before saved workbench views become available', async () => {
    const key = workbenchLayoutKey('/api/ai', 'organization-1', 'agent-1');
    writeWorkbenchLayout(key, {
      open: true,
      expanded: true,
      chatWidth: 500,
      workbenchSide: 'right',
    });
    let resolveViews!: (views: XpertExtensionViewManifest[]) => void;
    mocks.listSlotViews.mockReturnValue(
      new Promise<XpertExtensionViewManifest[]>((resolve) => {
        resolveViews = resolve;
      }),
    );
    render(
      <WorkbenchShell
        options={{ ...baseOptions, workbench: { enabled: true } }}
        locale="en-US"
        onRequestContextChange={vi.fn()}
      >
        <WorkbenchToggleButton />
        <input aria-label="Draft message" />
      </WorkbenchShell>,
    );
    setObservedWidth(1200);
    expect(screen.getByLabelText('Draft message')).toBeVisible();
    await act(async () => resolveViews([]));
    expect(screen.getByLabelText('Draft message')).toBeVisible();
    expect(screen.queryByLabelText('Restore panel')).not.toBeInTheDocument();
  });

  it('cancels a resize on lost focus and ignores later pointer movement', async () => {
    vi.stubGlobal(
      'PointerEvent',
      class extends MouseEvent {
        readonly pointerId: number;
        constructor(type: string, init: PointerEventInit = {}) {
          super(type, init);
          this.pointerId = init.pointerId ?? 1;
        }
      },
    );
    mocks.listSlotViews.mockResolvedValue([manifest]);
    const { container } = render(
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
    await screen.findByTestId('remote-view');
    const root = container.querySelector('[data-chatkit-workbench-root]');
    if (!root) throw new Error('Missing root');
    vi.spyOn(root, 'getBoundingClientRect').mockReturnValue(
      new DOMRect(0, 0, 1200, 800),
    );
    fireEvent.pointerDown(screen.getByRole('separator'), {
      button: 0,
      clientX: 540,
      pointerId: 1,
    });
    fireEvent.pointerMove(window, { clientX: 650, pointerId: 1 });
    expect(screen.getByRole('separator')).toHaveAttribute(
      'aria-valuenow',
      '650',
    );
    fireEvent.blur(window);
    expect(screen.getByRole('separator')).toHaveAttribute(
      'aria-valuenow',
      '540',
    );
    fireEvent.pointerMove(window, { clientX: 100, pointerId: 1 });
    expect(screen.getByRole('separator')).toBeInTheDocument();
    vi.unstubAllGlobals();
  });

  it.each(['right', 'left'])(
    'shows the same main chat as the first maximized tab with the workbench on the %s',
    async (side) => {
      mocks.listSlotViews.mockResolvedValue([manifest]);
      let mounts = 0;
      let unmounts = 0;
      function MainChat() {
        const [count, setCount] = React.useState(0);
        React.useEffect(() => {
          mounts += 1;
          return () => {
            unmounts += 1;
          };
        }, []);
        return (
          <>
            <WorkbenchToggleButton />
            <input aria-label="Main chat draft" defaultValue="Keep my draft" />
            <button onClick={() => setCount((value) => value + 1)}>
              Local state {count}
            </button>
            <div role="region" aria-label="Main messages">
              Conversation messages
            </div>
          </>
        );
      }
      render(
        <WorkbenchShell
          options={{ ...baseOptions, workbench: { enabled: true } }}
          locale="en-US"
          onRequestContextChange={vi.fn()}
        >
          <MainChat />
        </WorkbenchShell>,
      );
      setObservedWidth(1200);
      await waitFor(() =>
        expect(screen.getByLabelText('Open views')).toBeEnabled(),
      );
      const draft = screen.getByLabelText('Main chat draft');
      const messages = screen.getByRole('region', { name: 'Main messages' });
      messages.scrollTop = 80;
      fireEvent.change(draft, { target: { value: 'Unsent message' } });
      fireEvent.click(screen.getByRole('button', { name: 'Local state 0' }));
      fireEvent.click(screen.getByLabelText('Open views'));
      const remote = await screen.findByTestId('remote-view');
      if (side === 'left')
        fireEvent.click(screen.getByLabelText('Swap left and right panes'));
      expect(
        screen.queryByRole('tab', { name: 'Chat' }),
      ).not.toBeInTheDocument();
      fireEvent.click(screen.getByLabelText('Expand panel'));
      expect(screen.getAllByRole('tab').map((tab) => tab.textContent)).toEqual([
        'Chat',
        'Documents',
      ]);
      expect(screen.getByRole('tab', { name: 'Documents' })).toHaveAttribute(
        'aria-selected',
        'true',
      );
      expect(draft).not.toBeVisible();
      fireEvent.click(screen.getByRole('tab', { name: 'Chat' }));
      expect(
        within(screen.getByRole('tabpanel', { name: 'Chat' })).getByLabelText(
          'Main chat draft',
        ),
      ).toBe(draft);
      expect(draft).toBeVisible();
      expect(draft).toHaveValue('Unsent message');
      expect(messages.scrollTop).toBe(80);
      expect(
        screen.getByRole('button', { name: 'Local state 1' }),
      ).toBeVisible();
      expect(remote).not.toBeVisible();
      expect(
        screen.queryByLabelText('Close views: Chat'),
      ).not.toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'New tab' }));
      expect(screen.getAllByRole('tab').map((tab) => tab.textContent)).toEqual([
        'Chat',
        'Documents',
        'New tab',
      ]);
      fireEvent.click(screen.getByRole('tab', { name: 'Chat' }));
      fireEvent.click(screen.getByLabelText('Restore panel'));
      expect(
        screen.queryByRole('tab', { name: 'Chat' }),
      ).not.toBeInTheDocument();
      expect(screen.getByRole('tab', { name: 'New tab' })).toHaveAttribute(
        'aria-selected',
        'true',
      );
      expect(screen.getByLabelText('Main chat draft')).toBe(draft);
      expect(draft).toBeVisible();
      expect(draft).toHaveValue('Unsent message');
      expect(screen.getByTestId('remote-view')).toBe(remote);
      expect(mocks.remoteUnmounts).toBe(0);
      expect(mounts).toBe(1);
      expect(unmounts).toBe(0);
      fireEvent.click(screen.getByLabelText('Expand panel'));
      fireEvent.click(screen.getByRole('tab', { name: 'Chat' }));
      fireEvent.click(screen.getByLabelText('Show or hide sidebar'));
      expect(screen.getByLabelText('Main chat draft')).toBe(draft);
      expect(draft).toBeVisible();
      expect(unmounts).toBe(0);
    },
  );

  it('keeps the main chat when the last maximized workbench tab is closed', async () => {
    mocks.listSlotViews.mockResolvedValue([manifest]);
    render(
      <WorkbenchShell
        options={{ ...baseOptions, workbench: { enabled: true } }}
        locale="en-US"
        onRequestContextChange={vi.fn()}
      >
        <WorkbenchToggleButton />
        <input aria-label="Main draft" />
      </WorkbenchShell>,
    );
    setObservedWidth(1200);
    await waitFor(() =>
      expect(screen.getByLabelText('Open views')).toBeEnabled(),
    );
    fireEvent.click(screen.getByLabelText('Open views'));
    fireEvent.click(screen.getByLabelText('Expand panel'));
    fireEvent.click(screen.getByLabelText('Close views: Documents'));
    expect(screen.getAllByRole('tab').map((tab) => tab.textContent)).toEqual([
      'Chat',
    ]);
    expect(screen.getByRole('tab', { name: 'Chat' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.getByLabelText('Main draft')).toBeVisible();
    fireEvent.click(screen.getByLabelText('Restore panel'));
    expect(screen.getByLabelText('Main draft')).toBeVisible();
    expect(screen.queryByRole('tab', { name: 'Chat' })).not.toBeInTheDocument();
  });

  it('moves main chat into the maximized narrow drawer and releases it on restore and breakpoint changes', async () => {
    mocks.listSlotViews.mockResolvedValue([manifest]);
    render(
      <WorkbenchShell
        options={{ ...baseOptions, workbench: { enabled: true } }}
        locale="en-US"
        onRequestContextChange={vi.fn()}
      >
        <WorkbenchToggleButton />
        <input aria-label="Main draft" defaultValue="Keep text" />
      </WorkbenchShell>,
    );
    setObservedWidth(800);
    await waitFor(() =>
      expect(screen.getByLabelText('Open views')).toBeEnabled(),
    );
    const draft = screen.getByLabelText('Main draft');
    fireEvent.click(screen.getByLabelText('Open views'));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(screen.getByLabelText('Expand panel'));
    fireEvent.click(screen.getByRole('tab', { name: 'Chat' }));
    expect(within(dialog).getByLabelText('Main draft')).toBe(draft);
    expect(draft.closest('[aria-hidden="true"]')).toBeNull();
    draft.focus();
    expect(draft).toHaveFocus();
    fireEvent.change(draft, { target: { value: 'Edited in full screen' } });
    fireEvent.click(screen.getByLabelText('Restore panel'));
    expect(
      within(dialog).queryByLabelText('Main draft'),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Documents' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    fireEvent.click(screen.getByLabelText('Expand panel'));
    fireEvent.click(screen.getByRole('tab', { name: 'Chat' }));
    setObservedWidth(1200);
    await waitFor(() =>
      expect(
        screen.queryByRole('dialog', { hidden: true }),
      ).not.toBeInTheDocument(),
    );
    expect(screen.getByLabelText('Main draft')).toBe(draft);
    expect(draft).toHaveValue('Edited in full screen');
    expect(draft.closest('[aria-hidden="true"]')).toBeNull();
    expect(document.body.style.pointerEvents).not.toBe('none');
  });

  it('expands, restores, and hides the workbench from its action buttons', async () => {
    mocks.listSlotViews.mockResolvedValue([manifest]);
    render(
      <WorkbenchShell
        options={{
          ...baseOptions,
          workbench: { enabled: true },
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

    expect(screen.getByLabelText('Expand panel')).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    expect(screen.queryByLabelText('Close views')).not.toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Expand panel'));
    expect(screen.getByLabelText('Restore panel')).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.queryByLabelText('Close views')).not.toBeInTheDocument();
    expect(screen.queryByRole('separator')).not.toBeInTheDocument();
    expect(screen.getByTestId('remote-view')).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Restore panel'));
    expect(screen.getByLabelText('Expand panel')).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    expect(screen.queryByLabelText('Close views')).not.toBeInTheDocument();
    expect(screen.getByRole('separator')).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Expand panel'));
    fireEvent.click(screen.getByLabelText('Show or hide sidebar'));
    expect(screen.queryByTestId('remote-view')).not.toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Open views'));
    expect(await screen.findByTestId('remote-view')).toBeInTheDocument();
    expect(screen.getByLabelText('Expand panel')).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    expect(screen.getByRole('separator')).toBeInTheDocument();
  });

  it('opens an empty state when no compatible views are available', async () => {
    mocks.listSlotViews.mockResolvedValue([]);
    render(
      <WorkbenchShell
        options={{
          ...baseOptions,
          workbench: { enabled: true },
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
    expect(
      await screen.findByText('No compatible views are available.'),
    ).toBeInTheDocument();
  });

  it('maximizes the narrow drawer across the frame, hides chat and restores both without remounting', async () => {
    mocks.listSlotViews.mockResolvedValue([manifest]);
    render(
      <WorkbenchShell
        options={{
          ...baseOptions,
          workbench: { enabled: true },
        }}
        locale="en-US"
        onRequestContextChange={vi.fn()}
      >
        <WorkbenchToggleButton />
        <input aria-label="Draft message" defaultValue="Keep my draft" />
      </WorkbenchShell>,
    );
    setObservedWidth(1200);
    await waitFor(() =>
      expect(screen.getByLabelText('Open views')).toBeEnabled(),
    );
    fireEvent.click(screen.getByLabelText('Open views'));
    expect(await screen.findByRole('separator')).toBeInTheDocument();

    setObservedWidth(800);
    await waitFor(() =>
      expect(screen.queryByTestId('remote-view')).not.toBeInTheDocument(),
    );
    fireEvent.click(screen.getByLabelText('Open views'));
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toBeInTheDocument();
    expect(screen.getByTestId('remote-view')).toBeInTheDocument();
    expect(screen.queryByRole('separator')).not.toBeInTheDocument();
    const draft = screen.getByLabelText('Draft message');
    const remoteView = screen.getByTestId('remote-view');
    expect(draft).toBeVisible();

    fireEvent.click(screen.getByLabelText('Expand panel'));
    expect(dialog).toHaveClass(
      'inset-0',
      'w-full',
      'max-w-none',
      'sm:max-w-none',
    );
    expect(dialog).not.toHaveClass('sm:max-w-sm');
    expect(draft).not.toBeVisible();
    expect(screen.getByTestId('remote-view')).toBe(remoteView);
    expect(screen.getByLabelText('Restore panel')).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    fireEvent.click(screen.getByLabelText('Restore panel'));
    expect(dialog).toHaveClass('w-[min(92vw,720px)]');
    expect(draft).toBeVisible();
    expect(draft).toHaveValue('Keep my draft');
    expect(screen.getByTestId('remote-view')).toBe(remoteView);
    fireEvent.click(screen.getByLabelText('Expand panel'));
    fireEvent.click(screen.getByLabelText('Show or hide sidebar'));
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    );
    expect(draft).toBeVisible();
  });

  it('retains the frame during refresh but clears its context when access is revoked', async () => {
    mocks.listSlotViews.mockResolvedValueOnce([manifest]);
    const onRequestContextChange = vi.fn();
    const shell = (locale: string) => (
      <WorkbenchShell
        options={{ ...baseOptions, workbench: { enabled: true } }}
        locale={locale}
        onRequestContextChange={onRequestContextChange}
      >
        <WorkbenchToggleButton />
      </WorkbenchShell>
    );
    const { rerender } = render(shell('en-US'));
    setObservedWidth(1200);
    await waitFor(() =>
      expect(screen.getByLabelText('Open views')).toBeEnabled(),
    );
    fireEvent.click(screen.getByLabelText('Open views'));
    const frame = await screen.findByTestId('remote-view');
    await act(async () => {
      await mocks.remoteViewProps?.onClientCommand(
        'assistant.context.set',
        {
          key: 'documents',
          context: { collectionId: 'collection-1' },
        },
        manifest,
      );
    });
    const context = { documents: { collectionId: 'collection-1' } };
    expect(onRequestContextChange).toHaveBeenLastCalledWith(context);

    let rejectRefresh: (error: Error) => void = () => {};
    mocks.listSlotViews.mockImplementationOnce(
      () =>
        new Promise((_, reject) => {
          rejectRefresh = reject;
        }),
    );
    rerender(shell('zh-CN'));
    await waitFor(() => expect(mocks.listSlotViews).toHaveBeenCalledTimes(2));
    expect(screen.getByTestId('remote-view')).toBe(frame);
    expect(onRequestContextChange).toHaveBeenLastCalledWith(context);

    await act(async () => {
      rejectRefresh(Object.assign(new Error('Forbidden'), { status: 403 }));
    });
    expect(screen.queryByTestId('remote-view')).not.toBeInTheDocument();
    expect(onRequestContextChange).toHaveBeenLastCalledWith({});
  });

  it('merges view context and sends messages through the active stream', async () => {
    mocks.listSlotViews.mockResolvedValue([manifest]);
    mocks.submit.mockResolvedValue(undefined);
    const onRequestContextChange = vi.fn();
    render(
      <WorkbenchShell
        options={{
          ...baseOptions,
          workbench: { enabled: true },
        }}
        locale="en-US"
        onRequestContextChange={onRequestContextChange}
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

    await act(async () => {
      await mocks.remoteViewProps?.onClientCommand(
        'assistant.context.set',
        {
          key: 'documents',
          env: { region: 'eu', ignored: 42 },
          context: { collectionId: 'collection-1' },
        },
        manifest,
      );
    });
    expect(onRequestContextChange).toHaveBeenLastCalledWith({
      documents: { collectionId: 'collection-1' },
      env: { region: 'eu' },
    });

    mocks.stream.isLoading = true;
    await act(async () => {
      await mocks.remoteViewProps?.onClientCommand(
        'assistant.chat.send_message',
        {
          text: 'Summarize this document',
          clientMessageId: 'client-message-1',
          followUpMode: 'steer',
          state: { reviewer: { enabled: true } },
          attachments: [
            {
              id: 'file-1',
              name: 'report.pdf',
              mime_type: 'application/pdf',
            },
          ],
        },
        manifest,
      );
    });

    expect(mocks.submit).toHaveBeenCalledWith(
      {
        id: 'client-message-1',
        input: {
          input: 'Summarize this document',
          files: [
            expect.objectContaining({
              id: 'file-1',
              originalName: 'report.pdf',
              mimeType: 'application/pdf',
            }),
          ],
        },
        state: expect.objectContaining({
          reviewer: { enabled: true },
        }),
      },
      expect.objectContaining({ followUpMode: 'steer' }),
    );
  });
});
