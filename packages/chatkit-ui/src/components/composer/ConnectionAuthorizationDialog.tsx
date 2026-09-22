import * as React from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { Loader2, X } from 'lucide-react';
import type { Client, RuntimeResourceAuthorization } from '@xpert-ai/xpert-sdk';
import type { WorkspaceConnectorConnectHandler } from '@xpert-ai/chatkit-types';
import { useChatkitTranslation } from '../../i18n/useChatkitTranslation';
import { useTheme } from '../../providers/Theme';
import { ParentMessengerContext } from '../../providers/ParentMessenger';
import { cn, getPanelRoundedClass } from '../../lib/utils';
import { connectionErrorKey } from './connector-authorization';
import { invalidateConnectionCatalogs } from './useConnectorCatalog';

export type ConnectionAuthorizationTarget = {
  key: string;
  title: string;
  prepare: () => Promise<RuntimeResourceAuthorization>;
  onAuthorized: (signal: AbortSignal) => Promise<void>;
};

/** The host owns workspace credentials and OAuth; ChatKit only verifies readiness. */
export function ConnectionAuthorizationDialog({
  client,
  assistantId,
  target,
  onClose,
  onConnect,
  inline = false,
}: {
  client: Client<unknown>;
  assistantId: string;
  target: ConnectionAuthorizationTarget;
  onClose: () => void;
  onConnect?: WorkspaceConnectorConnectHandler;
  inline?: boolean;
}) {
  const { t } = useChatkitTranslation();
  const { theme } = useTheme();
  const parent = React.useContext(ParentMessengerContext);
  const [requirement, setRequirement] =
    React.useState<RuntimeResourceAuthorization>();
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<unknown>();
  const [attempt, retry] = React.useReducer((value) => value + 1, 0);
  const controllerRef = React.useRef<AbortController | null>(null);
  const active = React.useRef(false);
  const current = React.useRef(target);
  current.current = target;
  React.useEffect(() => {
    const controller = new AbortController();
    controllerRef.current = controller;
    active.current = false;
    setRequirement(undefined);
    setError(undefined);
    setBusy(false);
    void current.current
      .prepare()
      .then((value) => {
        if (!controller.signal.aborted) setRequirement(value);
      })
      .catch((reason: unknown) => {
        if (!controller.signal.aborted) setError(reason);
      });
    return () => controller.abort();
  }, [target.key, client, assistantId, attempt]);

  const connector =
    requirement?.type === 'connector' ? requirement.connector : null;
  const canConnect =
    connector?.canManage === true && connector.scope.type === 'workspace';
  const connect = async () => {
    const controller = controllerRef.current;
    if (
      !controller ||
      controller.signal.aborted ||
      active.current ||
      !canConnect
    )
      return;
    active.current = true;
    setBusy(true);
    setError(undefined);
    try {
      // Recheck permission before handing a potentially stale menu selection to the host.
      const fresh = await current.current.prepare();
      if (controller.signal.aborted) return;
      setRequirement(fresh);
      if (
        fresh.type !== 'connector' ||
        fresh.connector.canManage !== true ||
        fresh.connector.scope.type !== 'workspace'
      )
        return;
      const request = { assistantId, bindingId: fresh.connector.bindingId };
      const result: unknown =
        typeof onConnect === 'function'
          ? await onConnect(request)
          : parent?.isParentAvailable
            ? await parent.sendCommand('onConnectWorkspaceConnector', request)
            : (() => {
                throw new Error('workspace-host-unavailable');
              })();
      if (controller.signal.aborted) return;
      if (!result || typeof result !== 'object' || !('status' in result))
        throw new Error('workspace-host-unavailable');
      if (result.status === 'cancelled') return;
      if (result.status !== 'connected')
        throw new Error('workspace-host-unavailable');
      const status = await client.connectors.runtimeStatus(
        assistantId,
        fresh.connector.bindingId,
        { signal: controller.signal },
      );
      if (controller.signal.aborted) return;
      if (!status.granted) throw new Error('workspace-connection-not-ready');
      invalidateConnectionCatalogs(client);
      await current.current.onAuthorized(controller.signal);
      if (!controller.signal.aborted) onClose();
    } catch (reason) {
      if (!controller.signal.aborted) setError(reason);
    } finally {
      if (!controller.signal.aborted) {
        active.current = false;
        setBusy(false);
      }
    }
  };
  const content = (
    <div className="space-y-3 text-sm">
      {!requirement && error == null && (
        <Loader2
          aria-label={t('composer.resources.loading')}
          className="size-4 animate-spin"
        />
      )}
      {requirement &&
        (canConnect ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => void connect()}
            className={cn(
              'inline-flex items-center gap-2 bg-accent px-3 py-1.5 text-accent-foreground disabled:opacity-50',
              getPanelRoundedClass(theme.radius),
            )}
          >
            {busy && <Loader2 className="size-4 animate-spin" />}
            {t('composer.resources.connect')}
          </button>
        ) : (
          <p className="text-muted-foreground">
            {t('composer.connections.contactAdmin')}
          </p>
        ))}
      {error != null && (
        <div role="alert" className="text-destructive">
          {t(
            error instanceof Error &&
              error.message === 'workspace-connection-not-ready'
              ? 'composer.connections.notReady'
              : error instanceof Error &&
                  error.message === 'workspace-host-unavailable'
                ? 'composer.connections.hostUnavailable'
                : connectionErrorKey(error),
          )}
          {!requirement && (
            <button type="button" onClick={retry} className="ml-2 underline">
              {t('composer.resources.refresh')}
            </button>
          )}
        </div>
      )}
    </div>
  );
  if (inline) return content;
  return (
    <Dialog.Root
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm" />
        <Dialog.Content
          className={cn(
            'fixed left-1/2 top-1/2 z-50 max-h-[85dvh] w-[28rem] max-w-[95vw] -translate-x-1/2 -translate-y-1/2 overflow-y-auto border border-border bg-popover p-4 text-popover-foreground shadow-md',
            getPanelRoundedClass(theme.radius),
          )}
        >
          <Dialog.Title className="pr-8 font-semibold">
            {target.title}
          </Dialog.Title>
          <Dialog.Description className="my-3 text-sm text-muted-foreground">
            {t('composer.connections.workspaceScope')}
          </Dialog.Description>
          <Dialog.Close
            aria-label={t('composer.resources.close')}
            className="absolute right-3 top-3"
          >
            <X className="size-4" />
          </Dialog.Close>
          {content}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
