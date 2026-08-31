import * as React from 'react';
import {
  ArrowUpRight,
  Cable,
  Check,
  Link2,
  Loader2,
  Search,
} from 'lucide-react';
import type {
  Client,
  ConnectorOAuthStatusResponse,
  ConnectorRuntimeOption,
  ConnectorScope,
  ConnectorStrategyDefinition,
  RuntimeI18nText,
} from '@xpert-ai/xpert-sdk';

import { useChatkitTranslation } from '../../i18n/useChatkitTranslation';
import { cn } from '../../lib/utils';
import { Input } from '../ui/input';
import { ScrollArea } from '../ui/scroll-area';
import { Separator } from '../ui/separator';

export type ConnectorMenuPanelProps = {
  client: Client | null;
  xpertId?: string;
  projectId?: string;
  selectedBindingIds?: string[];
  onSelectionChange?: (bindingIds: string[]) => void;
  apiUrl?: string;
};

type DirectOAuthMethod = {
  authMethodId?: string;
};

export function resolveConnectorManagementUrl(
  apiUrl: string | undefined,
  scope: ConnectorScope,
): string {
  const base = apiUrl?.trim() || window.location.href;
  const path =
    scope.type === 'project'
      ? `/project/${encodeURIComponent(scope.projectId)}/config`
      : `/xpert/w/${encodeURIComponent(scope.workspaceId)}/connectors`;
  return new URL(path, base).toString();
}

export function resolveDirectOAuthMethod(
  definition:
    | ConnectorStrategyDefinition
    | Pick<ConnectorRuntimeOption, 'authMethods'>,
): DirectOAuthMethod | null {
  if ('authMethods' in definition && definition.authMethods?.length) {
    if (definition.authMethods.length !== 1) return null;
    const method = definition.authMethods[0];
    if (method.type !== 'oauth2' || method.appCredentials?.fields?.length) {
      return null;
    }
    return { authMethodId: method.id };
  }

  if (!('auth' in definition) || definition.auth?.type !== 'oauth2') {
    return null;
  }
  if (definition.appCredentials?.fields?.length) return null;
  return { authMethodId: definition.legacyAuthMethodId };
}

function localizeText(value: RuntimeI18nText | undefined, locale: string) {
  if (!value) return '';
  if (typeof value === 'string') return value;
  const preferred = locale.toLocaleLowerCase().startsWith('zh')
    ? value.zh_Hans
    : value.en_US;
  return (
    preferred ?? value.en_US ?? value.zh_Hans ?? Object.values(value)[0] ?? ''
  );
}

function ConnectorIcon({
  option,
  label,
}: {
  option: ConnectorRuntimeOption;
  label: string;
}) {
  if (option.icon?.type === 'image' && typeof option.icon.value === 'string') {
    return (
      <img
        src={option.icon.value}
        alt=""
        className="size-7 rounded-md object-contain"
      />
    );
  }

  return (
    <span
      aria-hidden="true"
      title={label}
      className="flex size-7 items-center justify-center rounded-md bg-muted text-muted-foreground"
    >
      <Cable className="size-4" />
    </span>
  );
}

function isConnectorUsable(option: ConnectorRuntimeOption) {
  return (
    option.status === 'active' &&
    (option.authorizationMode === 'shared' || option.granted)
  );
}

