import { describe, expect, it } from 'vitest';
import { ContentClient } from '@xpert-ai/xpert-sdk';
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

describe('ChatKit-owned document navigation', () => {
  setupWorkbenchTests();
  it('resolves an editor and opens it with provider parameters without invoking the embedding host', async () => {
    const editor = {
      ...manifest,
      key: 'markdown.editor',
      title: { en_US: 'Markdown' },
    };
    mocks.listSlotViews.mockResolvedValue([manifest, editor]);
    const content = new ContentClient({ json: vi.fn() });
    vi.spyOn(content, 'resolve').mockResolvedValue({
      viewKey: editor.key,
      parameters: { contentProvider: 'files' },
    });
    Object.assign(mocks.stream.client, { content });
    const onClientCommand = vi.fn();
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
    await waitFor(() => expect(mocks.remoteViewProps).not.toBeNull());
    let result: unknown;
    await act(async () => {
      result = await mocks.remoteViewProps!.onClientCommand(
        'workbench.content.resolve',
        {
          resourceId: 'cef1b690-fde3-4cc0-982a-e930e6206d8d',
          providerKey: 'files',
        },
        manifest,
      );
    });
    expect(result).toMatchObject({ success: true });
    if (!result || typeof result !== 'object' || !('navigation' in result))
      throw new Error('Missing navigation');
    const navigation = result.navigation;
    await act(async () => {
      await mocks.remoteViewProps!.onClientCommand(
        'workbench.navigation.open',
        navigation,
        manifest,
      );
    });
    expect(
      await screen.findByRole('tab', { name: 'Markdown' }),
    ).toHaveAttribute('aria-selected', 'true');
    expect(onClientCommand).not.toHaveBeenCalled();
    expect(
      JSON.parse(
        screen
          .getAllByTestId('remote-view')
          .find((node) => node.textContent === 'Markdown')!
          .getAttribute('data-query')!,
      ),
    ).toMatchObject({
      selectionId: 'cef1b690-fde3-4cc0-982a-e930e6206d8d',
      parameters: { contentProvider: 'files' },
    });
  });
});
