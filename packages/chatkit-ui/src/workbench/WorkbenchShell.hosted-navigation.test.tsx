import type {
  ChatKitWorkbenchNavigation,
  ChatKitWorkbenchOptions,
} from '@xpert-ai/chatkit-types';
import type { XpertExtensionViewManifest } from '@xpert-ai/xpert-sdk';
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
  manifest,
  baseOptions,
} = fixture;
const view = (id: string, section = 'authoring') => ({
  viewKey: manifest.key,
  selectionId: id,
  parameters: {
    view: 'workflow',
    projectId: id,
    mode: 'score',
    section,
    writingMode: 'directory',
  },
});
const onContext = () => {};
function shell(
  navigation: ChatKitWorkbenchNavigation,
  onNavigationChange = vi.fn(),
  extra: Partial<ChatKitWorkbenchOptions> = {},
) {
  return (
    <WorkbenchShell
      options={{
        ...baseOptions,
        workbench: { enabled: true, navigation, onNavigationChange, ...extra },
      }}
      locale="en-US"
      onRequestContextChange={onContext}
    >
      <span>Conversation</span>
    </WorkbenchShell>
  );
}

describe('host-routed ChatKit Workbench', () => {
  setupWorkbenchTests();

  it('keeps legacy Views out of embedded tabs and delegates their navigation to the authorized outer host', async () => {
    const embedded = manifest;
    const outer: XpertExtensionViewManifest = {
      ...manifest,
      key: 'legacy-plugin',
      title: { en_US: 'Outer plugin' },
      view: { type: 'raw_json' },
    };
    mocks.listSlotViews.mockResolvedValue([embedded, outer]);
    const forward = vi
      .fn()
      .mockResolvedValue({ success: true, status: 'opened' });
    const onChange = vi.fn();
    render(
      shell({ projectId: 'project-1', view: view('bid-a') }, onChange, {
        onClientCommand: forward,
      }),
    );
    await waitFor(() =>
      expect(mocks.remoteViewProps?.initialQuery?.selectionId).toBe('bid-a'),
    );
    expect(screen.queryByRole('tab', { name: 'Outer plugin' })).toBeNull();
    const frame = screen.getByTestId('remote-view');
    const payload = {
      target: 'workbench.view',
      viewKey: outer.key,
      selectionId: 'document',
    };
    let receipt;
    await act(async () => {
      receipt = await mocks.remoteViewProps!.onClientCommand(
        'workbench.navigation.open',
        payload,
        embedded,
      );
    });
    expect(receipt).toMatchObject({ success: true });
    expect(forward).toHaveBeenCalledWith(expect.objectContaining({ payload }));
    expect(screen.getByTestId('remote-view')).toBe(frame);
    expect(mocks.remoteViewProps?.initialQuery?.selectionId).toBe('bid-a');
    expect(onChange).not.toHaveBeenCalled();
    forward.mockResolvedValueOnce({ success: false, code: 'forbidden' });
    await act(async () => {
      receipt = await mocks.remoteViewProps!.onClientCommand(
        'workbench.navigation.open',
        payload,
        embedded,
      );
    });
    expect(receipt).toEqual({ success: false, code: 'forbidden' });
    expect(mocks.remoteViewProps?.initialQuery?.selectionId).toBe('bid-a');
  });

  it('restores the complete View on refresh and applies back/forward without remounting or duplicate history', async () => {
    mocks.listSlotViews.mockResolvedValue([manifest]);
    const onChange = vi.fn();
    const first = { projectId: 'project-1', view: view('bid-a') };
    const { rerender, unmount } = render(shell(first, onChange));
    await waitFor(() =>
      expect(mocks.remoteViewProps?.initialQuery).toMatchObject({
        selectionId: 'bid-a',
        parameters: first.view.parameters,
      }),
    );
    const frame = screen.getByTestId('remote-view');
    const pushes = vi.spyOn(history, 'pushState');
    const next = { ...first, view: view('bid-a', 'review') };
    rerender(shell(next, onChange));
    await waitFor(() =>
      expect(mocks.remoteViewProps?.initialQuery?.parameters).toEqual(
        next.view.parameters,
      ),
    );
    rerender(shell(first, onChange));
    await waitFor(() =>
      expect(mocks.remoteViewProps?.initialQuery?.parameters).toEqual(
        first.view.parameters,
      ),
    );
    expect(screen.getByTestId('remote-view')).toBe(frame);
    expect(mocks.remoteUnmounts).toBe(0);
    expect(onChange).not.toHaveBeenCalled();
    expect(pushes).not.toHaveBeenCalled();
    unmount();
    render(shell(next, onChange));
    await waitFor(() =>
      expect(mocks.remoteViewProps?.initialQuery?.parameters).toEqual(
        next.view.parameters,
      ),
    );
    expect(onChange).not.toHaveBeenCalled();
  });

  it('reports a local View selection once, then accepts its host echo without resetting it', async () => {
    mocks.listSlotViews.mockResolvedValue([manifest]);
    const onChange = vi.fn();
    const { rerender } = render(
      shell({ projectId: 'project-1', view: view('bid-a') }, onChange),
    );
    await waitFor(() =>
      expect(mocks.remoteViewProps?.initialQuery?.selectionId).toBe('bid-a'),
    );
    const target = view('bid-a', 'review');
    await act(async () => {
      await mocks.remoteViewProps?.onClientCommand?.(
        'workbench.navigation.open',
        { target: 'workbench.view', ...target },
        manifest,
      );
    });
    await waitFor(() =>
      expect(onChange).toHaveBeenCalledWith({
        projectId: 'project-1',
        view: target,
      }),
    );
    expect(onChange).toHaveBeenCalledTimes(1);
    rerender(shell({ projectId: 'project-1', view: target }, onChange));
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('waits for the destination runtime and its authorized manifests before restoring a different Project', async () => {
    mocks.listSlotViews.mockResolvedValue([manifest]);
    const onChange = vi.fn();
    const { rerender } = render(
      shell({ projectId: 'project-1', view: view('bid-a') }, onChange),
    );
    await waitFor(() =>
      expect(mocks.remoteViewProps?.initialQuery?.selectionId).toBe('bid-a'),
    );
    const next = { projectId: 'project-2', view: view('bid-b') };
    rerender(shell(next, onChange));
    expect(mocks.remoteViewProps?.initialQuery?.selectionId).toBe('bid-a');
    let resolve!: (value: (typeof manifest)[]) => void;
    mocks.listSlotViews.mockImplementationOnce(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
    mocks.stream.projectId = 'project-2';
    rerender(shell(next, onChange));
    await waitFor(() => expect(mocks.listSlotViews).toHaveBeenCalledTimes(2));
    expect(mocks.remoteViewProps?.initialQuery?.selectionId).not.toBe('bid-b');
    await act(async () => resolve([manifest]));
    await waitFor(() =>
      expect(mocks.remoteViewProps).toMatchObject({
        runtimeScope: { projectId: 'project-2' },
        initialQuery: { selectionId: 'bid-b' },
      }),
    );
    expect(onChange).not.toHaveBeenCalled();
  });

  it('keeps native browser tabs open without overwriting the routed Project View', async () => {
    mocks.listSlotViews.mockResolvedValue([manifest]);
    const onChange = vi.fn();
    const { rerender } = render(
      shell({ projectId: 'project-1', view: view('bid-a') }, onChange),
    );
    await waitFor(() =>
      expect(mocks.remoteViewProps?.initialQuery?.selectionId).toBe('bid-a'),
    );
    await act(async () => {
      await mocks.remoteViewProps!.onClientCommand(
        'workbench.browser.open',
        {
          deploymentUrl: 'https://preview.example/evidence',
          title: 'Evidence',
        },
        manifest,
      );
    });
    expect(screen.getByRole('tab', { name: 'Evidence' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(onChange).not.toHaveBeenCalled();
    rerender(shell({ projectId: 'project-1', view: null }, onChange));
    expect(screen.getByRole('tab', { name: 'Evidence' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(onChange).not.toHaveBeenCalled();
  });

  it('restores a unique legacy View alias to its canonical manifest key', async () => {
    mocks.listSlotViews.mockResolvedValue([manifest]);
    const onChange = vi.fn();
    render(
      shell(
        {
          projectId: 'project-1',
          view: { ...view('bid-a'), viewKey: 'documents' },
        },
        onChange,
      ),
    );
    await waitFor(() =>
      expect(mocks.remoteViewProps?.initialQuery?.selectionId).toBe('bid-a'),
    );
    expect(screen.getByRole('tab', { name: 'Documents' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(onChange).not.toHaveBeenCalled();
  });

  it.each([false, true])(
    'accepts only the requested destination when a host reply follows a scope change (other org: %s)',
    async (otherOrg) => {
      mocks.listSlotViews.mockResolvedValue([manifest]);
      let finish!: (result: unknown) => void;
      const onClientCommand = vi.fn(
        () =>
          new Promise<unknown>((resolve) => {
            finish = resolve;
          }),
      );
      const onNavigate = vi.fn();
      const renderShell = () => (
        <WorkbenchShell
          options={{
            ...baseOptions,
            workbench: {
              enabled: true,
              onClientCommand,
              navigation: {
                projectId: mocks.stream.projectId ?? null,
                view: view('bid-a'),
              },
            },
          }}
          locale="en-US"
          onRequestContextChange={onContext}
          onNavigate={onNavigate}
        >
          <span>Chat</span>
        </WorkbenchShell>
      );
      const { rerender } = render(renderShell());
      await waitFor(() =>
        expect(mocks.remoteViewProps?.initialQuery?.selectionId).toBe('bid-a'),
      );
      let result!: Promise<unknown>;
      act(() => {
        result = mocks.remoteViewProps!.onClientCommand(
          'workbench.navigation.open',
          {
            target: 'assistant.project',
            projectId: 'project-2',
            ...view('bid-b'),
          },
          manifest,
        );
      });
      await waitFor(() => expect(onClientCommand).toHaveBeenCalledTimes(1));
      mocks.stream.projectId = 'project-2';
      if (otherOrg) mocks.stream.organizationId = 'different-organization';
      rerender(renderShell());
      await act(async () => finish({ success: true, status: 'opened' }));
      expect(await result).toMatchObject(
        otherOrg
          ? { success: false, code: 'stale_context' }
          : { success: true, status: 'opened' },
      );
      expect(onNavigate).not.toHaveBeenCalled();
    },
  );

  it('does not mount a requested View absent from the authorized manifest', async () => {
    mocks.listSlotViews.mockResolvedValue([]);
    const onChange = vi.fn();
    render(shell({ projectId: 'project-1', view: view('denied') }, onChange));
    await waitFor(() => expect(mocks.listSlotViews).toHaveBeenCalledTimes(1));
    expect(screen.queryByTestId('remote-view')).toBeNull();
    expect(onChange).not.toHaveBeenCalled();
  });
});
