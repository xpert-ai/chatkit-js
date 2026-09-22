import { ThemeProvider } from '../../providers/Theme';
import * as React from 'react';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  Client,
  type RuntimeResourceCatalogItem,
  type ConnectorRuntimeOption,
  type RuntimeResourcesSelection,
} from '@xpert-ai/xpert-sdk';
import { RuntimeResourceSelector } from './RuntimeResourceSelector';

vi.mock('../../i18n/useChatkitTranslation', () => ({
  useChatkitTranslation: () => ({ t: (key: string) => key }),
}));
let compact = false;
beforeEach(() => {
  compact = false;
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({
      matches: compact,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
  HTMLElement.prototype.scrollIntoView = vi.fn();
});
const plugin: RuntimeResourceCatalogItem = {
  bindingId: 'plugin',
  version: 'v1',
  kind: 'agent_plugin',
  title: 'Example plugin',
  status: 'partial',
  components: [{ key: 'hello', kind: 'skill', status: 'ready' }],
  diagnostics: [
    {
      component: 'stdio',
      code: 'unsupported',
      message: 'Unsupported transport',
    },
  ],
};
const other = { ...plugin, bindingId: 'other', title: 'Available plugin' };
const middleware = {
  ...plugin,
  bindingId: 'middleware',
  title: 'Retry middleware',
  kind: 'middleware' as const,
  status: 'ready' as const,
  views: [
    {
      key: 'retry__activity',
      title: 'Retry activity',
      description: 'Inspect retry runs.',
      requiredFeatures: ['retry'],
    },
  ],
};
const expert = {
  ...plugin,
  bindingId: 'expert',
  title: 'Published expert',
  kind: 'external_xpert' as const,
  status: 'ready' as const,
};
function setup(
  selected: RuntimeResourceCatalogItem[] = [plugin],
  items = [plugin, other, middleware, expert],
  radius: 'soft' | 'sharp' = 'soft',
  connectorOptions?: ConnectorRuntimeOption[],
) {
  const client = new Client<unknown>({ apiUrl: 'https://example.test/api/ai' });
  vi.spyOn(client.assistants, 'authorizeResource').mockResolvedValue({
    type: 'connector',
    status: 'requires_auth',
    connector: {
      bindingId: 'binding',
      provider: 'remote',
      scope: { type: 'workspace', workspaceId: 'workspace' },
      canManage: true,
    },
  });
  const catalog = vi
    .spyOn(client.assistants, 'getResources')
    .mockImplementation(async (_id, options) => {
      const filtered = items.filter(
        (item) =>
          (!options?.kind || item.kind === options.kind) &&
          (!options?.search || item.title.includes(options.search)),
      );
      return { items: filtered, total: filtered.length };
    });
  const connections = vi
    .spyOn(client.connectors, 'runtimeOptions')
    .mockResolvedValue({
      scope: { type: 'workspace', workspaceId: 'workspace' },
      items: connectorOptions ?? [],
      canManageWorkspace: false,
    });
  const connectorChange = vi.fn();
  const toggle = vi.fn();
  function Harness() {
    const [connectorIds, setConnectorIds] = React.useState<string[]>([]);
    const [selection, setSelection] = React.useState<RuntimeResourcesSelection>(
      { revision: 1, resources: selected },
    );
    return (
      <RuntimeResourceSelector
        client={client}
        assistantId="assistant"
        connectorsEnabled={!!connectorOptions}
        connectorBindingIds={connectorIds}
        onConnectorsChange={async (ids) => {
          connectorChange(ids);
          setConnectorIds(ids);
        }}
        selection={selection}
        busy={false}
        error={null}
        onToggle={async (item) => {
          toggle(item);
          setSelection((current) => ({
            ...current,
            resources: current.resources.some(
              (value) => value.bindingId === item.bindingId,
            )
              ? current.resources.filter(
                  (value) => value.bindingId !== item.bindingId,
                )
              : [...current.resources, item],
          }));
        }}
      />
    );
  }
  render(
    <ThemeProvider theme={{ radius }}>
      <Harness />
    </ThemeProvider>,
  );
  fireEvent.keyDown(
    screen.getByRole('button', { name: /composer.resources.title/ }),
    { key: 'ArrowDown' },
  );
  return { catalog, toggle, connections, connectorChange, client };
}
async function openCategory(label: string) {
  const target = screen.getByRole('menuitem', { name: label });
  if (compact) fireEvent.click(target);
  else {
    act(() => target.focus());
    fireEvent.keyDown(target, { key: 'ArrowRight' });
  }
}
describe('hierarchical resource picker', () => {
  it('keeps retry reachable after a conversation read fails while blocking resource changes', async () => {
    const client = new Client<unknown>({
      apiUrl: 'https://example.test/api/ai',
    });
    vi.spyOn(client.assistants, 'getResources').mockResolvedValue({
      items: [plugin],
      total: 1,
    });
    const refresh = vi.fn();
    const toggle = vi.fn();
    render(
      <ThemeProvider>
        <RuntimeResourceSelector
          client={client}
          assistantId="assistant"
          selection={{ revision: 0, resources: [] }}
          busy={false}
          canEditResources={false}
          error="temporary 503"
          onToggle={toggle}
          onRefresh={refresh}
        />
      </ThemeProvider>,
    );
    const trigger = screen.getByRole('button', {
      name: /composer.resources.title/,
    });
    expect(trigger).not.toBeDisabled();
    fireEvent.keyDown(trigger, { key: 'ArrowDown' });
    expect(await screen.findByRole('alert')).toHaveTextContent('temporary 503');
    fireEvent.click(
      screen.getByRole('button', { name: 'composer.resources.refresh' }),
    );
    expect(refresh).toHaveBeenCalledOnce();
    await openCategory('composer.resources.connectPlugins');
    const row = await screen.findByRole('menuitemcheckbox', {
      name: /Example plugin/,
    });
    expect(row).toHaveAttribute('data-disabled');
    fireEvent.click(row);
    expect(toggle).not.toHaveBeenCalled();
  });
  it('shows connected plugins in the main menu and adds a whole plugin from Connect plugins', async () => {
    const { toggle, catalog } = setup();
    expect(
      await screen.findByRole('menuitemcheckbox', { name: /Example plugin/ }),
    ).toHaveAttribute('aria-checked', 'true');
    expect(
      screen.queryByRole('menuitemcheckbox', { name: /Available plugin/ }),
    ).not.toBeInTheDocument();
    await openCategory('composer.resources.connectPlugins');
    fireEvent.click(
      await screen.findByRole('menuitemcheckbox', { name: /Available plugin/ }),
    );
    expect(toggle).toHaveBeenCalledWith(
      expect.objectContaining({ bindingId: 'other', version: 'v1' }),
    );
    await waitFor(() =>
      expect(catalog).toHaveBeenCalledWith(
        'assistant',
        expect.objectContaining({ kind: 'agent_plugin' }),
      ),
    );
    expect(
      screen.getByRole('button', { name: /composer.resources.title 2/ }),
    ).toBeInTheDocument();
  });
  it('combines executable Connectors and plugins without exposing credential-only dependencies', async () => {
    const native: ConnectorRuntimeOption = {
      bindingId: 'drive',
      provider: 'drive',
      label: 'Workspace Drive',
      status: 'active',
      authorizationMode: 'shared',
      granted: true,
    };
    const { connections, connectorChange, toggle } = setup(
      [plugin],
      [plugin, other],
      'soft',
      [
        native,
        {
          ...native,
          bindingId: 'credential',
          label: 'Hidden credential',
          runtimeUsage: 'credential',
        },
      ],
    );
    await openCategory('composer.resources.connectPlugins');
    fireEvent.click(
      await screen.findByRole('menuitemcheckbox', { name: /Workspace Drive/ }),
    );
    await waitFor(() =>
      expect(connectorChange).toHaveBeenCalledWith(['drive']),
    );
    expect(toggle).not.toHaveBeenCalled();
    expect(screen.queryByText('Hidden credential')).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /composer.resources.title 2/ }),
    ).toBeInTheDocument();
    fireEvent.keyDown(
      screen
        .getAllByRole('menuitemcheckbox', { name: /Workspace Drive/ })
        .slice(-1)[0],
      { key: 'ArrowLeft' },
    );
    await openCategory('composer.resources.middleware');
    expect(connections).toHaveBeenCalledTimes(1);
    expect(
      screen.queryByRole('link', {
        name: 'composer.connections.manageWorkspace',
      }),
    ).not.toBeInTheDocument();
  });
  it('keeps the manager configuration metadata when opening a native connection requirement', async () => {
    const { connectorChange } = setup([], [], 'soft', [
      {
        bindingId: 'drive',
        provider: 'drive',
        label: 'Workspace Drive',
        status: 'disconnected',
        authorizationMode: 'shared',
        granted: false,
        canManage: true,
        managementUrl: 'https://example.test/xpert/w/workspace/connectors',
      },
    ]);
    await openCategory('composer.resources.connectPlugins');
    fireEvent.click(
      await screen.findByRole('menuitemcheckbox', { name: /Workspace Drive/ }),
    );
    expect(
      await screen.findByRole('button', {
        name: 'composer.resources.connect',
      }),
    ).toBeInTheDocument();
    expect(connectorChange).not.toHaveBeenCalled();
  });
  it('keeps middleware and experts in separate second-level menus', async () => {
    const { toggle } = setup();
    await openCategory('composer.resources.middleware');
    fireEvent.click(
      await screen.findByRole('menuitemcheckbox', { name: /Retry middleware/ }),
    );
    expect(toggle).toHaveBeenCalledWith(
      expect.objectContaining({ bindingId: 'middleware' }),
    );
    fireEvent.keyDown(
      screen
        .getAllByRole('menuitemcheckbox', { name: /Retry middleware/ })
        .slice(-1)[0],
      { key: 'ArrowLeft' },
    );
    await openCategory('composer.resources.external_xpert');
    expect(
      await screen.findByRole('menuitemcheckbox', { name: /Published expert/ }),
    ).toBeInTheDocument();
    expect(
      within(
        screen.getByRole('menu', { name: 'composer.resources.external_xpert' }),
      ).queryByRole('menuitemcheckbox', { name: /Retry middleware/ }),
    ).not.toBeInTheDocument();
    expect(
      within(
        screen.getByRole('group', {
          name: 'composer.resources.selectedResources',
        }),
      ).getByRole('menuitemcheckbox', { name: /Retry middleware/ }),
    ).toHaveAttribute('aria-checked', 'true');
  });
  it('opens searchable Browse all without plugin detail controls', async () => {
    const { catalog } = setup();
    await openCategory('composer.resources.connectPlugins');
    fireEvent.click(
      await screen.findByRole('menuitem', {
        name: 'composer.resources.browsePlugins',
      }),
    );
    const dialog = screen.getByRole('dialog');
    fireEvent.change(within(dialog).getByRole('textbox'), {
      target: { value: 'Available' },
    });
    await waitFor(() =>
      expect(catalog).toHaveBeenLastCalledWith(
        'assistant',
        expect.objectContaining({ search: 'Available' }),
      ),
    );
    expect(
      await within(dialog).findByRole('button', { name: /Available plugin/ }),
    ).toBeInTheDocument();
    expect(
      within(dialog).queryByRole('button', {
        name: 'composer.resources.details: Available plugin',
      }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText('stdio: Unsupported transport'),
    ).not.toBeInTheDocument();
  });
  it('keeps plugin authorization reachable from the item without an info or details entry', async () => {
    const pending: RuntimeResourceCatalogItem = {
      ...other,
      status: 'requires_auth',
      components: [{ key: 'remote', kind: 'mcp', status: 'requires_auth' }],
    };
    const { toggle } = setup([], [pending]);
    await openCategory('composer.resources.connectPlugins');
    fireEvent.click(
      await screen.findByRole('menuitemcheckbox', { name: /Available plugin/ }),
    );
    const dialog = screen.getByRole('dialog');
    expect(
      await within(dialog).findByRole('button', {
        name: 'composer.resources.connect',
      }),
    ).toBeInTheDocument();
    expect(
      within(dialog).queryByText('stdio: Unsupported transport'),
    ).not.toBeInTheDocument();
    expect(toggle).not.toHaveBeenCalled();
  });
  it('keeps unavailable selected plugins removable and unavailable new ones disabled', async () => {
    const invalid = { ...plugin, status: 'unavailable' as const };
    const { toggle } = setup(
      [invalid],
      [invalid, { ...other, status: 'configuration_required' }],
    );
    const button = await screen.findByRole('menuitemcheckbox', {
      name: /Example plugin/,
    });
    expect(button).not.toHaveAttribute('data-disabled');
    fireEvent.click(button);
    expect(toggle).toHaveBeenCalledWith(
      expect.objectContaining({ bindingId: 'plugin' }),
    );
    await openCategory('composer.resources.connectPlugins');
    expect(
      await screen.findByRole('menuitemcheckbox', { name: /Available plugin/ }),
    ).toHaveAttribute('data-disabled');
  });
  it('uses a second-level page with Back on narrow screens', async () => {
    compact = true;
    setup();
    await openCategory('composer.resources.middleware');
    expect(
      await screen.findByRole('menuitemcheckbox', { name: /Retry middleware/ }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole('menu')).toHaveLength(1);
    fireEvent.click(
      screen.getByRole('menuitem', { name: 'composer.resources.middleware' }),
    );
    expect(
      screen.getByRole('menuitem', {
        name: 'composer.resources.connectPlugins',
      }),
    ).toBeInTheDocument();
  });
  it('applies the host sharp radius to both levels of the menu', async () => {
    setup([plugin], [plugin, other], 'sharp');
    expect(
      await screen.findByRole('menuitemcheckbox', { name: /Example plugin/ }),
    ).toHaveClass('rounded-none');
    expect(
      screen.getByRole('menu', { name: /composer.resources.title/ }),
    ).toHaveClass('rounded-none');
    await openCategory('composer.resources.connectPlugins');
    expect(
      await screen.findByRole('menu', {
        name: 'composer.resources.connectPlugins',
      }),
    ).toHaveClass('rounded-none');
    expect(
      screen.getByRole('textbox', { name: 'composer.resources.search' }),
    ).toHaveClass('rounded-none');
  });
  it('shows available direct resources without Browse all, and exposes the information card', async () => {
    setup([], [middleware, { ...expert, status: 'unavailable' }]);
    await openCategory('composer.resources.middleware');
    const item = await screen.findByRole('menuitemcheckbox', {
      name: 'Retry middleware',
    });
    expect(item.querySelector('.lucide-plus')).toBeNull();
    expect(
      screen.queryByRole('menuitem', { name: 'composer.resources.browse' }),
    ).not.toBeInTheDocument();
    const info = screen.getByRole('menuitem', {
      name: 'composer.resources.details: Retry middleware',
    });
    expect(info).not.toHaveClass('opacity-0');
    fireEvent.focus(info);
    const card = await screen.findByRole('region', {
      name: 'composer.resources.details: Retry middleware',
    });
    expect(
      within(card).getByText('stdio: Unsupported transport'),
    ).toBeInTheDocument();
    expect(within(card).getByText('Retry activity')).toBeInTheDocument();
    expect(within(card).getByText('Inspect retry runs.')).toBeInTheDocument();
    fireEvent.blur(info);
    fireEvent.keyDown(item, { key: 'ArrowLeft' });
    await openCategory('composer.resources.external_xpert');
    await waitFor(() =>
      expect(
        screen.queryByRole('img', { name: 'composer.resources.loading' }),
      ).not.toBeInTheDocument(),
    );
    expect(
      screen.queryByRole('menuitemcheckbox', { name: 'Published expert' }),
    ).not.toBeInTheDocument();
  });
});
