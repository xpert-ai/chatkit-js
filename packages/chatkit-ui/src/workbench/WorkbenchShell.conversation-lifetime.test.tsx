import type { XpertExtensionViewManifest } from '@xpert-ai/xpert-sdk';
import { describe, expect, it } from 'vitest';
import { fixture, setupWorkbenchTests } from './WorkbenchShell.test-fixture';

const {
  act,
  fireEvent,
  render,
  screen,
  within,
  waitFor,
  vi,
  mocks,
  WorkbenchShell,
  WorkbenchToggleButton,
  workbenchLayoutKey,
  writeWorkbenchLayout,
  setObservedWidth,
  manifest,
  baseOptions,
} = fixture;

function openShell(conversationId: string | null, projectId?: string) {
  mocks.stream.projectId = projectId;
  mocks.stream.conversationId = conversationId;
  mocks.stream.threadId = conversationId ? 'thread-1' : null;
  writeWorkbenchLayout(
    workbenchLayoutKey('/api/ai', 'organization-1', 'agent-1'),
    { open: true, expanded: false, chatWidth: 500, workbenchSide: 'right' },
  );

  const context = vi.fn();
  const tree = () => (
    <WorkbenchShell
      options={{ ...baseOptions, workbench: { enabled: true } }}
      locale="en-US"
      onRequestContextChange={context}
    >
      <WorkbenchToggleButton />
    </WorkbenchShell>
  );
  const result = render(tree());
  setObservedWidth(1200);
  return {
    transition(next: string | null) {
      mocks.stream.conversationId = next;
      mocks.stream.threadId = next ? 'thread-2' : null;
      result.rerender(tree());
    },
  };
}

