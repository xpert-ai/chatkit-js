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
  manifest,
  baseOptions,
  setObservedWidth,
} = fixture;

describe('document tab host commands', () => {
  setupWorkbenchTests();

  it('forwards the registered View key from separate document tabs and retains their identities', async () => {
    const editor = {
      ...manifest,
      key: 'documents__editor',
      title: { en_US: 'Editor' },
      workbench: { ...manifest.workbench, openMode: 'on-demand' as const },
    };
    mocks.listSlotViews.mockResolvedValue([manifest, editor]);
    const onClientCommand = vi.fn().mockResolvedValue({ success: true });
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
    fireEvent.click(await screen.findByRole('tab', { name: 'Documents' }));

    for (const [id, title] of [
      ['cef1b690-fde3-4cc0-982a-e930e6206d8d', 'Document A'],
      ['afd6bf14-028b-41e8-b0e0-9a3b5eaa0476', 'Document B'],
    ]) {
      await act(async () => {
        const remoteView = mocks.remoteViewProps;
        if (!remoteView) throw new Error('Document view is not mounted');
        await remoteView.onClientCommand(
          'workbench.navigation.open',
          {
            target: 'workbench.view',
            viewKey: editor.key,
            selectionId: id,
            parameters: { contentId: id, contentTitle: title },
          },
          manifest,
        );
      });
      expect(await screen.findByRole('tab', { name: title })).toHaveAttribute(
        'aria-selected',
        'true',
      );
      const payload = {
        actionKey: 'group-grant-targets',
        input: { artifactId: id },
      };
      await act(async () => {
        const remoteView = mocks.remoteViewProps;
        if (!remoteView) throw new Error('Document view is not mounted');
        expect(
          await remoteView.onClientCommand(
            'artifact.use-grants.manage',
            payload,
            editor,
          ),
        ).toEqual({ success: true });
      });
      expect(onClientCommand).toHaveBeenLastCalledWith(
        expect.objectContaining({
          commandKey: 'artifact.use-grants.manage',
          hostType: 'agent',
          hostId: 'agent-1',
          viewKey: editor.key,
          payload,
        }),
      );
    }

    expect(screen.getAllByRole('tab', { name: 'Document A' })).toHaveLength(1);
    expect(screen.getAllByRole('tab', { name: 'Document B' })).toHaveLength(1);
    expect(onClientCommand).toHaveBeenCalledTimes(2);
    expect(mocks.remoteUnmounts).toBe(0);
    expect(mocks.stream.reset).not.toHaveBeenCalled();
  });
});
