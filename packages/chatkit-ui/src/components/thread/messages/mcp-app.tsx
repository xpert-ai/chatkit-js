import {
  resolveLocalizedText,
  type ChatKitMcpAppsOptions,
  type TMessageComponentMcpAppData,
} from '@xpert-ai/chatkit-types';
import { isEqual } from 'lodash-es';
import {
  AlertCircle,
  Loader2,
  Maximize2,
  Minimize2,
  PictureInPicture2,
  RefreshCw,
  ShieldAlert,
} from 'lucide-react';
import * as React from 'react';
import { useChatkitTranslation } from '../../../i18n/useChatkitTranslation';
import { cn } from '../../../lib/utils';
import { useStreamContext } from '../../../providers/Stream';
import { Badge } from '../../ui/badge';
import { Button } from '../../ui/button';
import { IconDefinitionRenderer } from '../../ui/icon-definition';
import type { McpAppJsonRpcRequest as JsonRpcRequest } from './mcp-app/host';
import { buildMcpAppReviveQuery } from './mcp-app/resource/normalization';
import {
  buildIframeAllow,
  buildSandboxAttribute,
  resolveMcpAppSandboxProxy,
} from './mcp-app/sandbox/policy';

import { useMcpAppApprovalExpiry } from './mcp-app/approval/useMcpAppApprovalExpiry';
import { useMcpAppApprovals } from './mcp-app/approval/useMcpAppApprovals';
import { useMcpAppBridge } from './mcp-app/bridge/useMcpAppBridge';
import { useMcpAppRefresh } from './mcp-app/resource/useMcpAppRefresh';
import { useMcpAppResource } from './mcp-app/resource/useMcpAppResource';
import { useMcpAppState } from './mcp-app/session/useMcpAppState';
import { useMcpAppTeardown } from './mcp-app/session/useMcpAppTeardown';

export {
  isMcpAppComponentData,
  normalizeMcpAppResourceResponse,
} from './mcp-app/resource/normalization';
export { normalizeCallToolResult } from './mcp-app/resource/tool-result';
export { resolveMcpAppSandboxProxy } from './mcp-app/sandbox/policy';