function pendingViews() {
  let resolve!: (views: XpertExtensionViewManifest[]) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<XpertExtensionViewManifest[]>((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { promise, resolve, reject };
}

describe('Workbench conversation lifetime', () => {
  setupWorkbenchTests();

  it('keeps loading feedback for a manual start-page refresh and retry', async () => {
    mocks.listSlotViews.mockResolvedValue([]);
    openShell(null);
    await screen.findByRole('tab', { name: 'New tab' });
    const tools = screen.getByRole('region', { name: 'Common tools' });
    const refresh = pendingViews();
    mocks.listSlotViews.mockReturnValueOnce(refresh.promise);
    fireEvent.click(screen.getByRole('button', { name: 'Reload' }));
    expect(screen.getByText('Loading views...')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Reload' })).toBeDisabled();
    expect(screen.getByRole('region', { name: 'Common tools' })).toBe(tools);
    await act(async () => refresh.reject(new Error('Temporary failure')));
    expect(screen.getByRole('alert')).toHaveTextContent('Temporary failure');
    expect(screen.queryByText('Loading views...')).not.toBeInTheDocument();
    const retry = pendingViews();
    mocks.listSlotViews.mockReturnValueOnce(retry.promise);
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(screen.getByText('Loading views...')).toBeVisible();
    await act(async () => retry.resolve([]));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.queryByText('Loading views...')).not.toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Common tools' })).toBe(tools);
  });

  it.each([
    [null, 'conversation-created'],
    ['conversation-existing', null],
  ])(
    'silently revalidates start-page recommendations through %s -> %s',
    async (from, to) => {
      const recommended: XpertExtensionViewManifest = {
        ...manifest,
        workbench: { ...manifest.workbench, openMode: 'on-demand' },
      };
      const destination = pendingViews();
      mocks.listSlotViews
        .mockResolvedValueOnce([recommended])
        .mockReturnValueOnce(destination.promise);
      const shell = openShell(from);
      await screen.findByRole('tab', { name: 'New tab' });
      const panel = screen.getByRole('tabpanel');
      const tools = within(panel).getByRole('region', { name: 'Common tools' });
      const recommendation = within(panel).getByRole('button', {
        name: 'Documents',
      });
      const reload = within(panel).getByRole('button', { name: 'Reload' });
      const before = tools.parentElement?.childElementCount;

      shell.transition(to);
      await waitFor(() => expect(mocks.listSlotViews).toHaveBeenCalledTimes(2));
      expect(
        within(panel).queryByText('Loading views...'),
      ).not.toBeInTheDocument();
      expect(reload.querySelector('.animate-spin')).toBeNull();
      expect(tools.parentElement?.childElementCount).toBe(before);
      expect(within(panel).getByRole('button', { name: 'Documents' })).toBe(
        recommendation,
      );
      await act(async () => destination.resolve([recommended]));
      expect(within(panel).getByRole('region', { name: 'Common tools' })).toBe(
        tools,
      );
      expect(within(panel).getByRole('button', { name: 'Documents' })).toBe(
        recommendation,
      );
    },
  );

  it.each([
    [null, 'conversation-created'],
    ['conversation-existing', null],
    ['conversation-existing', 'conversation-other'],
  ])(
    'keeps the start page and its input through %s -> %s',
    async (from, to) => {
      const destination = pendingViews();
      mocks.listSlotViews
        .mockResolvedValueOnce([])
        .mockReturnValueOnce(destination.promise);
      const shell = openShell(from);
      const tab = await screen.findByRole('tab', { name: 'New tab' });
      const input = screen.getByRole('combobox');
      fireEvent.change(input, { target: { value: 'keep my address' } });
      shell.transition(to);
      await waitFor(() => expect(mocks.listSlotViews).toHaveBeenCalledTimes(2));
      expect(screen.getByRole('tab', { name: 'New tab' })).toBe(tab);
      expect(screen.getByRole('combobox')).toBe(input);
      expect(input).toHaveValue('keep my address');
      await act(async () => destination.resolve([]));
      expect(screen.getByRole('combobox')).toBe(input);
    },
  );

  it.each([undefined, 'project-1'])(
    'retains a restored remote panel through creation and reset in %s',
    async (projectId) => {
      mocks.listSlotViews.mockResolvedValue([manifest]);
      const shell = openShell(null, projectId);
      const frame = await screen.findByTestId('remote-view');
      const divider = screen.getByRole('separator');
      for (const conversationId of ['conversation-created', null]) {
        const destination = pendingViews();
        mocks.listSlotViews.mockReturnValueOnce(destination.promise);
        const calls = mocks.listSlotViews.mock.calls.length;
        shell.transition(conversationId);
        await waitFor(() =>
          expect(mocks.listSlotViews).toHaveBeenCalledTimes(calls + 1),
        );
        expect(screen.getByTestId('remote-view')).toBe(frame);
        expect(screen.getByRole('separator')).toBe(divider);
        expect(mocks.remoteViewProps?.contextReady).toBe(false);
        expect(mocks.listSlotViews).toHaveBeenLastCalledWith(
          'agent',
          'agent-1',
          'agent.workbench.fixed',
          expect.objectContaining({
            runtimeScope: { projectId: projectId ?? null, conversationId },
          }),
        );
        await act(async () => destination.resolve([manifest]));
        expect(mocks.remoteViewProps?.contextReady).toBe(true);
        expect(screen.getByTestId('remote-view')).toBe(frame);
        expect(mocks.remoteUnmounts).toBe(0);
      }
    },
  );

  it('retains the website iframe and browsing context through creation and reset', async () => {
    mocks.listSlotViews.mockResolvedValue([]);
    const shell = openShell(null);
    const address = await screen.findByRole('combobox');
    fireEvent.change(address, { target: { value: 'https://example.test/' } });
    fireEvent.submit(screen.getByRole('search'));
    const frame = await waitFor(() => {
      const frame = document.querySelector('iframe');
      expect(frame).not.toBeNull();
      return frame!;
    });
    const browsingContext = frame.contentWindow;
    expect(browsingContext).not.toBeNull();
    for (const conversationId of ['conversation-created', null]) {
      const destination = pendingViews();
      mocks.listSlotViews.mockReturnValueOnce(destination.promise);
      shell.transition(conversationId);
      expect(document.querySelector('iframe')).toBe(frame);
      expect(frame.contentWindow).toBe(browsingContext);
      await act(async () => destination.resolve([]));
      expect(document.querySelector('iframe')).toBe(frame);
      expect(frame.contentWindow).toBe(browsingContext);
    }
  });

  it('retains an Assistant file browser while creating a conversation', async () => {
    mocks.listSlotViews.mockResolvedValue([]);
    const shell = openShell(null);
    await screen.findByRole('tab', { name: 'New tab' });
    fireEvent.click(screen.getByRole('button', { name: 'Files / folders' }));
    const tab = await screen.findByRole('tab', { name: 'Open file' });
    const panel = document.getElementById(`${tab.id}-panel`);
    await waitFor(() =>
      expect(mocks.stream.client.workbench.listFiles).toHaveBeenCalled(),
    );
    const requests = mocks.stream.client.workbench.listFiles.mock.calls.length;
    shell.transition('conversation-created');
    await waitFor(() => expect(mocks.listSlotViews).toHaveBeenCalledTimes(2));
    expect(screen.getByRole('tab', { name: 'Open file' })).toBe(tab);
    expect(document.getElementById(`${tab.id}-panel`)).toBe(panel);
    expect(mocks.stream.client.workbench.listFiles).toHaveBeenCalledTimes(
      requests,
    );
  });

  it('keeps browser navigation but removes conversation file evidence', async () => {
    mocks.listSlotViews.mockResolvedValue([manifest]);
    const shell = openShell('conversation-existing');
    await screen.findByTestId('remote-view');
    await act(async () => {
      await mocks.remoteViewProps?.onClientCommand(
        'workbench.file.open',
        { name: 'Private file', url: 'https://example.org/private.pdf' },
        manifest,
      );
    });
    fireEvent.click(screen.getByRole('button', { name: 'New tab' }));
    const tab = screen.getByRole('tab', { name: 'New tab' });
    expect(
      screen.getByRole('button', { name: /Private file File/ }),
    ).toBeVisible();
    shell.transition(null);
    await waitFor(() => expect(mocks.listSlotViews).toHaveBeenCalledTimes(2));
    expect(screen.getByRole('tab', { name: 'New tab' })).toBe(tab);
    expect(
      screen.queryByRole('button', { name: /Private file File/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('tab', { name: 'Private file' }),
    ).not.toBeInTheDocument();
  });

  it('removes retained views when the new conversation denies access', async () => {
    const destination = pendingViews();
    mocks.listSlotViews
      .mockResolvedValueOnce([manifest])
      .mockReturnValueOnce(destination.promise);
    const shell = openShell(null);
    const frame = await screen.findByTestId('remote-view');
    shell.transition('conversation-created');
    await waitFor(() => expect(mocks.listSlotViews).toHaveBeenCalledTimes(2));
    expect(frame).toBeInTheDocument();
    expect(mocks.remoteViewProps?.contextReady).toBe(false);
    await act(async () =>
      destination.reject(
        Object.assign(new Error('Forbidden'), { status: 403 }),
      ),
    );
    expect(frame).not.toBeInTheDocument();
  });
});
