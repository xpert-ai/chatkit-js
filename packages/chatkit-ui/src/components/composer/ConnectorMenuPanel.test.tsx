import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Client } from '@xpert-ai/xpert-sdk';
import {
  ConnectorMenuPanel,
  resolveConnectorManagementUrl,
  resolveDirectOAuthMethod,
} from './ConnectorMenuPanel';

vi.mock('../../i18n/useChatkitTranslation', () => ({
  useChatkitTranslation: () => ({
    i18n: { language: 'en-US' },
    t: (key: string) =>
      ({
        'composer.connectors.search': 'Search connectors',
        'composer.connectors.loading': 'Loading connectors...',
        'composer.connectors.empty': 'No matching connectors',
        'composer.connectors.scopeUnavailable':
          'Connector scope is not available',
        'composer.connectors.accessDenied': 'Connector access denied',
        'composer.connectors.personal': 'Personal authorization',
        'composer.connectors.workspaceShared': 'Workspace authorization',
        'composer.connectors.shared': 'Team authorization',
        'composer.connectors.select': 'Select',
        'composer.connectors.selected': 'Selected',
        'composer.connectors.unavailable': 'Unavailable',
        'composer.connectors.connect': 'Connect',
        'composer.connectors.connecting': 'Connecting',
        'composer.connectors.manage': 'Manage connectors',
        'composer.connectors.loadError': 'Failed to load connectors',
        'composer.connectors.connectError': 'Connection failed',
        'composer.connectors.popupBlocked': 'Popup blocked',
      })[key] ?? key,
  }),
}));

function createClient() {
  return {
    connectors: {
      runtimeOptions: vi.fn().mockResolvedValue({
        scope: { type: 'workspace', workspaceId: 'workspace-1' },
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
            status: 'pending',
            granted: false,
            label: 'OAuth connector',
            authMethods: [
              { id: 'oauth-default', type: 'oauth2', label: 'OAuth' },
            ],
          },
        ],
      }),
      connect: vi.fn(),
      authorizationStatus: vi.fn(),
      consent: vi.fn(),
    },
  } as unknown as Client;
}

