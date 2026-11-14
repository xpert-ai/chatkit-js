import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { XpertExtensionViewManifest } from '@xpert-ai/xpert-sdk';
import { ThemeProvider } from '../../providers/Theme';
import { REMOTE_COMPONENT_CHANNEL } from '../protocol';
import { RemoteViewFrame, type RemoteViewHostsClient } from './RemoteViewFrame';

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
  fileAccess: { purposes: ['preview', 'download'] },
  actions: [
    { key: 'approve', label: { en_US: 'Approve' }, actionType: 'invoke' },
  ],
};

async function setup(localDrafts = false) {
  const selectedManifest = localDrafts ? { ...manifest, clientCommands: [{ key: 'workbench.content.draft' }] } : manifest;
  const viewHosts = {
    getLocalDraftBinding: vi.fn(),
    getManifest: vi.fn().mockResolvedValue(selectedManifest),
    getRemoteComponentEntry: vi
      .fn()
      .mockResolvedValue('<html><body>View</body></html>'),
    getData: vi.fn(),
    getParameterOptions: vi.fn(),
    executeAction: vi.fn(),
    executeFileAction: vi.fn(),
    createFileAccessSession: vi.fn(),
    createFileAccessGrant: vi.fn(),
    readFileAccess: vi.fn(),
    revokeFileAccessSession: vi.fn().mockResolvedValue(undefined),
  } satisfies RemoteViewHostsClient;
  const onNotify = vi.fn();
  const { unmount } = render(
    <ThemeProvider>
      <RemoteViewFrame
        manifest={selectedManifest}
        hostId="agent-1"
        locale="en-US"
        title="Documents"
        hostEvent={null}
        viewHosts={viewHosts}
        onNotify={onNotify}
        onClientCommand={vi.fn()}
      />
    </ThemeProvider>,
  );
  const iframe = (await screen.findByTitle('Documents')) as HTMLIFrameElement;
  const contentWindow = iframe.contentWindow;
  if (!contentWindow) throw new Error('Expected an iframe window.');
  const post = vi.spyOn(contentWindow, 'postMessage');
  fireEvent.load(iframe);
  const instanceId = post.mock.calls.at(-1)?.[0].instanceId;
  const scopeRevision = post.mock.calls.at(-1)?.[0].scopeRevision;
  expect(instanceId).toEqual(expect.any(String));
  post.mockClear();
  const send = (message: object) =>
    act(() => {
      const event = new MessageEvent('message', {
        data: {
          channel: REMOTE_COMPONENT_CHANNEL,
          protocolVersion: 1,
          instanceId,
          scopeRevision,
          ...message,
        },
      });
      Object.defineProperty(event, 'source', { value: contentWindow });
      window.dispatchEvent(event);
    });
  return { viewHosts, onNotify, post, send, unmount };
}