export function ConnectorMenuPanel({
  client,
  xpertId,
  projectId,
  selectedBindingIds = [],
  onSelectionChange,
  apiUrl,
}: ConnectorMenuPanelProps) {
  const { t, i18n } = useChatkitTranslation();
  const [query, setQuery] = React.useState('');
  const [scope, setScope] = React.useState<ConnectorScope | null>(null);
  const [options, setOptions] = React.useState<ConnectorRuntimeOption[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [connectingBindingId, setConnectingBindingId] = React.useState<
    string | null
  >(null);
  const loadErrorMessage = t('composer.connectors.loadError');
  const accessDeniedMessage = t('composer.connectors.accessDenied');
  const scopeUnavailableMessage = t('composer.connectors.scopeUnavailable');
  const pollAbortRef = React.useRef<AbortController | null>(null);
  const popupRef = React.useRef<Window | null>(null);
  const selectedBindingIdSet = React.useMemo(
    () => new Set(selectedBindingIds),
    [selectedBindingIds],
  );

  const loadConnectors = React.useCallback(
    async (signal?: AbortSignal) => {
      if (!client || !xpertId) return;
      const response = await client.connectors.runtimeOptions(xpertId, {
        projectId,
        signal,
      });
      setScope(response.scope);
      setOptions(response.items);
    },
    [client, projectId, xpertId],
  );

  React.useEffect(() => {
    if (!client || !xpertId) {
      setScope(null);
      setOptions([]);
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    setScope(null);
    setOptions([]);
    setLoading(true);
    setError(null);
    loadConnectors(controller.signal)
      .catch((loadError) => {
        if (controller.signal.aborted) return;
        console.warn('[Chat] Failed to load connectors:', loadError);
        setError(
          isAccessDenied(loadError) ? accessDeniedMessage : loadErrorMessage,
        );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [accessDeniedMessage, client, loadConnectors, loadErrorMessage, xpertId]);

  React.useEffect(
    () => () => {
      pollAbortRef.current?.abort();
      if (popupRef.current && !popupRef.current.closed) {
        popupRef.current.close();
      }
    },
    [],
  );

  const manageUrl = scope ? resolveConnectorManagementUrl(apiUrl, scope) : null;
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const filteredOptions = React.useMemo(
    () =>
      options.filter((option) => {
        if (!normalizedQuery) return true;
        const searchable = `${localizeText(
          option.label,
          i18n.language,
        )} ${localizeText(option.description, i18n.language)} ${
          option.provider
        }`.toLocaleLowerCase();
        return searchable.includes(normalizedQuery);
      }),
    [i18n.language, normalizedQuery, options],
  );

  const refresh = React.useCallback(async () => {
    setLoading(true);
    try {
      await loadConnectors();
      setError(null);
    } finally {
      setLoading(false);
    }
  }, [loadConnectors]);

  const pollAuthorization = React.useCallback(
    async (
      bindingId: string,
      initial: ConnectorOAuthStatusResponse,
      popup: Window,
      signal: AbortSignal,
    ) => {
      if (!client) return;
      let status = initial;
      while (!signal.aborted && status.connector.status === 'pending') {
        const delay = Math.max(1, status.pollIntervalSeconds ?? 2) * 1000;
        await new Promise<void>((resolve, reject) => {
          const timeout = window.setTimeout(resolve, delay);
          signal.addEventListener(
            'abort',
            () => {
              window.clearTimeout(timeout);
              reject(new DOMException('Aborted', 'AbortError'));
            },
            { once: true },
          );
        });
        status = await client.connectors.authorizationStatus(bindingId, {
          xpertId,
          signal,
        });
      }

      if (signal.aborted) return;
      if (status.connector.status === 'active') {
        if (!popup.closed) popup.close();
        await refresh();
        onSelectionChange?.(
          Array.from(new Set([...selectedBindingIds, bindingId])),
        );
        return;
      }
      throw new Error(
        status.message || status.connector.lastError || 'OAuth failed',
      );
    },
    [client, onSelectionChange, refresh, selectedBindingIds, xpertId],
  );

  const openManageConnectors = React.useCallback(() => {
    if (!manageUrl) {
      setError(scopeUnavailableMessage);
      return;
    }
    const popup = window.open(manageUrl, '_blank');
    if (!popup) {
      setError(t('composer.connectors.popupBlocked'));
      return;
    }
    popup.opener = null;
  }, [manageUrl, scopeUnavailableMessage, t]);

  const connectPersonalBinding = React.useCallback(
    async (option: ConnectorRuntimeOption) => {
      if (!client) return;

      if (option.profile) {
        setConnectingBindingId(option.bindingId);
        try {
          await client.connectors.consent(option.bindingId, { xpertId });
          await refresh();
          onSelectionChange?.(
            Array.from(new Set([...selectedBindingIds, option.bindingId])),
          );
          setError(null);
        } catch (consentError) {
          setError(
            isAccessDenied(consentError)
              ? accessDeniedMessage
              : t('composer.connectors.connectError'),
          );
        } finally {
          setConnectingBindingId(null);
        }
        return;
      }

      const directMethod = resolveDirectOAuthMethod(option);
      if (!directMethod) {
        openManageConnectors();
        return;
      }

      const popup = window.open('', '_blank');
      if (!popup) {
        setError(t('composer.connectors.popupBlocked'));
        return;
      }

      pollAbortRef.current?.abort();
      const controller = new AbortController();
      pollAbortRef.current = controller;
      popupRef.current = popup;
      setConnectingBindingId(option.bindingId);
      setError(null);

      try {
        const response = await client.connectors.connect(
          option.bindingId,
          { ...directMethod, xpertId },
          { signal: controller.signal },
        );
        if (response.connector.status === 'active') {
          popup.close();
          await refresh();
          onSelectionChange?.(
            Array.from(new Set([...selectedBindingIds, option.bindingId])),
          );
          return;
        }
        if (!response.authorizationUrl) {
          throw new Error('Missing OAuth authorization URL');
        }
        popup.location.href = response.authorizationUrl;
        await pollAuthorization(
          option.bindingId,
          response,
          popup,
          controller.signal,
        );
      } catch (connectError) {
        if (controller.signal.aborted) return;
        console.warn('[Chat] Failed to connect connector:', connectError);
        if (!popup.closed) popup.close();
        setError(
          isAccessDenied(connectError)
            ? accessDeniedMessage
            : t('composer.connectors.connectError'),
        );
      } finally {
        if (!controller.signal.aborted) setConnectingBindingId(null);
        if (pollAbortRef.current === controller) pollAbortRef.current = null;
        if (popupRef.current === popup) popupRef.current = null;
      }
    },
    [
      accessDeniedMessage,
      client,
      onSelectionChange,
      openManageConnectors,
      pollAuthorization,
      refresh,
      selectedBindingIds,
      t,
      xpertId,
    ],
  );

  const handleOptionClick = React.useCallback(
    (option: ConnectorRuntimeOption) => {
      if (!isConnectorUsable(option)) {
        if (option.authorizationMode === 'personal') {
          void connectPersonalBinding(option);
        } else {
          openManageConnectors();
        }
        return;
      }

      const next = selectedBindingIdSet.has(option.bindingId)
        ? selectedBindingIds.filter((id) => id !== option.bindingId)
        : [...selectedBindingIds, option.bindingId];
      onSelectionChange?.(next);
    },
    [
      connectPersonalBinding,
      onSelectionChange,
      openManageConnectors,
      selectedBindingIdSet,
      selectedBindingIds,
    ],
  );

  return (
    <div
      data-slot="composer-connector-panel"
      className="flex w-full min-w-0 max-w-full flex-col"
    >
      <div className="p-3 pb-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t('composer.connectors.search')}
            className="h-8 border-0 bg-muted pl-10 text-base shadow-none focus-visible:ring-1"
          />
        </div>
      </div>

      <ScrollArea className="max-h-72 min-h-0 px-3">
        <div data-slot="composer-connector-list" className="space-y-1 pb-2">
          {loading ? (
            <ConnectorMessage>
              <Loader2 className="mr-2 inline size-4 animate-spin" />
              {t('composer.connectors.loading')}
            </ConnectorMessage>
          ) : !xpertId ? (
            <ConnectorMessage>{scopeUnavailableMessage}</ConnectorMessage>
          ) : filteredOptions.length === 0 ? (
            <ConnectorMessage>
              {t('composer.connectors.empty')}
            </ConnectorMessage>
          ) : (
            filteredOptions.map((option) => {
              const label = localizeText(option.label, i18n.language);
              const selected = selectedBindingIdSet.has(option.bindingId);
              const usable = isConnectorUsable(option);
              const connecting = connectingBindingId === option.bindingId;
              return (
                <button
                  key={option.bindingId}
                  type="button"
                  aria-pressed={selected}
                  disabled={connecting}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-md p-1.5 text-left outline-none transition-colors hover:bg-muted focus-visible:bg-muted disabled:cursor-wait',
                    selected && 'bg-muted',
                  )}
                  onClick={() => handleOptionClick(option)}
                >
                  <ConnectorIcon option={option} label={label} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-base">
                      {label || option.provider}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {option.authorizationMode === 'personal'
                        ? t('composer.connectors.personal')
                        : scope?.type === 'workspace'
                          ? t('composer.connectors.workspaceShared')
                          : t('composer.connectors.shared')}
                    </span>
                  </span>
                  <span className="inline-flex shrink-0 items-center gap-1.5 text-sm text-muted-foreground">
                    {connecting ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : selected ? (
                      <Check className="size-4 text-primary" />
                    ) : usable ? (
                      <span className="size-4 rounded-full border border-current" />
                    ) : (
                      <Link2 className="size-4" />
                    )}
                    {connecting
                      ? t('composer.connectors.connecting')
                      : selected
                        ? t('composer.connectors.selected')
                        : usable
                          ? t('composer.connectors.select')
                          : option.authorizationMode === 'personal'
                            ? t('composer.connectors.connect')
                            : t('composer.connectors.unavailable')}
                  </span>
                </button>
              );
            })
          )}
        </div>
      </ScrollArea>

      {error ? (
        <div role="alert" className="px-4 py-2 text-sm text-destructive">
          {error}
        </div>
      ) : null}
      <Separator />
      <button
        type="button"
        className="flex h-10 shrink-0 items-center gap-3 px-5 text-left text-base outline-none hover:bg-muted focus-visible:bg-muted disabled:opacity-50"
        disabled={!scope}
        onClick={openManageConnectors}
      >
        <ArrowUpRight className="size-5" />
        {t('composer.connectors.manage')}
      </button>
    </div>
  );
}

function isAccessDenied(error: unknown): boolean {
  return (
    error instanceof Error &&
    'status' in error &&
    (error.status === 401 || error.status === 403)
  );
}

function ConnectorMessage({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-40 items-center justify-center px-4 text-center text-sm text-muted-foreground">
      {children}
    </div>
  );
}
