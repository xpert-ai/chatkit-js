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
  actions: [
    { key: 'approve', label: { en_US: 'Approve' }, actionType: 'invoke' },
  ],
  fileAccess: { purposes: ['preview', 'download'] },
};
const runtimeScope = {
  projectId: 'project-1',
  conversationId: 'conversation-1',
};

function createViewHosts() {
  return {
    getManifest: vi.fn().mockResolvedValue(manifest),
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
}

function frame(viewHosts: RemoteViewHostsClient, listedManifest = manifest) {
  return (
    <ThemeProvider>
      <RemoteViewFrame
        manifest={listedManifest}
        hostId="agent-1"
        runtimeScope={runtimeScope}
        locale="en-US"
        title="Documents"
        hostEvent={null}
        viewHosts={viewHosts}
        onNotify={vi.fn()}
        onClientCommand={vi.fn()}
      />
    </ThemeProvider>
  );
}

describe('RemoteViewFrame loading identity', () => {
  it('keeps an initialized frame interactive when equal listings are recreated', async () => {
    const viewHosts = createViewHosts();
    const { rerender } = render(frame(viewHosts));
    const iframe = (await screen.findByTitle('Documents')) as HTMLIFrameElement;
    const contentWindow = iframe.contentWindow;
    if (!contentWindow) throw new Error('Expected an iframe window.');
    const post = vi.spyOn(contentWindow, 'postMessage');
    fireEvent.load(iframe);
    post.mockClear();

    for (let index = 0; index < 3; index += 1) {
      const { key, ...rest } = structuredClone(manifest);
      rerender(frame(viewHosts, { ...rest, key }));
      expect(iframe).not.toHaveAttribute('inert');
      await act(async () => {});
    }

    expect(viewHosts.getManifest).toHaveBeenCalledOnce();
    expect(viewHosts.getRemoteComponentEntry).toHaveBeenCalledOnce();
    expect(screen.getByTitle('Documents')).toBe(iframe);
    expect(iframe.contentWindow).toBe(contentWindow);
    expect(post).not.toHaveBeenCalled();
  });

  it('does not cancel or restart a pending load for an equal listing', async () => {
    const viewHosts = createViewHosts();
    let finish: ((value: XpertExtensionViewManifest) => void) | undefined;
    viewHosts.getManifest.mockReturnValueOnce(
      new Promise<XpertExtensionViewManifest>((resolve) => {
        finish = resolve;
      }),
    );
    const { rerender } = render(frame(viewHosts));
    const signal = viewHosts.getManifest.mock.calls[0][3].signal;
    rerender(frame(viewHosts, structuredClone(manifest)));
    await act(async () => {});

    expect(signal.aborted).toBe(false);
    expect(viewHosts.getManifest).toHaveBeenCalledOnce();
    expect(viewHosts.getRemoteComponentEntry).not.toHaveBeenCalled();
    await act(async () => {
      if (!finish) throw new Error('Manifest request has not started.');
      finish(manifest);
    });
    await screen.findByTitle('Documents');
    expect(viewHosts.getRemoteComponentEntry).toHaveBeenCalledOnce();
  });

  it.each<XpertExtensionViewManifest>([
    { ...manifest, actions: [] },
    { ...manifest, fileAccess: { purposes: ['preview'] } },
  ])(
    'revalidates changed permissions and initializes with the server manifest',
    async (changed) => {
      const viewHosts = createViewHosts();
      const { rerender } = render(frame(viewHosts));
      const iframe = (await screen.findByTitle(
        'Documents',
      )) as HTMLIFrameElement;
      const contentWindow = iframe.contentWindow;
      if (!contentWindow) throw new Error('Expected an iframe window.');
      const post = vi.spyOn(contentWindow, 'postMessage');
      fireEvent.load(iframe);
      post.mockClear();

      const current: XpertExtensionViewManifest = { ...changed, actions: [] };
      viewHosts.getManifest.mockResolvedValue(current);
      rerender(frame(viewHosts, changed));
      await waitFor(() =>
        expect(viewHosts.getRemoteComponentEntry).toHaveBeenCalledTimes(2),
      );
      await waitFor(() => expect(iframe).not.toHaveAttribute('inert'));

      expect(viewHosts.getManifest).toHaveBeenCalledTimes(2);
      expect(post).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'init', manifest: current }),
        '*',
      );
      expect(screen.getByTitle('Documents')).toBe(iframe);
    },
  );
});
