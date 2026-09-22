import * as React from 'react';
import { ArrowUpRight, Loader2 } from 'lucide-react';
import type { Client, ConnectorRuntimeOption } from '@xpert-ai/xpert-sdk';
import { useChatkitTranslation } from '../../i18n/useChatkitTranslation';
import { Input } from '../ui/input';
import { SELECTOR_SEARCH_CLASS } from './selector-styles';
import { resourceDescription } from './resource-description';
import { connectionErrorKey } from './connector-authorization';
import { useConnectorCatalog } from './useConnectorCatalog';
import { ConnectorResourceRow, connectorUsable } from './ConnectorResourceRow';
import {
  ConnectionAuthorizationDialog,
  type ConnectionAuthorizationTarget,
} from './ConnectionAuthorizationDialog';
export {
  resolveConnectorManagementUrl,
  resolveDirectOAuthMethod,
} from './connector-authorization';

export type ConnectorMenuPanelProps = {
  client: Client | null;
  xpertId?: string;
  projectId?: string;
  selectedBindingIds?: string[];
  onSelectionChange?: (bindingIds: string[]) => void;
  apiUrl?: string;
};

/** Compatibility for hosts that have not enabled the unified resource picker. */
export function ConnectorMenuPanel(props: ConnectorMenuPanelProps) {
  const { t } = useChatkitTranslation();
  if (!props.client || !props.xpertId)
    return (
      <p
        data-slot="composer-connector-panel"
        className="w-full min-w-0 max-w-full p-3 text-sm text-muted-foreground"
      >
        {t('composer.connectors.scopeUnavailable')}
      </p>
    );
  return (
    <ConnectorList {...props} client={props.client} xpertId={props.xpertId} />
  );
}
function ConnectorList({
  client,
  xpertId,
  projectId,
  selectedBindingIds = [],
  onSelectionChange,
  apiUrl,
}: ConnectorMenuPanelProps & { client: Client; xpertId: string }) {
  const { t, i18n } = useChatkitTranslation();
  const catalog = useConnectorCatalog(client, xpertId, projectId);
  const [query, setQuery] = React.useState('');
  const [target, setTarget] =
    React.useState<ConnectionAuthorizationTarget | null>(null);
  const latest = React.useRef({ selectedBindingIds, onSelectionChange });
  latest.current = { selectedBindingIds, onSelectionChange };
  const options = (catalog.data?.items ?? []).filter(
    (option) =>
      option.runtimeUsage !== 'credential' &&
      `${resourceDescription(option.label, i18n?.language)} ${resourceDescription(option.description, i18n?.language)}`
        .toLocaleLowerCase()
        .includes(query.toLocaleLowerCase()),
  );
  const select = (option: ConnectorRuntimeOption) => {
    const ids = latest.current.selectedBindingIds;
    latest.current.onSelectionChange?.(
      ids.includes(option.bindingId)
        ? ids.filter((id) => id !== option.bindingId)
        : [...ids, option.bindingId],
    );
  };
  return (
    <div
      data-slot="composer-connector-panel"
      className="flex w-full min-w-0 max-w-full flex-col"
    >
      <Input
        aria-label={t('composer.connectors.search')}
        placeholder={t('composer.connectors.search')}
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        className={SELECTOR_SEARCH_CLASS}
      />
      <div
        data-slot="composer-connector-list"
        className="max-h-72 overflow-y-auto p-1"
      >
        {catalog.error != null ? (
          <div role="alert" className="p-3 text-sm text-destructive">
            {t(connectionErrorKey(catalog.error))}
            <button
              type="button"
              className="ml-2 underline"
              onClick={catalog.refresh}
            >
              {t('composer.resources.refresh')}
            </button>
          </div>
        ) : catalog.loading && !catalog.data ? (
          <Loader2
            aria-label={t('composer.connectors.loading')}
            className="m-3 size-4 animate-spin"
          />
        ) : !options.length ? (
          <p className="p-3 text-sm text-muted-foreground">
            {t('composer.connectors.empty')}
          </p>
        ) : (
          options.map((option) => (
            <ConnectorResourceRow
              key={option.bindingId}
              option={option}
              selected={selectedBindingIds.includes(option.bindingId)}
              busy={false}
              menu={false}
              onToggle={(value) => {
                if (
                  selectedBindingIds.includes(value.bindingId) ||
                  connectorUsable(value)
                )
                  select(value);
                else if (catalog.data)
                  setTarget({
                    key: value.bindingId,
                    title:
                      resourceDescription(value.label, i18n?.language) ||
                      value.provider,
                    prepare: async () => ({
                      type: 'connector',
                      status: 'requires_auth',
                      connector: {
                        bindingId: value.bindingId,
                        provider: value.provider,
                        scope: value.scope ?? catalog.data!.scope,
                        authorizationMode: value.authorizationMode,
                        canManage: value.canManage,
                        managementUrl: value.managementUrl,
                        authMethods: value.authMethods,
                      },
                    }),
                    onAuthorized: async () => {
                      catalog.refresh();
                      if (
                        !latest.current.selectedBindingIds.includes(
                          value.bindingId,
                        )
                      )
                        select(value);
                    },
                  });
              }}
            />
          ))
        )}
      </div>
      {catalog.data?.canManageWorkspace && catalog.data.managementUrl && (
        <a
          href={catalog.data.managementUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 border-t border-border px-3 py-2 text-sm text-muted-foreground hover:bg-accent"
        >
          <ArrowUpRight className="size-4" />
          {t('composer.connections.manageWorkspace')}
        </a>
      )}
      {target && (
        <ConnectionAuthorizationDialog
          key={target.key}
          client={client}
          assistantId={xpertId}
          target={target}
          onClose={() => setTarget(null)}
        />
      )}
    </div>
  );
}
