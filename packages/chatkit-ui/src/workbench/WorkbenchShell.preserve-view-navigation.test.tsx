import type { ChatKitWorkbenchClientCommandRequest } from '@xpert-ai/chatkit-types';
import type {
  XpertExtensionViewManifest,
  XpertViewQuery,
} from '@xpert-ai/xpert-sdk';
import { describe, expect, it } from 'vitest';
import { fixture, setupWorkbenchTests } from './WorkbenchShell.test-fixture';

const {
  act,
  render,
  waitFor,
  screen,
  vi,
  mocks,
  WorkbenchShell,
  manifest,
  baseOptions,
} = fixture;

function navigation(
  query: XpertViewQuery = {},
  preserveView = true,
): ChatKitWorkbenchClientCommandRequest {
  return {
    commandKey: 'workbench.navigation.open',
    hostType: 'agent',
    hostId: 'agent-1',
    viewKey: manifest.key,
    payload: {
      target: 'assistant.conversation',
      conversationId: mocks.stream.conversationId,
      preserveView,
      viewKey: manifest.key,
      ...query,
    },
  };
}

function createShell() {
  const onContext = vi.fn();
  return (initialNavigation?: ChatKitWorkbenchClientCommandRequest) => (
    <WorkbenchShell
      options={{ ...baseOptions, workbench: { enabled: true } }}
      locale="en-US"
      onRequestContextChange={onContext}
      initialNavigation={initialNavigation}
    >
      <span>Chat</span>
    </WorkbenchShell>
  );
}

function pendingViews() {
  let resolve: (views: XpertExtensionViewManifest[]) => void = () => {};
  const promise = new Promise<XpertExtensionViewManifest[]>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

describe('Workbench navigation with preserved View', () => {
  setupWorkbenchTests();

  it('restores the requested query only after destination views are validated', async () => {
    const destination = pendingViews();
    mocks.listSlotViews
      .mockResolvedValueOnce([manifest])
      .mockReturnValueOnce(destination.promise);
    const shell = createShell();
    const source = navigation({ selectionId: 'document-1' });
    const { rerender } = render(shell(source));
    await waitFor(() =>
      expect(mocks.remoteViewProps?.initialQuery).toEqual({
        selectionId: 'document-1',
      }),
    );
    const frame = screen.getByTestId('remote-view');

    mocks.stream.conversationId = 'conversation-2';
    const query: XpertViewQuery = {
      selectionId: 'document-2',
      parameters: { section: 'overview' },
      search: 'report',
    };
    rerender(shell(navigation(query)));
    await waitFor(() => expect(mocks.listSlotViews).toHaveBeenCalledTimes(2));
    expect(mocks.listSlotViews).toHaveBeenLastCalledWith(
      'agent',
      'agent-1',
      'agent.workbench.fixed',
      expect.objectContaining({
        runtimeScope: {
          projectId: 'project-1',
          conversationId: 'conversation-2',
        },
      }),
    );
    expect(mocks.remoteViewProps?.initialQuery?.selectionId).not.toBe(
      'document-2',
    );

    await act(async () => destination.resolve([manifest]));
    await waitFor(() =>
      expect(mocks.remoteViewProps).toMatchObject({
        runtimeScope: {
          projectId: 'project-1',
          conversationId: 'conversation-2',
        },
        initialQuery: query,
      }),
    );
    expect(screen.getByTestId('remote-view')).toBe(frame);
    expect(mocks.remoteUnmounts).toBe(0);
    expect(screen.getByRole('tab', { name: 'Documents' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
  });

  it.each([true, false])(
    'applies an explicit query in the current scope (preserveView=%s)',
    async (preserveView) => {
      mocks.listSlotViews.mockResolvedValue([manifest]);
      const shell = createShell();
      const { rerender } = render(
        shell(navigation({ selectionId: 'document-1' }, false)),
      );
      await waitFor(() =>
        expect(mocks.remoteViewProps?.initialQuery).toEqual({
          selectionId: 'document-1',
        }),
      );

      const query = {
        selectionId: 'document-2',
        parameters: { section: 'details' },
      };
      rerender(shell(navigation(query, preserveView)));
      await waitFor(() =>
        expect(mocks.remoteViewProps?.initialQuery).toEqual(query),
      );
      expect(screen.getByRole('tab', { name: 'Documents' })).toHaveAttribute(
        'aria-selected',
        'true',
      );
    },
  );

  it('preserves the current query when the same-scope request supplies none', async () => {
    mocks.listSlotViews.mockResolvedValue([manifest]);
    const shell = createShell();
    const query = {
      selectionId: 'document-1',
      parameters: { section: 'details' },
    };
    const { rerender } = render(shell(navigation(query, false)));
    await waitFor(() =>
      expect(mocks.remoteViewProps?.initialQuery).toEqual(query),
    );

    rerender(shell(navigation()));
    expect(mocks.remoteViewProps?.initialQuery).toEqual(query);
  });

  it('does not carry an old query into another conversation without an explicit query', async () => {
    const destination = pendingViews();
    mocks.listSlotViews
      .mockResolvedValueOnce([manifest])
      .mockReturnValueOnce(destination.promise);
    const shell = createShell();
    const { rerender } = render(
      shell(navigation({ selectionId: 'document-1' }, false)),
    );
    await waitFor(() =>
      expect(mocks.remoteViewProps?.initialQuery).toEqual({
        selectionId: 'document-1',
      }),
    );

    mocks.stream.conversationId = 'conversation-2';
    rerender(shell(navigation()));
    await act(async () => destination.resolve([manifest]));
    await waitFor(() =>
      expect(mocks.remoteViewProps).toMatchObject({
        runtimeScope: { conversationId: 'conversation-2' },
      }),
    );
    expect(mocks.remoteViewProps?.initialQuery?.selectionId).toBeUndefined();
  });

  it('does not reopen a requested View that is unavailable in the destination scope', async () => {
    const destination = pendingViews();
    mocks.listSlotViews
      .mockResolvedValueOnce([manifest])
      .mockReturnValueOnce(destination.promise);
    const shell = createShell();
    const { rerender } = render(
      shell(navigation({ selectionId: 'document-1' }, false)),
    );
    await waitFor(() =>
      expect(mocks.remoteViewProps?.initialQuery).toEqual({
        selectionId: 'document-1',
      }),
    );

    mocks.stream.conversationId = 'conversation-2';
    rerender(shell(navigation({ selectionId: 'document-2' })));
    await act(async () => destination.resolve([]));
    await waitFor(() =>
      expect(screen.queryByTestId('remote-view')).not.toBeInTheDocument(),
    );
    expect(
      screen.queryByRole('tab', { name: 'Documents' }),
    ).not.toBeInTheDocument();
  });
});