export function McpAppMessage({
  data: incomingData,
  messageId,
  className,
  mcpApps,
}: {
  data: TMessageComponentMcpAppData;
  messageId?: string;
  className?: string;
  mcpApps?: ChatKitMcpAppsOptions;
}) {
  // Message streaming recreates equal component data. Do not remount an active
  // form or tear down its RPC session merely because the parent rerendered.
  const dataRef = React.useRef(incomingData);

  if (!isEqual(dataRef.current, incomingData)) dataRef.current = incomingData;

  const data = dataRef.current;

  const { i18n } = useChatkitTranslation();

  const {
    client,
    isLoading: streamIsLoading,
    submit,
    threadId,
    conversationId,
  } = useStreamContext();

  const state = useMcpAppState({ data });

  const sandboxProxy = React.useMemo(
    () =>
      resolveMcpAppSandboxProxy(mcpApps, state.resource?.domain ?? data.domain),
    [data.domain, mcpApps, state.resource?.domain],
  );

  const postToApp = React.useCallback(
    (message: unknown) => {
      state.iframeRef.current?.contentWindow?.postMessage(
        message,
        sandboxProxy?.origin ?? '*',
      );
    },
    [sandboxProxy?.origin],
  );

  const callHostRpc = React.useCallback(
    async (request: JsonRpcRequest) => {
      return client.mcp.apps.rpc(
        data.appInstanceId,
        {
          jsonrpc: '2.0',
          id: request.id ?? null,
          method: request.method,
          params: request.params,
        },
        buildMcpAppReviveQuery(data, {
          appInstanceToken: state.runtimeAppInstanceToken,
          messageId,
        }),
      );
    },
    [client, data, messageId, state.runtimeAppInstanceToken],
  );

  const refresh = useMcpAppRefresh({
    identity: data.appInstanceId,
    refresh: state.resource?.refresh,
    ready: state.initializedRef,
    call: callHostRpc,
    post: postToApp,
    failureMessage: i18n.t('message.mcpApp.refreshFailed'),
  });

  const approvals = useMcpAppApprovals({
    ...state,
    postToApp,
    callHostRpc,
    data,
    messageId,
    client,
  });

  const resourceLifecycle = useMcpAppResource({
    ...state,
    postToApp,
    data,
    client,
    messageId,
    i18n,
  });

  useMcpAppTeardown({ ...state, data, sandboxProxy, messageId, client });

  useMcpAppApprovalExpiry({ ...state, ...approvals, postToApp });

  React.useEffect(() => {
    resourceLifecycle.sendInitialToolNotifications();
  }, [resourceLifecycle.sendInitialToolNotifications]);

  useMcpAppBridge({
    ...state,
    ...resourceLifecycle,
    ...approvals,
    postToApp,
    sandboxProxy,
    data,
    messageId,
    client,
    i18n,
    callHostRpc,
    submit,
    threadId,
    conversationId,
    streamIsLoading,
  });

  const iframePermissions = state.resource?.permissions ?? data.permissions;

  const iframeAllow = React.useMemo(
    () => buildIframeAllow(iframePermissions),
    [iframePermissions],
  );

  const sandbox = sandboxProxy
    ? 'allow-scripts allow-same-origin'
    : buildSandboxAttribute();

  const prefersBorder =
    state.resource?.prefersBorder ?? data.prefersBorder ?? true;

  const displayTitle =
    resolveLocalizedText(state.resource?.title ?? data.title, i18n.language) ??
    data.toolName;

  const displayDescription = resolveLocalizedText(
    state.resource?.description ?? data.description,
    i18n.language,
  );

  const displayIcon = state.resource?.icon ?? data.icon;

  const elevatedDisplayMode = state.displayMode !== 'inline';

  if (state.isTornDown) {
    return null;
  }

  return (
    <>
      {state.displayMode === 'fullscreen' ? (
        <div
          aria-hidden="true"
          className="fixed inset-0 z-[79] bg-background/80 backdrop-blur-sm"
        />
      ) : null}
      <div
        ref={state.containerRef}
        data-display-mode={state.displayMode}
        className={cn(
          'relative flex flex-col overflow-hidden rounded-lg border bg-background shadow-sm',
          state.displayMode === 'fullscreen' &&
            'fixed inset-4 z-[80] shadow-2xl',
          state.displayMode === 'pip' &&
            'fixed right-4 bottom-4 z-[80] h-[min(640px,calc(100vh-2rem))] w-[min(480px,calc(100vw-2rem))] shadow-2xl',
          !prefersBorder && 'border-transparent shadow-none',
          className,
        )}
      >
        <div className="flex min-h-10 items-center justify-between gap-3 border-b px-3 py-2">
          <div className="flex min-w-0 items-center gap-2">
            {displayIcon ? (
              <IconDefinitionRenderer
                icon={displayIcon}
                size={18}
                className="shrink-0"
                decorative
              />
            ) : null}
            <div className="min-w-0">
              <div className="truncate text-sm font-medium">{displayTitle}</div>
              {displayDescription ? (
                <div className="truncate text-[11px] text-muted-foreground">
                  {displayDescription}
                </div>
              ) : null}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {state.resource?.refresh ? (
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                title={i18n.t('message.mcpApp.refresh')}
                aria-label={i18n.t('message.mcpApp.refresh')}
                disabled={
                  state.isLoading ||
                  refresh.refreshing ||
                  !!state.pendingApproval
                }
                onClick={() => void refresh.refresh()}
              >
                <RefreshCw
                  className={cn(refresh.refreshing && 'animate-spin')}
                />
              </Button>
            ) : null}
            {state.displayMode !== 'fullscreen' ? (
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                title={i18n.t('message.mcpApp.fullscreen')}
                aria-label={i18n.t('message.mcpApp.fullscreen')}
                onClick={() => state.setDisplayMode('fullscreen')}
              >
                <Maximize2 />
              </Button>
            ) : null}
            {state.displayMode !== 'pip' ? (
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                title={i18n.t('message.mcpApp.pictureInPicture')}
                aria-label={i18n.t('message.mcpApp.pictureInPicture')}
                onClick={() => state.setDisplayMode('pip')}
              >
                <PictureInPicture2 />
              </Button>
            ) : null}
            {elevatedDisplayMode ? (
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                title={i18n.t('message.mcpApp.returnInline')}
                aria-label={i18n.t('message.mcpApp.returnInline')}
                onClick={() => state.setDisplayMode('inline')}
              >
                <Minimize2 />
              </Button>
            ) : null}
          </div>
        </div>

        {refresh.error ? (
          <div role="alert" className="px-3 py-2 text-sm text-destructive">
            {refresh.error}
          </div>
        ) : null}
        {state.pendingApproval ? (
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby={`mcp-app-approval-${state.pendingApproval.approvalId}`}
            className="absolute inset-0 z-20 flex items-center justify-center bg-background/90 p-4 backdrop-blur-sm"
          >
            <div className="flex max-h-full w-full max-w-lg flex-col gap-4 overflow-hidden rounded-lg border bg-background p-4 shadow-xl">
              <div className="flex items-start gap-3">
                <div className="rounded-full bg-destructive/10 p-2 text-destructive">
                  <ShieldAlert className="size-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3
                      id={`mcp-app-approval-${state.pendingApproval.approvalId}`}
                      className="text-sm font-semibold"
                    >
                      {i18n.t('message.mcpApp.approvalTitle')}
                    </h3>
                    <Badge
                      variant="outline"
                      className="border-destructive/40 text-destructive"
                    >
                      {state.pendingApproval.risk}
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {i18n.t(
                      state.pendingApproval.kind === 'download'
                        ? 'message.mcpApp.downloadApprovalDescription'
                        : 'message.mcpApp.toolApprovalDescription',
                      { tool: state.pendingApproval.toolName },
                    )}
                  </p>
                </div>
              </div>

              <div className="min-h-0">
                <div className="mb-1 text-xs font-medium">
                  {i18n.t('message.mcpApp.requestDetails')}
                </div>
                <pre className="max-h-48 overflow-auto rounded-md border bg-muted/40 p-3 text-[11px] leading-5 whitespace-pre-wrap break-all">
                  {state.pendingApproval.details}
                </pre>
              </div>

              {state.approvalError ? (
                <div
                  role="alert"
                  className="flex items-start gap-2 text-xs text-destructive"
                >
                  <AlertCircle className="mt-0.5 size-4 shrink-0" />
                  <span>{state.approvalError}</span>
                </div>
              ) : null}

              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={state.approvalAction !== null}
                  onClick={() =>
                    void approvals.resolvePendingApproval('reject')
                  }
                >
                  {state.approvalAction === 'reject' ? (
                    <Loader2 className="animate-spin" />
                  ) : null}
                  {i18n.t('message.mcpApp.reject')}
                </Button>
                <Button
                  type="button"
                  variant={
                    state.pendingApproval.risk === 'destructive'
                      ? 'destructive'
                      : 'default'
                  }
                  disabled={state.approvalAction !== null}
                  onClick={() =>
                    void approvals.resolvePendingApproval('approve')
                  }
                >
                  {state.approvalAction === 'approve' ? (
                    <Loader2 className="animate-spin" />
                  ) : null}
                  {i18n.t('message.mcpApp.approve')}
                </Button>
              </div>
            </div>
          </div>
        ) : null}

        {state.isLoading ? (
          <div
            className={cn(
              'flex h-40 items-center justify-center gap-2 text-sm text-muted-foreground',
              elevatedDisplayMode && 'min-h-0 flex-1',
            )}
          >
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>{i18n.t('message.mcpApp.loading')}</span>
          </div>
        ) : state.error ? (
          <div
            className={cn(
              'flex h-40 items-center justify-center gap-2 px-4 text-sm text-destructive',
              elevatedDisplayMode && 'min-h-0 flex-1',
            )}
          >
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span className="min-w-0 break-words">{state.error}</span>
          </div>
        ) : state.srcDoc ? (
          <iframe
            ref={state.bindIframeRef}
            title={displayTitle}
            {...(sandboxProxy
              ? { src: sandboxProxy.url }
              : { srcDoc: state.srcDoc })}
            className={cn(
              'block w-full bg-background',
              elevatedDisplayMode && 'min-h-0 flex-1',
            )}
            style={elevatedDisplayMode ? undefined : { height: state.height }}
            sandbox={sandbox}
            allow={iframeAllow}
            referrerPolicy="no-referrer"
          />
        ) : null}
      </div>
    </>
  );
}
