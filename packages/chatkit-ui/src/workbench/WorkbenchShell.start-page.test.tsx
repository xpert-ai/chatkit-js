import { describe, expect, it } from 'vitest';
import { setupWorkbenchTests, fixture } from './WorkbenchShell.test-fixture';
import type { XpertExtensionViewManifest } from './WorkbenchShell.test-fixture';

const {
  act,
  fireEvent,
  render,
  screen,
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

function renderOpenWorkbench() {
  writeWorkbenchLayout(
    workbenchLayoutKey('/api/ai', 'organization-1', 'agent-1'),
    { open: true, expanded: false, chatWidth: 500, workbenchSide: 'right' },
  );
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
}

describe('Workbench initial start page', () => {
  setupWorkbenchTests();

  it('restores an empty open panel to one usable new tab', async () => {
    mocks.listSlotViews.mockResolvedValue([]);
    renderOpenWorkbench();
    expect(await screen.findByRole('tab', { name: 'New tab' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.getAllByRole('tab')).toHaveLength(1);
    expect(screen.getByRole('combobox')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Files / folders' }));
    expect(await screen.findByRole('tab', { name: 'Open file' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(
      screen.queryByRole('tab', { name: 'New tab' }),
    ).not.toBeInTheDocument();
  });

  it('waits for manifests and keeps the default view selected', async () => {
    let resolveViews!: (views: XpertExtensionViewManifest[]) => void;
    mocks.listSlotViews.mockReturnValue(
      new Promise<XpertExtensionViewManifest[]>((resolve) => {
        resolveViews = resolve;
      }),
    );
    renderOpenWorkbench();
    expect(
      screen.queryByRole('tab', { name: 'New tab' }),
    ).not.toBeInTheDocument();
    await act(async () => resolveViews([manifest]));
    expect(
      await screen.findByRole('tab', { name: 'Documents' }),
    ).toHaveAttribute('aria-selected', 'true');
    expect(
      screen.queryByRole('tab', { name: 'New tab' }),
    ).not.toBeInTheDocument();
  });

  it('shows on-demand views in the start page without opening them automatically', async () => {
    mocks.listSlotViews.mockResolvedValue([
      {
        ...manifest,
        workbench: { openMode: 'on-demand', menu: { enabled: true } },
      },
    ]);
    renderOpenWorkbench();
    await screen.findByRole('tab', { name: 'New tab' });
    expect(
      screen.queryByRole('tab', { name: 'Documents' }),
    ).not.toBeInTheDocument();
    fireEvent.click(
      within(screen.getByRole('region', { name: 'Recommended' })).getByRole(
        'button',
        { name: 'Documents' },
      ),
    );
    expect(
      await screen.findByRole('tab', { name: 'Documents' }),
    ).toHaveAttribute('aria-selected', 'true');
    expect(
      screen.queryByRole('tab', { name: 'New tab' }),
    ).not.toBeInTheDocument();
  });
});
