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

describe('Workbench application project creation', () => {
  setupWorkbenchTests();
  it('reopens a cached view as a fresh form only after the old scope is cleared', async () => {
    mocks.listSlotViews.mockResolvedValue([manifest]);
    const onNavigate = vi.fn();
    const props = {
      options: { ...baseOptions, workbench: { enabled: true } },
      locale: 'en-US',
      onRequestContextChange: vi.fn(),
      onNavigate,
    };
    const { rerender } = render(
      <WorkbenchShell {...props}>
        <WorkbenchToggleButton />
      </WorkbenchShell>,
    );
    setObservedWidth(1200);
    await waitFor(() =>
      expect(screen.getByLabelText('Open views')).toBeEnabled(),
    );
    fireEvent.click(screen.getByLabelText('Open views'));
    await waitFor(() => expect(mocks.remoteViewProps).not.toBeNull());
    const entry = {
      kind: 'assistant' as const,
      xpertId: 'agent-1',
      slug: 'agent',
      viewKey: manifest.key,
    };
    const projectCreation = { id: 1, entry };
    rerender(
      <WorkbenchShell {...props} projectCreation={projectCreation}>
        <WorkbenchToggleButton />
      </WorkbenchShell>,
    );
    expect(mocks.remoteUnmounts).toBe(0);
    await act(async () => {
      mocks.stream.projectId = '';
      mocks.stream.conversationId = '';
      mocks.stream.threadId = '';
      rerender(
        <WorkbenchShell {...props} projectCreation={projectCreation}>
          <WorkbenchToggleButton />
        </WorkbenchShell>,
      );
    });
    await waitFor(() => expect(mocks.remoteUnmounts).toBe(1));
    expect(onNavigate).not.toHaveBeenCalled();
    // Another click from an already unbound conversation still resets the form.
    rerender(
      <WorkbenchShell {...props} projectCreation={{ id: 2, entry }}>
        <WorkbenchToggleButton />
      </WorkbenchShell>,
    );
    await waitFor(() => expect(mocks.remoteUnmounts).toBe(2));
  });
});