describe('RemoteViewFrame request errors', () => {
  it('requires a declared draft command and a current iframe scope before authorization', async () => {
    const f = await setup();
    f.send({ type: 'invokeClientCommand', requestId: 'draft-1', commandKey: 'workbench.content.draft',
      payload: { operation: 'list', resourceId: 'resource' } });
    await waitFor(() => expect(f.post).toHaveBeenCalledWith(expect.objectContaining({ type: 'error', requestId: 'draft-1' }), '*'));
    expect(f.viewHosts.getLocalDraftBinding).not.toHaveBeenCalled();
    f.unmount();
    const current = await setup(true);
    current.send({ type: 'invokeClientCommand', requestId: 'draft-2', commandKey: 'workbench.content.draft', scopeRevision: -1,
      payload: { operation: 'list', resourceId: 'resource' } });
    await act(async () => undefined);
    expect(current.viewHosts.getLocalDraftBinding).not.toHaveBeenCalled();
  });

  it('uses the SDK binding endpoint and discards late draft access after disposal', async () => {
    const f = await setup(true);
    let resolve: (value: { resourceId: string; scopeKey: string; maxBytes: number }) => void = () => {};
    f.viewHosts.getLocalDraftBinding.mockImplementation(() => new Promise(done => { resolve = done; }));
    f.send({ type: 'invokeClientCommand', requestId: 'draft', commandKey: 'workbench.content.draft',
      payload: { operation: 'list', resourceId: 'resource' } });
    await waitFor(() => expect(f.viewHosts.getLocalDraftBinding).toHaveBeenCalledWith('agent', 'agent-1', manifest.key, 'resource',
      expect.objectContaining({ signal: expect.any(AbortSignal) })));
    f.unmount();
    await act(async () => resolve({ resourceId: 'resource', scopeKey: 'a'.repeat(64), maxBytes: 1024 }));
    expect(f.post.mock.calls.some(([message]) => message.type === 'clientCommandResult')).toBe(false);
  });

  it('returns a transient lookup error to its caller without a banner and allows a retry', async () => {
    const f = await setup();
    const message =
      'HTTP 404: {"statusCode":404,"message":"capture_not_found"}';
    f.viewHosts.getData
      .mockRejectedValueOnce(new Error(message))
      .mockResolvedValueOnce({ items: [{ id: 'meeting-1' }] });
    f.send({ type: 'requestData', requestId: 'lookup-1', query: {} });
    await waitFor(() =>
      expect(f.post).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'error',
          requestId: 'lookup-1',
          message,
        }),
        '*',
      ),
    );
    expect(f.onNotify).not.toHaveBeenCalled();

    f.send({ type: 'requestData', requestId: 'lookup-2', query: {} });
    await waitFor(() =>
      expect(f.post).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'data',
          requestId: 'lookup-2',
          data: { items: [{ id: 'meeting-1' }] },
        }),
        '*',
      ),
    );
    expect(f.viewHosts.getData).toHaveBeenCalledTimes(2);
    expect(f.onNotify).not.toHaveBeenCalled();
  });

  it('bounds and coalesces iframe grant/content reads and cancels the queue on disposal', async () => {
    const f = await setup();
    const expiresAt = '2099-01-01T00:00:00Z';
    f.viewHosts.createFileAccessSession.mockResolvedValue({
      sessionId: 'session',
      expiresAt,
    });
    f.viewHosts.createFileAccessGrant.mockImplementation(
      async (_session: string, request: { fileKey: string }) => ({
        url: `/content/${request.fileKey}`,
        fileName: 'image.png',
        mimeType: 'image/png',
        expiresAt,
      }),
    );
    const active: AbortSignal[] = [];
    f.viewHosts.readFileAccess.mockImplementation(
      (_url: string, options: { signal: AbortSignal }) =>
        new Promise((_resolve, reject) => {
          active.push(options.signal);
          options.signal.addEventListener(
            'abort',
            () => reject(new DOMException('Cancelled', 'AbortError')),
            { once: true },
          );
        }),
    );
    for (let index = 0; index < 20; index++)
      f.send({
        type: 'requestFileAccess',
        requestId: `request-${index}`,
        fileKey: `file-${index % 10}`,
        purpose: 'preview',
      });
    await waitFor(() => expect(active).toHaveLength(4));
    expect(f.viewHosts.createFileAccessSession).toHaveBeenCalledTimes(1);
    expect(f.viewHosts.createFileAccessGrant).toHaveBeenCalledTimes(4);
    f.unmount();
    await waitFor(() =>
      expect(active.every((signal) => signal.aborted)).toBe(true),
    );
    expect(f.viewHosts.createFileAccessGrant).toHaveBeenCalledTimes(4);
    expect(f.viewHosts.revokeFileAccessSession).toHaveBeenCalledWith('session');
  });

  it('returns action failures to the view and displays its explicit error notification once', async () => {
    const f = await setup();
    f.viewHosts.executeAction.mockRejectedValue(new Error('Action failed'));
    f.send({
      type: 'executeAction',
      requestId: 'action-1',
      actionKey: 'approve',
      input: {},
    });
    await waitFor(() =>
      expect(f.post).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'error',
          requestId: 'action-1',
          message: 'Action failed',
        }),
        '*',
      ),
    );
    expect(f.onNotify).not.toHaveBeenCalled();

    f.send({
      type: 'notify',
      level: 'error',
      message: 'Please retry approval.',
    });
    expect(f.onNotify).toHaveBeenCalledExactlyOnceWith(
      'error',
      'Please retry approval.',
    );
  });
});
