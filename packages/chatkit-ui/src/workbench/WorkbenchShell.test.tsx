import * as React from 'react';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ChatKitOptions } from '@xpert-ai/chatkit-types';
import type { XpertExtensionViewManifest } from '@xpert-ai/xpert-sdk';

const mocks = vi.hoisted(() => ({
  listSlotViews: vi.fn(),
  submit: vi.fn(),
  resizeCallback: null as ResizeObserverCallback | null,
  remoteViewProps: null as {
    onClientCommand: (
      commandKey: string,
      payload: unknown,
      manifest: XpertExtensionViewManifest,
    ) => Promise<unknown>;
  } | null,
  stream: {
    client: {
      viewHosts: {
        listSlotViews: vi.fn(),
        getManifest: vi.fn(),
        getData: vi.fn(),
        getRemoteComponentEntry: vi.fn(),
        getParameterOptions: vi.fn(),
        executeAction: vi.fn(),
        executeFileAction: vi.fn(),
        createFileAccessSession: vi.fn(),
        createFileAccessGrant: vi.fn(),
        revokeFileAccessSession: vi.fn(),
      },
    },
    apiKey: 'cs-x-secret',
    apiUrl: '/api/ai',
    authenticatedFetch: vi.fn(),
    assistantId: 'agent-1',
    threadId: 'thread-1',
    isLoading: false,
    submit: vi.fn(),
  },
}));

vi.mock('../providers/Stream', () => ({
  useStreamContext: () => mocks.stream,
}));

vi.mock('../hooks/useParentMessenger', () => ({
  useParentMessenger: () => ({
    isParentAvailable: false,
    sendCommand: vi.fn(),
  }),
}));

vi.mock('./RemoteViewFrame', () => ({
  RemoteViewFrame: (props: {
    title: string;
    onClientCommand: (
      commandKey: string,
      payload: unknown,
      manifest: XpertExtensionViewManifest,
    ) => Promise<unknown>;
  }) => {
    mocks.remoteViewProps = props;
    return <div data-testid="remote-view">{props.title}</div>;
  },
}));

import { WorkbenchShell, WorkbenchToggleButton } from './WorkbenchShell';

const manifest: XpertExtensionViewManifest = {
  key: 'provider__documents',
  title: { en_US: 'Documents', zh_Hans: '文档' },
  hostType: 'agent',
  slot: 'agent.workbench.fixed',
  order: 10,
  source: { provider: 'provider' },
  workbench: { fixed: true, menu: { enabled: true, order: 10 } },
  view: {
    type: 'remote_component',
    runtime: 'react',
    protocolVersion: 1,
    component: {
      isolation: 'iframe',
      entry: 'documents',
    },
    dataSource: { mode: 'platform' },
  },
  dataSource: { mode: 'platform' },
};

const baseOptions = {
  api: {
    apiUrl: '/api/ai',
    xpertId: 'agent-1',
    getClientSecret: async () => 'secret',
  },
} satisfies ChatKitOptions;

class ResizeObserverMock {
  constructor(callback: ResizeObserverCallback) {
    mocks.resizeCallback = callback;
  }
  observe() {}
  disconnect() {}
  unobserve() {}
}

describe('WorkbenchShell', () => {
  beforeEach(() => {
    mocks.listSlotViews.mockReset();
    mocks.submit.mockReset();
    mocks.stream.client.viewHosts.listSlotViews = mocks.listSlotViews;
    mocks.stream.submit = mocks.submit;
    mocks.resizeCallback = null;
    mocks.remoteViewProps = null;
    mocks.stream.isLoading = false;
    mocks.stream.apiKey = 'cs-x-secret';
    vi.stubGlobal('ResizeObserver', ResizeObserverMock);
  });

  it('does not load or render controls when the option is disabled', () => {
    render(
      <WorkbenchShell
        options={baseOptions}
        locale="en-US"
        onRequestContextChange={vi.fn()}
      >
        <WorkbenchToggleButton />
      </WorkbenchShell>,
    );

    expect(mocks.listSlotViews).not.toHaveBeenCalled();
    expect(screen.queryByLabelText('Open views')).not.toBeInTheDocument();
  });

  it('waits for the client secret before preloading views', async () => {
    mocks.stream.apiKey = '';
    mocks.listSlotViews.mockResolvedValue([manifest]);
    const view = render(
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

    expect(mocks.listSlotViews).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Open views')).toBeDisabled();

    mocks.stream.apiKey = 'cs-x-ready';
    view.rerender(
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

    await waitFor(() =>
      expect(mocks.listSlotViews).toHaveBeenCalledWith(
        'agent',
        'agent-1',
        'agent.workbench.fixed',
        expect.objectContaining({ signal: expect.any(AbortSignal) }),
      ),
    );
  });

  it('loads supported views, starts closed, and opens a wide split panel', async () => {
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
      expect(mocks.listSlotViews).toHaveBeenCalledWith(
        'agent',
        'agent-1',
        'agent.workbench.fixed',
        expect.objectContaining({ signal: expect.any(AbortSignal) }),
      ),
    );
    expect(screen.queryByTestId('remote-view')).not.toBeInTheDocument();

    await waitFor(() =>
      expect(screen.getByLabelText('Open views')).toBeEnabled(),
    );
    fireEvent.click(screen.getByLabelText('Open views'));
    expect(await screen.findByTestId('remote-view')).toHaveTextContent(
      'Documents',
    );
    expect(
      screen.queryByRole('heading', { name: 'Views' }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Documents' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.getByRole('separator')).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Close views: Documents'));
    expect(screen.queryByTestId('remote-view')).not.toBeInTheDocument();
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

  it('closes when becoming narrow and reopens in a right-side drawer', async () => {
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

    fireEvent.click(screen.getByLabelText('Expand panel'));
    expect(dialog).toHaveClass('w-screen');
    expect(screen.getByLabelText('Restore panel')).toHaveAttribute(
      'aria-pressed',
      'true',
    );
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

  it('forwards manifest client commands to the configured callback', async () => {
    mocks.listSlotViews.mockResolvedValue([manifest]);
    const onClientCommand = vi.fn().mockResolvedValue({ opened: true });
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
    await screen.findByTestId('remote-view');

    await expect(
      mocks.remoteViewProps?.onClientCommand(
        'workbench.file.open',
        { url: '/file.pdf' },
        manifest,
      ),
    ).resolves.toEqual({ opened: true });
    expect(onClientCommand).toHaveBeenCalledWith({
      commandKey: 'workbench.file.open',
      payload: { url: '/file.pdf' },
      hostType: 'agent',
      hostId: 'agent-1',
      viewKey: manifest.key,
    });
  });
});

function setObservedWidth(width: number) {
  act(() => {
    mocks.resizeCallback?.(
      [
        {
          contentRect: { width },
        } as ResizeObserverEntry,
      ],
      {} as ResizeObserver,
    );
  });
}
