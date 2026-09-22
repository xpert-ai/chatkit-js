import {
  ConnectionAuthorizationDialog,
  type ConnectionAuthorizationTarget,
} from './ConnectionAuthorizationDialog';
import { useConnectorCatalog } from './useConnectorCatalog';
import { ConnectorResourceRow, connectorUsable } from './ConnectorResourceRow';
import { connectionErrorKey } from './connector-authorization';
import { IconDefinitionRenderer } from '../ui/icon-definition';
import type { ConnectorRuntimeOption } from '@xpert-ai/xpert-sdk';
import { SELECTOR_SEARCH_CLASS } from './selector-styles';
import * as React from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { DropdownMenu as Menu } from 'radix-ui';
import {
  ArrowLeft,
  ArrowUpRight,
  Bot,
  ChevronRight,
  ChevronDown,
  Layers,
  Link,
  Loader2,
  Puzzle,
  RefreshCw,
  X,
} from 'lucide-react';
import type {
  Client,
  RuntimeResourceCatalogItem,
  RuntimeResourceKind,
  RuntimeResourcesSelection,
} from '@xpert-ai/xpert-sdk';
import { useChatkitTranslation } from '../../i18n/useChatkitTranslation';
import { useTheme } from '../../providers/Theme';
import {
  cn,
  getPanelRoundedClass,
  getMenuItemRoundedClass,
} from '../../lib/utils';
import { Input } from '../ui/input';
import { ResourceIcon, RuntimeResourceRow } from './RuntimeResourceRow';
import { ResourceInfoProvider } from './useResourceInfo';
import type { ResourceDisplayItem } from './resource-display';
import type { WorkspaceConnectorConnectHandler } from '@xpert-ai/chatkit-types';
import { resourceDescription } from './resource-description';
import { useRuntimeResourceCatalog } from './useRuntimeResourceCatalog';

const categories = ['agent_plugin', 'middleware', 'external_xpert'] as const;
const categoryIcon = {
  agent_plugin: Link,
  middleware: Layers,
  external_xpert: Bot,
};

