import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Client } from '@xpert-ai/xpert-sdk';
import { ThemeProvider } from '../../providers/Theme';
import {
  ConnectorMenuPanel,
  resolveConnectorManagementUrl,
} from './ConnectorMenuPanel';

vi.mock('../../i18n/useChatkitTranslation', () => ({
  useChatkitTranslation: () => ({
    i18n: { language: 'en-US' },
    t: (key: string) => key,
  }),
}));
function createClient() {
  const client = new Client({ apiUrl: 'https://example.test/api/ai' });
  vi.spyOn(client.connectors, 'runtimeOptions').mockResolvedValue({
    scope: { type: 'workspace', workspaceId: 'workspace-1' },
    canManageWorkspace: true,
    managementUrl: 'https://example.test/xpert/w/workspace-1/connectors',
    items: [
      {
        bindingId: 'shared-1',
        provider: 'shared',
        authorizationMode: 'shared',
        status: 'active',
        granted: true,
        label: 'Shared connector',
      },
      {
        bindingId: 'oauth-1',
        provider: 'oauth',
        authorizationMode: 'personal',
        status: 'active',
        granted: true,
        label: 'Legacy connector',
      },
      {
        bindingId: 'secret-1',
        provider: 'secret',
        authorizationMode: 'shared',
        status: 'active',
        granted: true,
        label: 'Credential dependency',
        runtimeUsage: 'credential',
      },
    ],
  });
  vi.spyOn(client.connectors, 'connect');
  vi.spyOn(client.connectors, 'consent');
  return client;
}
const wrapper = ThemeProvider;
describe('ConnectorMenuPanel workspace fallback', () => {
  it('derives management pages from the typed scope', () => {
    expect(
      resolveConnectorManagementUrl('https://example.com/api/ai', {
        type: 'workspace',
        workspaceId: 'workspace / one',
      }),
    ).toBe('https://example.com/xpert/w/workspace%20%2F%20one/connectors');
    expect(
      resolveConnectorManagementUrl('https://example.com/api/ai', {
        type: 'project',
        projectId: 'project / one',
      }),
    ).toBe('https://example.com/project/project%20%2F%20one/config');
  });
  it('selects shared capabilities using the existing binding selection contract', async () => {
    const client = createClient();
    const onSelectionChange = vi.fn();
    render(
      <ConnectorMenuPanel
        client={client}
        xpertId="xpert-1"
        projectId="project-1"
        selectedBindingIds={[]}
        onSelectionChange={onSelectionChange}
      />,
      { wrapper },
    );
    fireEvent.click(
      await screen.findByRole('button', { name: /Shared connector/ }),
    );
    expect(client.connectors.runtimeOptions).toHaveBeenCalledWith('xpert-1', {
      projectId: 'project-1',
      includeWorkspace: true,
    });
    expect(onSelectionChange).toHaveBeenCalledWith(['shared-1']);
    expect(screen.queryByText('Credential dependency')).not.toBeInTheDocument();
    expect(
      screen.getByRole('link', {
        name: 'composer.connections.manageWorkspace',
      }),
    ).toHaveAttribute(
      'href',
      'https://example.test/xpert/w/workspace-1/connectors',
    );
  });
  it('clears the previous scope while switching project', async () => {
    const client = createClient();
    const { rerender } = render(
      <ConnectorMenuPanel client={client} xpertId="xpert-1" projectId="one" />,
      { wrapper },
    );
    await screen.findByText('Shared connector');
    vi.mocked(client.connectors.runtimeOptions).mockImplementation(
      () => new Promise(() => undefined),
    );
    rerender(
      <ConnectorMenuPanel client={client} xpertId="xpert-1" projectId="two" />,
    );
    await waitFor(() =>
      expect(screen.queryByText('Shared connector')).not.toBeInTheDocument(),
    );
  });
  it('does not reuse an old personal grant or offer individual OAuth', async () => {
    const client = createClient();
    const onSelectionChange = vi.fn();
    render(
      <ConnectorMenuPanel
        client={client}
        xpertId="xpert-1"
        onSelectionChange={onSelectionChange}
      />,
      { wrapper },
    );
    fireEvent.click(
      await screen.findByRole('button', { name: /Legacy connector/ }),
    );
    expect(
      await screen.findByText('composer.connections.contactAdmin'),
    ).toBeInTheDocument();
    expect(client.connectors.connect).not.toHaveBeenCalled();
    expect(client.connectors.consent).not.toHaveBeenCalled();
    expect(onSelectionChange).not.toHaveBeenCalled();
  });
  it('reports context denial without also claiming the catalog is empty', async () => {
    const client = createClient();
    vi.mocked(client.connectors.runtimeOptions).mockRejectedValue(
      Object.assign(new Error('Forbidden'), { status: 403 }),
    );
    render(<ConnectorMenuPanel client={client} xpertId="xpert-1" />, {
      wrapper,
    });
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'composer.connections.contextDenied',
    );
    expect(
      screen.queryByText('composer.connectors.empty'),
    ).not.toBeInTheDocument();
  });
});