describe('ConnectorMenuPanel', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('classifies only credential-free single-method OAuth as direct', () => {
    expect(
      resolveDirectOAuthMethod({
        provider: 'oauth',
        label: 'OAuth',
        authMethods: [{ id: 'oauth', type: 'oauth2', label: 'OAuth' }],
      }),
    ).toEqual({ authMethodId: 'oauth' });
    expect(
      resolveDirectOAuthMethod({
        provider: 'key',
        label: 'Key',
        authMethods: [
          {
            id: 'key',
            type: 'api_key',
            label: 'Key',
            credentials: { fields: [{ name: 'key', label: 'Key' }] },
          },
        ],
      }),
    ).toBeNull();
  });

  it('derives management pages from the typed Connector scope', () => {
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

  it('loads runtime options for the current Xpert and Project and selects bindings', async () => {
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
    );

    expect(await screen.findByText('Shared connector')).toBeInTheDocument();
    expect(client.connectors.runtimeOptions).toHaveBeenCalledWith('xpert-1', {
      projectId: 'project-1',
      signal: expect.any(AbortSignal),
    });
    fireEvent.click(screen.getByRole('button', { name: /Shared connector/ }));
    expect(onSelectionChange).toHaveBeenCalledWith(['shared-1']);
  });

  it('uses the compact Connector panel spacing', async () => {
    render(<ConnectorMenuPanel client={createClient()} xpertId="xpert-1" />);

    await screen.findByText('Shared connector');
    expect(screen.getByPlaceholderText('Search connectors')).toHaveClass('h-8');
    expect(
      document.querySelector('[data-slot="composer-connector-list"]'),
    ).toHaveClass('pb-2');
    expect(
      document.querySelector('[data-slot="composer-connector-list"]'),
    ).not.toHaveClass('pr-3', 'pb-3');
    expect(
      screen.getByRole('button', { name: 'Manage connectors' }),
    ).toHaveClass('h-10');
  });

  it('clears Project connectors while switching back to the Xpert Workspace', async () => {
    const client = createClient();
    vi.mocked(client.connectors.runtimeOptions)
      .mockResolvedValueOnce({
        scope: { type: 'project', projectId: 'project-1' },
        items: [
          {
            bindingId: 'project-shared',
            provider: 'project-shared',
            authorizationMode: 'shared',
            status: 'active',
            granted: true,
            label: 'Project connector',
          },
        ],
      })
      .mockImplementationOnce(() => new Promise(() => undefined));

    const { rerender } = render(
      <ConnectorMenuPanel
        client={client}
        xpertId="xpert-1"
        projectId="project-1"
      />,
    );
    expect(await screen.findByText('Project connector')).toBeInTheDocument();
    expect(screen.getByText('Team authorization')).toBeInTheDocument();

    rerender(<ConnectorMenuPanel client={client} xpertId="xpert-1" />);

    await waitFor(() => {
      expect(screen.queryByText('Project connector')).not.toBeInTheDocument();
    });
    expect(client.connectors.runtimeOptions).toHaveBeenLastCalledWith(
      'xpert-1',
      {
        projectId: undefined,
        signal: expect.any(AbortSignal),
      },
    );
  });

  it('labels shared credentials according to their returned scope', async () => {
    const client = createClient();

    render(<ConnectorMenuPanel client={client} xpertId="xpert-1" />);

    expect(await screen.findByText('Shared connector')).toBeInTheDocument();
    expect(screen.getByText('Workspace authorization')).toBeInTheDocument();
    expect(screen.queryByText('Team authorization')).not.toBeInTheDocument();
  });

  it('reuses a personal account only after explicit consent', async () => {
    const client = createClient();
    vi.mocked(client.connectors.runtimeOptions).mockResolvedValue({
      scope: { type: 'project', projectId: 'project-1' },
      items: [
        {
          bindingId: 'personal-1',
          provider: 'drive',
          authorizationMode: 'personal',
          status: 'active',
          granted: false,
          profile: { name: 'Alice' },
          label: 'Personal Drive',
        },
      ],
    });
    vi.mocked(client.connectors.consent).mockResolvedValue({
      id: 'personal-1',
      provider: 'drive',
      scopeType: 'project',
      scope: { type: 'project', projectId: 'project-1' },
      projectId: 'project-1',
      authorizationMode: 'personal',
      status: 'active',
      profile: { name: 'Alice' },
    });
    const onSelectionChange = vi.fn();

    render(
      <ConnectorMenuPanel
        client={client}
        xpertId="xpert-1"
        projectId="project-1"
        onSelectionChange={onSelectionChange}
      />,
    );
    await screen.findByText('Personal Drive');
    fireEvent.click(screen.getByRole('button', { name: /Personal Drive/ }));

    await waitFor(() => {
      expect(client.connectors.consent).toHaveBeenCalledWith('personal-1', {
        xpertId: 'xpert-1',
      });
      expect(onSelectionChange).toHaveBeenCalledWith(['personal-1']);
    });
  });

  it('reserves an OAuth popup and polls the binding until active', async () => {
    const client = createClient();
    let popupClosed = false;
    const popup = {
      get closed() {
        return popupClosed;
      },
      close: vi.fn(() => {
        popupClosed = true;
      }),
      location: { href: '' },
    } as unknown as Window;
    vi.spyOn(window, 'open').mockReturnValue(popup);
    vi.mocked(client.connectors.connect).mockResolvedValue({
      status: 'pending',
      connector: {
        id: 'account-1',
        bindingId: 'oauth-1',
        provider: 'oauth',
        status: 'pending',
      },
      authorizationUrl: 'https://accounts.example.com/oauth',
      pollIntervalSeconds: 1,
    });
    vi.mocked(client.connectors.authorizationStatus).mockResolvedValue({
      connector: {
        id: 'account-1',
        bindingId: 'oauth-1',
        provider: 'oauth',
        status: 'active',
      },
    });
    const onSelectionChange = vi.fn();

    render(
      <ConnectorMenuPanel
        client={client}
        xpertId="xpert-1"
        onSelectionChange={onSelectionChange}
      />,
    );
    await screen.findByText('OAuth connector');
    vi.useFakeTimers();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /OAuth connector/ }));
      await Promise.resolve();
      await vi.advanceTimersByTimeAsync(1000);
    });

    expect(client.connectors.connect).toHaveBeenCalledWith(
      'oauth-1',
      { authMethodId: 'oauth-default', xpertId: 'xpert-1' },
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    expect(client.connectors.authorizationStatus).toHaveBeenCalledWith(
      'oauth-1',
      expect.objectContaining({
        xpertId: 'xpert-1',
        signal: expect.any(AbortSignal),
      }),
    );
    expect(popup.location.href).toBe('https://accounts.example.com/oauth');
    expect(onSelectionChange).toHaveBeenCalledWith(['oauth-1']);
  });

  it('reports connector access denial explicitly', async () => {
    const client = createClient();
    vi.mocked(client.connectors.runtimeOptions).mockRejectedValue(
      Object.assign(new Error('Forbidden'), { status: 403 }),
    );
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    render(<ConnectorMenuPanel client={client} xpertId="xpert-1" />);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Connector access denied',
    );
  });
});