function useCompactMenu() {
  const [compact, setCompact] = React.useState(
    () =>
      typeof window !== 'undefined' &&
      window.matchMedia('(max-width: 639px)').matches,
  );
  React.useEffect(() => {
    const media = window.matchMedia('(max-width: 639px)');
    const update = () => setCompact(media.matches);
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  return compact;
}

export function RuntimeResourceSelector({
  client,
  assistantId,
  projectId,
  selection,
  busy,
  canEditResources = true,
  error,
  disabled,
  onToggle,
  onRefresh,
  connectorsEnabled = false,
  connectorBindingIds = [],
  onConnectorsChange,
  onConnect,
}: {
  client: Client<unknown>;
  assistantId: string;
  projectId?: string | null;
  selection: RuntimeResourcesSelection;
  busy: boolean;
  canEditResources?: boolean;
  error: string | null;
  disabled?: boolean;
  onRefresh?: () => void;
  connectorsEnabled?: boolean;
  connectorBindingIds?: string[];
  onConnectorsChange?: (ids: string[]) => Promise<void>;
  onConnect?: WorkspaceConnectorConnectHandler;
  onToggle: (
    item: Pick<RuntimeResourceCatalogItem, 'bindingId' | 'version'>,
  ) => Promise<void>;
}) {
  const { t, i18n } = useChatkitTranslation();
  const { theme } = useTheme();
  const panelClass = cn(
    'z-50 w-80 max-w-[calc(100vw-1rem)] border border-border bg-popover p-1 text-popover-foreground shadow-md outline-none',
    getPanelRoundedClass(theme.radius),
  );
  const itemRounded = getMenuItemRoundedClass(theme.radius);
  const navClass = cn(
    'flex min-h-8 w-full cursor-pointer items-center gap-2 px-2 py-1 text-sm outline-none hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground data-[state=open]:bg-accent data-[state=open]:text-accent-foreground',
    itemRounded,
  );
  const compact = useCompactMenu();
  const [open, setOpen] = React.useState(false);
  const [active, setActive] = React.useState<RuntimeResourceKind | null>(null);
  const [expanded, setExpanded] = React.useState(false);
  const [browseKind, setBrowseKind] =
    React.useState<RuntimeResourceKind>('agent_plugin');
  const [query, setQuery] = React.useState('');
  const [rootQuery, setRootQuery] = React.useState('');
  const [detail, setDetail] = React.useState<ResourceDisplayItem | null>(null);
  const [authorization, setAuthorization] =
    React.useState<ConnectionAuthorizationTarget | null>(null);
  const [connectorBusy, setConnectorBusy] = React.useState(false);
  const connectors = useConnectorCatalog(
    client,
    assistantId,
    projectId,
    connectorsEnabled && (open || expanded || connectorBindingIds.length > 0),
  );
  const latest = React.useRef({
    selection,
    connectorBindingIds,
    onToggle,
    onConnectorsChange,
  });
  latest.current = {
    selection,
    connectorBindingIds,
    onToggle,
    onConnectorsChange,
  };
  const catalog = useRuntimeResourceCatalog({
    client,
    assistantId,
    projectId,
    enabled: open || expanded || selection.resources.length > 0,
    query: active || expanded ? query : rootQuery,
    kind: expanded ? browseKind : (active ?? undefined),
    selectedResources: selection.resources,
  });
  React.useEffect(() => {
    setOpen(false);
    setActive(null);
    setExpanded(false);
    setDetail(null);
    setQuery('');
    setRootQuery('');
    setAuthorization(null);
  }, [assistantId, projectId]);
  const selected = new Set(selection.resources.map((item) => item.bindingId));
  const selectedItems = catalog.selectedItems;
  const selectedResources = selectedItems.filter((item) =>
    item.title.toLocaleLowerCase().includes(rootQuery.toLocaleLowerCase()),
  );
  const categoryTitle = (kind: RuntimeResourceKind) =>
    t(
      `composer.resources.${kind === 'agent_plugin' ? 'connectPlugins' : kind}`,
    );
  const refresh = () => {
    catalog.refresh();
    onRefresh?.();
  };
  const showDetails = (item: ResourceDisplayItem) => {
    setOpen(false);
    setExpanded(false);
    setDetail(item);
  };
  const showBrowse = (kind: RuntimeResourceKind) => {
    setOpen(false);
    setExpanded(true);
    setBrowseKind(kind);
    setQuery('');
  };
  const changeLevel = (kind: RuntimeResourceKind | null) => {
    setActive(kind);
    setQuery('');
  };

  const nativeOptions = (connectors.data?.items ?? []).filter(
    (item) => item.runtimeUsage !== 'credential',
  );
  const selectedConnectors = connectorsEnabled
    ? connectorBindingIds.map(
        (id): ConnectorRuntimeOption =>
          nativeOptions.find((item) => item.bindingId === id) ?? {
            bindingId: id,
            provider: '',
            label: t('composer.connections.unavailable'),
            authorizationMode: 'personal',
            status: 'disconnected',
            granted: false,
          },
      )
    : [];
  const totalSelected = selected.size + selectedConnectors.length;
  const nativeRow = (option: ConnectorRuntimeOption, menu = true) => (
    <ConnectorResourceRow
      key={`connector:${option.bindingId}`}
      option={option}
      selected={connectorBindingIds.includes(option.bindingId)}
      busy={busy || connectorBusy || !canEditResources}
      menu={menu}
      onToggle={(value) => void toggleConnector(value)}
    />
  );
  const changeConnector = async (
    option: ConnectorRuntimeOption,
    remove = false,
  ) => {
    if (!latest.current.onConnectorsChange) return;
    setConnectorBusy(true);
    try {
      const ids = latest.current.connectorBindingIds;
      if (
        !remove &&
        nativeOptions.some(
          (item) =>
            item.bindingId !== option.bindingId &&
            item.provider === option.provider &&
            ids.includes(item.bindingId),
        )
      ) {
        catalog.setLoadError(t('composer.connections.providerConflict'));
        return;
      }
      await latest.current.onConnectorsChange(
        remove
          ? ids.filter((id) => id !== option.bindingId)
          : Array.from(new Set([...ids, option.bindingId])),
      );
    } catch (reason) {
      catalog.setLoadError(t(connectionErrorKey(reason)));
    } finally {
      setConnectorBusy(false);
    }
  };
  const connectNative = (option: ConnectorRuntimeOption, add = true) => {
    if (!connectors.data) return;
    const scope = connectors.data.scope;
    setOpen(false);
    setExpanded(false);
    setAuthorization({
      key: `connector:${option.bindingId}`,
      title:
        resourceDescription(option.label, i18n?.language) || option.provider,
      prepare: async () => ({
        type: 'connector',
        status: 'requires_auth',
        connector: {
          bindingId: option.bindingId,
          provider: option.provider,
          scope: option.scope ?? scope,
          authorizationMode: option.authorizationMode,
          canManage: option.canManage,
          managementUrl: option.managementUrl,
          authMethods: option.authMethods,
        },
      }),
      onAuthorized: async () => {
        connectors.refresh();
        catalog.refresh();
        if (add) await changeConnector(option);
      },
    });
  };
  const toggleConnector = async (option: ConnectorRuntimeOption) => {
    if (connectorBindingIds.includes(option.bindingId))
      await changeConnector(option, true);
    else if (connectorUsable(option)) await changeConnector(option);
    else connectNative(option);
  };
  const authorizationTarget = (
    item: ResourceDisplayItem,
    serverName: string,
  ): ConnectionAuthorizationTarget => ({
    key: `${item.bindingId}:${serverName}`,
    title: item.title,
    prepare: () =>
      client.assistants.authorizeResource(assistantId, {
        bindingId: item.bindingId,
        version: item.version,
        serverName,
        projectId: projectId ?? undefined,
      }),
    onAuthorized: async (signal) => {
      // Recheck the whole package: one connected server must not hide other requirements.
      let offset = 0;
      let total = 0;
      let fresh: RuntimeResourceCatalogItem | undefined;
      do {
        const page = await client.assistants.getResources(assistantId, {
          projectId: projectId ?? undefined,
          kind: 'agent_plugin',
          search: item.title,
          signal,
          offset,
          limit: 100,
        });
        fresh = page.items.find(
          (value) =>
            value.bindingId === item.bindingId &&
            value.version === item.version,
        );
        offset += page.items.length;
        total = page.total;
        if (fresh || !page.items.length) break;
      } while (offset < total);
      if (signal.aborted) return;
      catalog.refresh();
      if (!fresh) throw new Error(t('composer.connections.unavailable'));
      if (
        fresh.components.some(
          (component) => component.status === 'requires_auth',
        )
      ) {
        setDetail(fresh);
        return;
      }
      if (!['ready', 'partial'].includes(fresh.status))
        throw new Error(t('composer.connections.unavailable'));
      if (
        !latest.current.selection.resources.some(
          (value) => value.bindingId === item.bindingId,
        )
      )
        await latest.current.onToggle(fresh);
      setDetail(null);
    },
  });

  const search = (
    value: string,
    update: (value: string) => void,
    placeholder: string,
  ) => (
    <div className="relative shrink-0">
      <Input
        aria-label={placeholder}
        placeholder={placeholder}
        value={value}
        onChange={(event) => update(event.target.value)}
        onKeyDown={(event) => {
          // Keep text editing out of Radix's menu typeahead; Down enters the list.
          if (event.key === 'ArrowDown') {
            event.preventDefault();
            event.currentTarget
              .closest('[role="menu"]')
              ?.querySelector<HTMLElement>(
                '[role^="menuitem"]:not([data-disabled])',
              )
              ?.focus();
          }
          if (event.key !== 'Escape' && event.key !== 'Tab')
            event.stopPropagation();
        }}
        className={cn(SELECTOR_SEARCH_CLASS, itemRounded)}
      />
    </div>
  );
  const selectionUnverified = selectedItems.some(
    (item) => item.status === 'unverified',
  );
  const notice = (error || catalog.loadError || selectionUnverified) && (
    <div className="px-3 py-2 text-xs">
      <p role="alert" className="text-destructive">
        {error || catalog.loadError || t('composer.resources.unverified')}
      </p>
      <button
        type="button"
        onClick={refresh}
        className="mt-1 text-muted-foreground underline"
      >
        {t('composer.resources.refresh')}
      </button>
    </div>
  );
  const row = (item: ResourceDisplayItem, menu = true) => (
    <RuntimeResourceRow
      key={item.bindingId}
      item={item}
      selected={selected.has(item.bindingId)}
      busy={busy || connectorBusy || !canEditResources}
      menu={menu}
      onToggle={(value) => {
        if (
          value.kind === 'agent_plugin' &&
          value.components.some(
            (component) => component.status === 'requires_auth',
          ) &&
          !selected.has(value.bindingId)
        ) {
          showDetails(value);
        } else void onToggle(value);
      }}
      onDetails={showDetails}
    />
  );
  const catalogItems = (
    kind: RuntimeResourceKind,
    connectOnly = false,
    menu = true,
  ) => {
    const visible = catalog.items.filter(
      (item) =>
        item.kind === kind &&
        (!connectOnly || !selected.has(item.bindingId)) &&
        (kind === 'agent_plugin' || ['ready', 'partial'].includes(item.status)),
    );
    return (
      <>
        <div className="max-h-[min(45vh,360px)] overflow-y-auto overscroll-contain">
          {visible.map((item) => row(item, menu))}
          {kind === 'agent_plugin' &&
            connectorsEnabled &&
            nativeOptions
              .filter(
                (option) =>
                  (!connectOnly ||
                    !connectorBindingIds.includes(option.bindingId)) &&
                  `${resourceDescription(option.label, i18n?.language)} ${resourceDescription(option.description, i18n?.language)}`
                    .toLocaleLowerCase()
                    .includes(query.toLocaleLowerCase()),
              )
              .map((option) => nativeRow(option, menu))}
          {kind === 'agent_plugin' &&
            connectorsEnabled &&
            connectors.error != null && (
              <p role="alert" className="px-3 py-2 text-xs text-destructive">
                {t(connectionErrorKey(connectors.error))}
                <button
                  type="button"
                  onClick={connectors.refresh}
                  className="ml-2 underline"
                >
                  {t('composer.resources.refresh')}
                </button>
              </p>
            )}
          {!catalog.loading &&
            !catalog.loadError &&
            !visible.length &&
            !(
              kind === 'agent_plugin' &&
              connectorsEnabled &&
              (nativeOptions.length || connectors.loading || connectors.error)
            ) && (
              <p className="px-3 py-5 text-sm text-muted-foreground">
                {t('composer.resources.empty')}
              </p>
            )}
          {catalog.loading && (
            <Loader2
              aria-label={t('composer.resources.loading')}
              className="mx-auto my-4 size-5 animate-spin text-muted-foreground"
            />
          )}
          {kind === 'agent_plugin' &&
            catalog.items.length < catalog.total &&
            (menu ? (
              <Menu.Item
                disabled={catalog.loading}
                onSelect={(event) => {
                  event.preventDefault();
                  catalog.more();
                }}
                className={navClass}
              >
                {t('composer.resources.more')}
              </Menu.Item>
            ) : (
              <button
                type="button"
                disabled={catalog.loading}
                onClick={catalog.more}
                className={navClass}
              >
                {t('composer.resources.more')}
              </button>
            ))}
        </div>
      </>
    );
  };
  const subContent = (kind: RuntimeResourceKind) => (
    <>
      {search(query, setQuery, t('composer.resources.search'))}
      {notice}
      {catalogItems(kind, kind === 'agent_plugin')}
      {kind === 'agent_plugin' && (
        <>
          <Menu.Separator className="my-1 h-px bg-border" />
          <Menu.Item
            onSelect={() => showBrowse(kind)}
            className={`${navClass} text-muted-foreground`}
          >
            {t('composer.resources.browsePlugins')}
            <ArrowUpRight className="ml-auto size-4" />
          </Menu.Item>
        </>
      )}
    </>
  );

  return (
    <ResourceInfoProvider
      scope={`${open}:${active}:${expanded}:${browseKind}:${detail?.bindingId ?? ''}`}
    >
      <div
        className="flex h-10 items-center px-1"
        data-slot="composer-resource-selector"
      >
        <Menu.Root
          modal={false}
          open={open}
          onOpenChange={(value) => {
            setOpen(value);
            if (!value) changeLevel(null);
          }}
        >
          <Menu.Trigger asChild>
            <button
              type="button"
              disabled={disabled || busy || connectorBusy}
              className="inline-flex h-5 max-w-full items-center gap-1.5 rounded-sm px-2 text-sm text-muted-foreground outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            >
              {totalSelected ? (
                <span className="isolate flex -space-x-1.5" aria-hidden="true">
                  {selectedItems.slice(0, 3).map((item, index) => (
                    <span key={item.bindingId} style={{ zIndex: 3 - index }}>
                      <ResourceIcon item={item} small />
                    </span>
                  ))}
                  {selectedConnectors
                    .slice(0, Math.max(0, 3 - selectedItems.length))
                    .map((option) => (
                      <span
                        key={`connector:${option.bindingId}`}
                        className="flex size-5 items-center justify-center rounded-sm bg-background ring-1 ring-border"
                      >
                        <IconDefinitionRenderer
                          icon={option.icon}
                          size={16}
                          fallback={<Puzzle className="size-4" />}
                        />
                      </span>
                    ))}
                </span>
              ) : (
                <Puzzle className="size-3.5 shrink-0" />
              )}
              {t('composer.resources.title')}
              {totalSelected > 0 && (
                <span className="text-xs tabular-nums">{totalSelected}</span>
              )}
              <ChevronDown className="size-3.5 shrink-0" />
            </button>
          </Menu.Trigger>
          <Menu.Portal>
            <Menu.Content
              side="top"
              align="start"
              sideOffset={8}
              collisionPadding={8}
              className={`${panelClass} max-h-[var(--radix-dropdown-menu-content-available-height)] overflow-y-auto`}
            >
              {compact && active ? (
                <>
                  <Menu.Item
                    onSelect={(event) => {
                      event.preventDefault();
                      changeLevel(null);
                    }}
                    className={navClass}
                  >
                    <ArrowLeft className="size-4" />
                    {categoryTitle(active)}
                  </Menu.Item>
                  {subContent(active)}
                </>
              ) : (
                <>
                  {search(
                    rootQuery,
                    setRootQuery,
                    t('composer.resources.searchPlugins'),
                  )}
                  {notice}
                  <Menu.Group
                    aria-label={t('composer.resources.selectedResources')}
                    className="max-h-[min(35vh,280px)] overflow-y-auto overscroll-contain"
                  >
                    {selectedResources.map((item) => row(item))}
                    {selectedConnectors
                      .filter((option) =>
                        (
                          resourceDescription(option.label, i18n?.language) ||
                          ''
                        )
                          .toLocaleLowerCase()
                          .includes(rootQuery.toLocaleLowerCase()),
                      )
                      .map((option) => nativeRow(option))}
                    {!selectedResources.length &&
                      !selectedConnectors.length && (
                        <p className="px-3 py-4 text-sm text-muted-foreground">
                          {t('composer.resources.noSelected')}
                        </p>
                      )}
                  </Menu.Group>
                  <Menu.Separator className="my-1 h-px bg-border" />
                  {categories.map((kind) => {
                    const Icon = categoryIcon[kind];
                    const count = selectedItems.filter(
                      (item) => item.kind === kind,
                    ).length;
                    const label = (
                      <>
                        <Icon className="size-5" strokeWidth={1.6} />
                        <span className="flex-1">{categoryTitle(kind)}</span>
                        {kind !== 'agent_plugin' && count > 0 && (
                          <span className="text-xs text-muted-foreground">
                            {count}
                          </span>
                        )}
                        <ChevronRight className="size-4 text-muted-foreground" />
                      </>
                    );
                    return compact ? (
                      <Menu.Item
                        key={kind}
                        onSelect={(event) => {
                          event.preventDefault();
                          changeLevel(kind);
                        }}
                        className={navClass}
                      >
                        {label}
                      </Menu.Item>
                    ) : (
                      <Menu.Sub
                        key={kind}
                        open={active === kind}
                        onOpenChange={(value) => {
                          if (value) changeLevel(kind);
                          else if (active === kind) changeLevel(null);
                        }}
                      >
                        <Menu.SubTrigger className={navClass}>
                          {label}
                        </Menu.SubTrigger>
                        <Menu.Portal>
                          <Menu.SubContent
                            sideOffset={8}
                            alignOffset={-8}
                            collisionPadding={8}
                            className={panelClass}
                          >
                            {subContent(kind)}
                          </Menu.SubContent>
                        </Menu.Portal>
                      </Menu.Sub>
                    );
                  })}
                  <Menu.Separator className="my-1 h-px bg-border" />
                  {connectors.data?.canManageWorkspace &&
                    connectors.data.managementUrl && (
                      <Menu.Item asChild className={navClass}>
                        <a
                          href={connectors.data.managementUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {t('composer.connections.manageWorkspace')}
                          <ArrowUpRight className="ml-auto size-4" />
                        </a>
                      </Menu.Item>
                    )}
                </>
              )}
            </Menu.Content>
          </Menu.Portal>
        </Menu.Root>
        <Dialog.Root
          open={!authorization && (expanded || !!detail)}
          onOpenChange={(value) => {
            if (!value) {
              setExpanded(false);
              setDetail(null);
            }
          }}
        >
          <Dialog.Portal>
            <Dialog.Overlay className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm" />
            <Dialog.Content
              className={cn(
                'fixed inset-x-0 bottom-0 z-50 max-h-[85dvh] overflow-y-auto border border-border bg-popover p-4 text-popover-foreground shadow-md sm:inset-auto sm:left-1/2 sm:top-1/2 sm:w-[36rem] sm:max-w-[95vw] sm:-translate-x-1/2 sm:-translate-y-1/2',
                getPanelRoundedClass(theme.radius),
              )}
            >
              <Dialog.Title className="mb-1 pr-8 text-lg font-semibold">
                {detail?.kind === 'agent_plugin'
                  ? `${t('composer.resources.connect')}: ${detail.title}`
                  : (detail?.title ?? t('composer.resources.browse'))}
              </Dialog.Title>
              <Dialog.Description className="mb-4 text-sm text-muted-foreground">
                {(detail?.kind !== 'agent_plugin' &&
                  resourceDescription(detail?.description, i18n?.language)) ||
                  t('composer.resources.scope')}
              </Dialog.Description>
              <Dialog.Close
                aria-label={t('composer.resources.close')}
                className={cn(
                  'absolute right-4 top-4 p-1 hover:bg-accent hover:text-accent-foreground',
                  itemRounded,
                )}
              >
                <X className="size-5" />
              </Dialog.Close>
              {notice}
              {detail ? (
                <>
                  {detail.components
                    .filter(
                      (component) =>
                        detail.kind !== 'agent_plugin' ||
                        component.status === 'requires_auth',
                    )
                    .map((component) => (
                      <div
                        key={`${component.kind}:${component.key}`}
                        className="flex items-center justify-between gap-3 border-b border-border py-3 text-sm"
                      >
                        <span>
                          {component.key} ·{' '}
                          {t(`composer.resources.${component.status}`)}
                        </span>
                        {component.status === 'requires_auth' && (
                          <ConnectionAuthorizationDialog
                            inline
                            client={client}
                            assistantId={assistantId}
                            target={authorizationTarget(detail, component.key)}
                            onConnect={onConnect}
                            onClose={() => {}}
                          />
                        )}
                      </div>
                    ))}
                  {detail.kind !== 'agent_plugin' &&
                    detail.diagnostics.map((diagnostic, index) => (
                      <p
                        key={index}
                        className="mt-3 text-xs text-muted-foreground"
                      >
                        {diagnostic.component}: {diagnostic.message}
                      </p>
                    ))}
                  <button
                    type="button"
                    onClick={() => {
                      refresh();
                      setDetail(null);
                      setExpanded(true);
                    }}
                    className="mt-4 inline-flex items-center gap-2 text-sm text-muted-foreground"
                  >
                    <RefreshCw className="size-4" />
                    {t('composer.resources.refresh')}
                  </button>
                </>
              ) : (
                <>
                  <div
                    className="mb-3 flex gap-1"
                    role="group"
                    aria-label={t('composer.resources.categories')}
                  >
                    {categories.map((kind) => (
                      <button
                        type="button"
                        key={kind}
                        aria-pressed={browseKind === kind}
                        onClick={() => {
                          setBrowseKind(kind);
                          setQuery('');
                        }}
                        className={cn(
                          'px-3 py-2 text-sm',
                          itemRounded,
                          browseKind === kind
                            ? 'bg-accent text-accent-foreground'
                            : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                        )}
                      >
                        {t(`composer.resources.${kind}`)}
                      </button>
                    ))}
                  </div>
                  {search(query, setQuery, t('composer.resources.search'))}
                  {catalogItems(browseKind, false, false)}
                </>
              )}
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
        {authorization && (
          <ConnectionAuthorizationDialog
            key={authorization.key}
            client={client}
            assistantId={assistantId}
            target={authorization}
            onConnect={onConnect}
            onClose={() => setAuthorization(null)}
          />
        )}
      </div>
    </ResourceInfoProvider>
  );
}
