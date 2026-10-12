import type {
  XpertExtensionViewManifest,
  XpertViewQuery,
} from '@xpert-ai/xpert-sdk';
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
  manifest,
  baseOptions,
  setObservedWidth,
} = fixture;
const selection = {
  selectionId: 'source-record',
  parameters: { tab: 'detail' },
};
const conversationView: XpertExtensionViewManifest = {
  ...manifest,
  workbench: { ...manifest.workbench, ...{ contextScope: 'conversation' } },
};

function PanelToggle() {
  const workbench = useWorkbench();
  return <button onClick={workbench.toggle}>Toggle test panel</button>;
}

function shell() {
  return render(
    <WorkbenchShell
      options={{ ...baseOptions, workbench: { enabled: true } }}
      locale="en-US"
      onRequestContextChange={vi.fn()}
    >
      <WorkbenchToggleButton />
      <PanelToggle />
    </WorkbenchShell>,
  );
}

async function selectRecord(
  view = manifest,
  query: XpertViewQuery = selection,
) {
  mocks.listSlotViews.mockResolvedValue([view]);
  const first = shell();
  setObservedWidth(1200);
  await waitFor(() =>
    expect(screen.getByLabelText('Open views')).toBeEnabled(),
  );
  fireEvent.click(screen.getByLabelText('Open views'));
  await waitFor(() => expect(mocks.remoteViewProps).not.toBeNull());
  await act(async () => {
    const remoteView = mocks.remoteViewProps;
    if (!remoteView) throw new Error('Remote view was not mounted');
    expect(
      await remoteView.onClientCommand(
        'workbench.navigation.open',
        {
          target: 'workbench.view',
          viewKey: view.key,
          ...query,
        },
        view,
      ),
    ).toMatchObject({ success: true });
  });
  return first;
}

async function remount(first: ReturnType<typeof shell>) {
  first.unmount();
  mocks.remoteViewProps = null;
  const next = shell();
  setObservedWidth(1200);
  await waitFor(() => expect(mocks.listSlotViews).toHaveBeenCalledTimes(2));
  await act(async () => {});
  return next;
}

describe('plugin navigation persistence', () => {
  setupWorkbenchTests();

  it.each([manifest, conversationView])(
    'restores a selection in its original context ($key)',
    async (view) => {
      const first = await selectRecord(view);
      await remount(first);
      await waitFor(() =>
        expect(mocks.remoteViewProps?.initialQuery).toEqual(selection),
      );
      expect(mocks.stream.reset).not.toHaveBeenCalled();
    },
  );

  it.each(['project', 'conversation'])(
    'does not replay a selection after remounting another %s',
    async (boundary) => {
      const first = await selectRecord(
        boundary === 'conversation' ? conversationView : manifest,
      );
      if (boundary === 'project') mocks.stream.projectId = 'project-2';
      else {
        mocks.stream.conversationId = 'conversation-2';
        mocks.stream.threadId = 'thread-2';
      }
      await remount(first);
      await waitFor(() => expect(mocks.remoteViewProps).not.toBeNull());
      expect(mocks.remoteViewProps?.initialQuery?.selectionId).toBeUndefined();
    },
  );

  it('retains an Assistant-scoped selection across conversations in the same project', async () => {
    const first = await selectRecord();
    mocks.stream.conversationId = 'conversation-2';
    mocks.stream.threadId = 'thread-2';
    await remount(first);
    await waitFor(() =>
      expect(mocks.remoteViewProps?.initialQuery).toEqual(selection),
    );
  });

  it.each(['tab', 'panel'])(
    'does not reopen an explicitly closed %s after remount',
    async (target) => {
      const first = await selectRecord();
      fireEvent.click(
        screen.getByRole('button', {
          name:
            target === 'tab' ? 'Close views: Documents' : 'Toggle test panel',
        }),
      );
      await waitFor(() =>
        expect(screen.queryByRole('tab', { name: 'Documents' })).toBeNull(),
      );
      await remount(first);
      expect(screen.queryByRole('tab', { name: 'Documents' })).toBeNull();
    },
  );

  it('forgets a closed plugin even when another tab keeps the panel open', async () => {
    const first = await selectRecord({
      ...manifest,
      workbench: { ...manifest.workbench, openMode: 'on-demand' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'New tab' }));
    fireEvent.click(screen.getByRole('tab', { name: 'Documents' }));
    fireEvent.click(
      screen.getByRole('button', { name: 'Close views: Documents' }),
    );
    await remount(first);
    expect(screen.queryByRole('tab', { name: 'Documents' })).toBeNull();
  });

  it.each([
    {},
    { selectionId: 'only-id' },
    { parameters: { tab: 'list' } },
    selection,
  ])(
    'restores back/forward entries with optional query fields %j',
    async (query) => {
      await selectRecord(manifest, query);
      const forward = structuredClone(history.state);
      const back = {
        ...forward,
        xpertResourceCardV2: { ...forward.xpertResourceCardV2, target: null },
      };
      act(() =>
        window.dispatchEvent(new PopStateEvent('popstate', { state: back })),
      );
      expect(screen.queryByRole('tab', { name: 'Documents' })).toBeNull();
      act(() =>
        window.dispatchEvent(new PopStateEvent('popstate', { state: forward })),
      );
      expect(
        screen.getByRole('tab', { name: 'Documents' }),
      ).toBeInTheDocument();
      expect(mocks.remoteViewProps?.initialQuery).toMatchObject(query);
    },
  );
});
