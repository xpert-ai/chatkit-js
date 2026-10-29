import * as React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  Client,
  HTTPError,
  type XpertExtensionViewManifest,
} from '@xpert-ai/xpert-sdk';
import { ThemeProvider } from '../../providers/Theme';
import { RemoteViewFrame } from './RemoteViewFrame';
import { ProjectViewRecovery } from './ProjectViewRecovery';

vi.mock('../../i18n/useChatkitTranslation', () => {
  const t = (key: string) => key;
  return { useChatkitTranslation: () => ({ t, i18n: { language: 'en' } }) };
});
const projectType = { applicationKey: 'platform', projectTypeKey: 'space' };
const workbench = { projectType, fixed: true };
const manifest: XpertExtensionViewManifest = {
  key: 'spaces',
  title: { en_US: 'Spaces' },
  hostType: 'agent',
  slot: 'agent.workbench.fixed',
  source: { provider: 'spaces.views' },
  workbench,
  view: {
    type: 'remote_component',
    runtime: 'react',
    protocolVersion: 1,
    component: { isolation: 'iframe', entry: 'spaces' },
    dataSource: { mode: 'platform' },
  },
  dataSource: { mode: 'platform' },
  clientCommands: [
    { key: 'workbench.navigation.open', label: { en_US: 'Open' } },
  ],
};
function fixture() {
  const client = new Client({
    apiUrl: 'https://local.example/api/ai',
    apiKey: 'test',
    callerOptions: {
      maxRetries: 0,
      fetch: async (input: RequestInfo | URL) => {
        const body = String(input).includes('/types')
          ? {
              items: [
                {
                  ...projectType,
                  applicationTitle: 'Platform',
                  title: 'Space',
                  available: true,
                  binding: { kind: 'project' },
                },
              ],
            }
          : {
              items: [
                { id: 'available', name: 'Available space', ...projectType },
              ],
              total: 1,
            };
        return new Response(JSON.stringify(body), {
          headers: { 'content-type': 'application/json' },
        });
      },
    },
  });
  vi.spyOn(client.viewHosts, 'getManifest').mockResolvedValue(manifest);
  const entry = vi
    .spyOn(client.viewHosts, 'getRemoteComponentEntry')
    .mockRejectedValue(
      new HTTPError(403, '{"message":"spaces.access_denied"}'),
    );
  return { client, entry };
}
function Frame({ client, projectId }: { client: Client; projectId?: string }) {
  return (
    <RemoteViewFrame
      manifest={manifest}
      hostId="assistant"
      runtimeScope={{ projectId }}
      locale="en-US"
      title="Spaces"
      hostEvent={null}
      viewHosts={client.viewHosts}
      onNotify={vi.fn()}
      onClientCommand={vi.fn()}
      renderProjectRecovery={(denied) => (
        <p>{denied ? 'Recover denied project' : 'Choose project'}</p>
      )}
    />
  );
}
describe('Project View recovery', () => {
  it('removes already loaded content when a data refresh loses project access', async () => {
    const { client, entry } = fixture();
    entry.mockResolvedValue(
      '<html><body>Private project content</body></html>',
    );
    vi.spyOn(client.viewHosts, 'getData').mockRejectedValue(
      new HTTPError(403, 'Revoked'),
    );
    render(<Frame client={client} projectId="available" />, {
      wrapper: ThemeProvider,
    });
    const iframe = await screen.findByTitle<HTMLIFrameElement>('Spaces');
    const post = vi.spyOn(iframe.contentWindow!, 'postMessage');
    fireEvent.load(iframe);
    await waitFor(() => expect(post).toHaveBeenCalled());
    const init = post.mock.calls.find(
      ([message]) => message.type === 'init',
    )?.[0];
    const event = new MessageEvent('message', {
      data: {
        channel: 'xpertai.remote_component',
        protocolVersion: 1,
        type: 'requestData',
        instanceId: init.instanceId,
        scopeRevision: init.scopeRevision,
        requestId: 'refresh',
        query: {},
      },
    });
    Object.defineProperty(event, 'source', { value: iframe.contentWindow });
    window.dispatchEvent(event);
    await screen.findByText('Recover denied project');
    expect(screen.queryByTitle('Spaces')).not.toBeInTheDocument();
  });
  it('replaces a denied entry with recovery and remounts content after the project changes', async () => {
    const { client, entry } = fixture();
    const view = render(<Frame client={client} projectId="general" />, {
      wrapper: ThemeProvider,
    });
    await screen.findByText('Recover denied project');
    expect(screen.queryByText(/HTTP 403/)).not.toBeInTheDocument();
    expect(screen.queryByTitle('Spaces')).not.toBeInTheDocument();
    entry.mockResolvedValue('<html><body>Authorized content</body></html>');
    view.rerender(<Frame client={client} projectId="available" />);
    await screen.findByTitle('Spaces');
    expect(entry).toHaveBeenLastCalledWith(
      'agent',
      'assistant',
      'spaces',
      expect.objectContaining({ runtimeScope: { projectId: 'available' } }),
    );
  });
  it('shows project selection before a project is selected', async () => {
    const { client } = fixture();
    render(<Frame client={client} />, { wrapper: ThemeProvider });
    await waitFor(() =>
      expect(client.viewHosts.getRemoteComponentEntry).toHaveBeenCalled(),
    );
    expect(screen.getByText('Choose project')).toBeInTheDocument();
  });
  it.each([true, false])(
    'selects an available space through the host navigation callback (denied=%s)',
    async (denied) => {
      const { client } = fixture();
      const select = vi.fn().mockResolvedValue({ success: true });
      render(
        <ProjectViewRecovery
          client={client}
          hostId="assistant"
          manifest={manifest}
          denied={denied}
          onSelect={select}
          onRetry={vi.fn()}
        />,
        { wrapper: ThemeProvider },
      );
      fireEvent.click(
        screen.getByRole('button', { name: 'composer.projects.select' }),
      );
      fireEvent.click(
        await screen.findByRole('button', { name: 'Available space' }),
      );
      await waitFor(() => expect(select).toHaveBeenCalledWith('available'));
    },
  );
  it('keeps a readable failure when host navigation rejects the chosen project', async () => {
    const { client } = fixture();
    const select = vi
      .fn()
      .mockResolvedValue({ success: false, code: 'unsaved_changes' });
    render(
      <ProjectViewRecovery
        client={client}
        hostId="assistant"
        manifest={manifest}
        denied
        onSelect={select}
        onRetry={vi.fn()}
      />,
      { wrapper: ThemeProvider },
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'composer.projects.select' }),
    );
    fireEvent.click(
      await screen.findByRole('button', { name: 'Available space' }),
    );
    await screen.findByText('workbench.projectRecovery.switchFailed');
    expect(
      screen.getByRole('button', { name: 'composer.projects.select' }),
    ).toBeEnabled();
  });
});
