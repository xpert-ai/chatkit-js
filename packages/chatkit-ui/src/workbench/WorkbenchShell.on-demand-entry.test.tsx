import { describe, expect, it } from 'vitest';
import { fixture, setupWorkbenchTests } from './WorkbenchShell.test-fixture';

const {
  act,
  render,
  screen,
  waitFor,
  vi,
  mocks,
  WorkbenchShell,
  workbenchLayoutKey,
  writeWorkbenchLayout,
  manifest,
  baseOptions,
  setObservedWidth,
} = fixture;

const onDemand = {
  ...manifest,
  workbench: { ...manifest.workbench, openMode: 'on-demand' as const },
};
const onContext = () => {};

function restoreMaximizedLayout() {
  writeWorkbenchLayout(
    workbenchLayoutKey('/api/ai', 'organization-1', 'agent-1'),
    { open: true, expanded: true, chatWidth: null, workbenchSide: 'right' },
  );
}

describe('on-demand Workbench entry', () => {
  setupWorkbenchTests();

  it('selects Chat when restoring a maximized workspace with available but unopened views', async () => {
    mocks.listSlotViews.mockResolvedValue([onDemand]);
    restoreMaximizedLayout();
    render(
      <WorkbenchShell
        options={{ ...baseOptions, workbench: { enabled: true } }}
        locale="en-US"
        onRequestContextChange={onContext}
      >
        <p>Conversation history</p>
      </WorkbenchShell>,
    );
    setObservedWidth(1200);
    await waitFor(() =>
      expect(screen.getByRole('tab', { name: 'Chat' })).toHaveAttribute(
        'aria-selected',
        'true',
      ),
    );
    expect(screen.queryByText('No compatible views are available.')).toBeNull();
    expect(screen.getByText('Conversation history')).toBeVisible();
    expect(screen.queryByTestId('remote-view')).toBeNull();
  });

  it('restores an explicitly routed on-demand view after its manifests arrive', async () => {
    let finish!: (views: (typeof onDemand)[]) => void;
    mocks.listSlotViews.mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    restoreMaximizedLayout();
    const onChange = vi.fn();
    render(
      <WorkbenchShell
        options={{
          ...baseOptions,
          workbench: {
            enabled: true,
            navigation: {
              projectId: 'project-1',
              view: { viewKey: onDemand.key },
            },
            onNavigationChange: onChange,
          },
        }}
        locale="en-US"
        onRequestContextChange={onContext}
      >
        <p>Conversation history</p>
      </WorkbenchShell>,
    );
    setObservedWidth(1200);
    await waitFor(() => expect(mocks.listSlotViews).toHaveBeenCalled());
    await act(async () => finish([onDemand]));
    await waitFor(() =>
      expect(screen.getByRole('tab', { name: 'Documents' })).toHaveAttribute(
        'aria-selected',
        'true',
      ),
    );
    expect(screen.getByTestId('remote-view')).toBeVisible();
    expect(onChange).not.toHaveBeenCalled();
  });
});
