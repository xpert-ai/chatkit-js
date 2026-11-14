import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import type {
  XpertExtensionViewManifest,
  XpertRemoteViewHostEventMessage,
} from '@xpert-ai/xpert-sdk';
import { ThemeProvider } from '../../providers/Theme';
import { RemoteViewFrame, type RemoteViewHostsClient } from './RemoteViewFrame';

it('stamps forwarded tool receipts with the initialized project scope revision', async () => {
  const manifest: XpertExtensionViewManifest = {
    key: 'provider__documents',
    title: { en_US: 'Documents' },
    hostType: 'agent',
    slot: 'agent.workbench.fixed',
    source: { provider: 'provider' },
    view: {
      type: 'remote_component',
      runtime: 'react',
      protocolVersion: 1,
      component: { isolation: 'iframe', entry: 'documents' },
      dataSource: { mode: 'platform' },
    },
    dataSource: { mode: 'platform' },
    hostEvents: {
      subscriptions: [
        {
          key: 'saved',
          event: 'assistant.tool.completed',
          filter: { toolNames: ['save_document'] },
          action: { type: 'forward' },
        },
      ],
    },
  };
  const viewHosts: RemoteViewHostsClient = {
    getLocalDraftBinding: vi.fn(),
    getManifest: vi.fn().mockResolvedValue(manifest),
    getRemoteComponentEntry: vi
      .fn()
      .mockResolvedValue('<main>Documents</main>'),
    getData: vi.fn(),
    getParameterOptions: vi.fn(),
    executeAction: vi.fn(),
    executeFileAction: vi.fn(),
    createFileAccessSession: vi.fn(),
    createFileAccessGrant: vi.fn(),
    readFileAccess: vi.fn(),
    revokeFileAccessSession: vi.fn().mockResolvedValue(undefined),
  };
  const event: XpertRemoteViewHostEventMessage = {
    id: 'call-1',
    type: 'assistant.tool.completed',
    source: 'chatkit',
    receivedAt: new Date().toISOString(),
    toolName: 'save_document',
    data: { output: { id: 'document-1', revision: 2 } },
  };
  const frame = (hostEvent: XpertRemoteViewHostEventMessage | null) => (
    <ThemeProvider>
      <RemoteViewFrame
        manifest={manifest}
        hostId="assistant-1"
        runtimeScope={{
          projectId: 'project-1',
          conversationId: 'conversation-1',
        }}
        locale="en-US"
        title="Documents"
        hostEvent={hostEvent}
        viewHosts={viewHosts}
        onNotify={vi.fn()}
        onClientCommand={vi.fn()}
      />
    </ThemeProvider>
  );
  const { rerender } = render(frame(null));
  const iframe = await screen.findByTitle('Documents');
  if (!(iframe instanceof HTMLIFrameElement) || !iframe.contentWindow)
    throw new Error('Expected frame');
  const post = vi.spyOn(iframe.contentWindow, 'postMessage');
  fireEvent.load(iframe);
  await act(async () => {});
  const init = post.mock.calls.find(
    ([message]) => message.type === 'init',
  )?.[0];
  expect(init).toMatchObject({ scopeRevision: 0 });
  post.mockClear();
  rerender(frame(event));
  await waitFor(() =>
    expect(post).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'hostEvent',
        instanceId: init.instanceId,
        scopeRevision: init.scopeRevision,
        event,
      }),
      '*',
    ),
  );
});
