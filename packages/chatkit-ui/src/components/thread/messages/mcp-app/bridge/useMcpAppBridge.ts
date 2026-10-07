import { parseMcpAppProjectLink } from './project-link';
import {
  resolveLocalizedText,
  type TMessageComponentMcpAppData,
} from '@xpert-ai/chatkit-types';
import * as React from 'react';
import { useWorkbench } from '../../../../../workbench/context';
import type { useChatkitTranslation } from '../../../../../i18n/useChatkitTranslation';
import {
  readAppContinuation,
  resumeAfterTool,
} from '../../../../../lib/tool-after';
import type { StreamContextType } from '../../../../../providers/Stream';
import type { useMcpAppApprovals } from '../approval/useMcpAppApprovals';
import {
  isMcpAppRpcSuccess,
  type McpAppJsonRpcRequest as JsonRpcRequest,
} from '../host';
import {
  buildMcpAppTheme,
  getContainerDimensions,
  getLocaleDirection,
  getLocaleLanguage,
  normalizeHostLocale,
} from '../presentation/host-context';
import {
  buildMcpAppReviveQuery,
  normalizeMcpAppToolInfo,
} from '../resource/normalization';
import type { useMcpAppResource } from '../resource/useMcpAppResource';
import { isRecord } from '../resource/values';
import { buildMcpAppInnerSandbox } from '../sandbox/policy';
import type { useMcpAppState } from '../session/useMcpAppState';
import { standardMcpAppStyles } from '../theme';
import type { ResolvedMcpAppSandboxProxy } from '../types';
import { contentBlocksToChatInput } from './chat-input';
import {
  getErrorMessage,
  isHttpUrl,
  jsonRpcError,
  jsonRpcResult,
  normalizeJsonRpcMessage,
} from './protocol';

type McpAppBridgeOptions = Pick<
  ReturnType<typeof useMcpAppState>,
  | 'initializedRef'
  | 'displayMode'
  | 'containerRef'
  | 'height'
  | 'iframeRef'
  | 'srcDoc'
  | 'resource'
  | 'setHeight'
  | 'teardownStartedRef'
  | 'runtimeAppInstanceTokenRef'
  | 'pendingApprovalRef'
  | 'setIsTornDown'
  | 'setError'
  | 'modelContextRef'
> &
  Pick<ReturnType<typeof useMcpAppResource>, 'sendInitialToolNotifications'> &
  Pick<
    ReturnType<typeof useMcpAppApprovals>,
    'clearPendingApproval' | 'dispatchHostRpc'
  > & {
    postToApp: (message: unknown) => void;
    sandboxProxy: ResolvedMcpAppSandboxProxy | null;
    data: TMessageComponentMcpAppData;
    messageId: string | undefined;
    client: StreamContextType['client'];
    i18n: ReturnType<typeof useChatkitTranslation>['i18n'];
    callHostRpc: (request: JsonRpcRequest) => Promise<unknown>;
    submit: StreamContextType['submit'];
    threadId: StreamContextType['threadId'];
    conversationId: StreamContextType['conversationId'];
    streamIsLoading: boolean;
  };

export function useMcpAppBridge({
  initializedRef,
  postToApp,
  displayMode,
  containerRef,
  height,
  iframeRef,
  sandboxProxy,
  srcDoc,
  resource,
  data,
  sendInitialToolNotifications,
  setHeight,
  teardownStartedRef,
  runtimeAppInstanceTokenRef,
  messageId,
  pendingApprovalRef,
  client,
  clearPendingApproval,
  setIsTornDown,
  setError,
  i18n,
  callHostRpc,
  modelContextRef,
  submit,
  threadId,
  conversationId,
  streamIsLoading,
  dispatchHostRpc,
}: McpAppBridgeOptions) {
  const { openProject } = useWorkbench();
  React.useEffect(() => {
    if (!initializedRef.current) return;
    postToApp({
      jsonrpc: '2.0',
      method: 'ui/notifications/host-context-changed',
      params: {
        displayMode,
        containerDimensions: getContainerDimensions(containerRef.current),
      },
    });
  }, [displayMode, height, postToApp]);

  React.useEffect(() => {
    const notifyTheme = () => {
      if (!initializedRef.current) return;
      const theme = buildMcpAppTheme(containerRef.current);
      postToApp({
        jsonrpc: '2.0',
        method: 'ui/notifications/host-context-changed',
        params: {
          theme: theme.mode,
          styles: { variables: standardMcpAppStyles(theme.cssVariables) },
          themeCssVariables: theme.cssVariables,
        },
      });
    };
    const observer = new MutationObserver(notifyTheme);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['style', 'class', 'data-theme'],
    });
    return () => observer.disconnect();
  }, [postToApp]);

  React.useEffect(() => {
    const handleMessage = async (event: MessageEvent) => {
      if (event.source !== iframeRef.current?.contentWindow) {
        return;
      }
      if (sandboxProxy && event.origin !== sandboxProxy.origin) {
        return;
      }

      const request = normalizeJsonRpcMessage(event.data);
      if (!request?.method) {
        return;
      }

      if (
        request.method === 'ui/notifications/sandbox-proxy-ready' &&
        sandboxProxy &&
        srcDoc
      ) {
        const permissions = resource?.permissions ?? data.permissions;
        const csp = resource?.csp ?? data.csp;
        postToApp({
          jsonrpc: '2.0',
          method: 'ui/notifications/sandbox-resource-ready',
          params: {
            html: srcDoc,
            sandbox: buildMcpAppInnerSandbox(sandboxProxy.dedicatedOrigin),
            ...(csp ? { csp } : {}),
            ...(permissions ? { permissions } : {}),
          },
        });
        return;
      }

      if (request.method === 'ui/notifications/initialized') {
        initializedRef.current = true;
        sendInitialToolNotifications();
        return;
      }

      if (request.method === 'ui/notifications/size-changed') {
        const nextHeight =
          isRecord(request.params) && typeof request.params.height === 'number'
            ? request.params.height
            : null;
        if (nextHeight !== null) {
          setHeight(Math.min(900, Math.max(240, Math.round(nextHeight))));
        }
        return;
      }

      if (request.method === 'ui/notifications/request-teardown') {
        if (teardownStartedRef.current) {
          return;
        }
        teardownStartedRef.current = true;
        postToApp({
          jsonrpc: '2.0',
          id: `xpert-teardown-${data.appInstanceId}`,
          method: 'ui/resource-teardown',
          params: { reason: 'app-requested' },
        });
        const query = buildMcpAppReviveQuery(data, {
          appInstanceToken: runtimeAppInstanceTokenRef.current,
          messageId,
        });
        const approval = pendingApprovalRef.current;
        try {
          if (approval) {
            await client.mcp.apps.reject(
              data.appInstanceId,
              approval.approvalId,
              query,
            );
          }
          await client.mcp.apps.teardown(data.appInstanceId, query);
          clearPendingApproval();
          setIsTornDown(true);
        } catch (teardownError) {
          teardownStartedRef.current = false;
          setError(getErrorMessage(teardownError));
        }
        return;
      }

      if (request.method === 'ui/initialize') {
        initializedRef.current = true;
        const permissions = resource?.permissions ?? data.permissions;
        const csp = resource?.csp ?? data.csp;
        const rawToolInfo =
          resource?.toolInfo ?? normalizeMcpAppToolInfo(undefined, data);
        // Standard MCP Tool fields are strings even when resource presentation
        // metadata carries translations. Localize at the protocol boundary.
        const toolInfo = {
          ...rawToolInfo,
          tool: {
            ...rawToolInfo.tool,
            title:
              resolveLocalizedText(rawToolInfo.tool.title, i18n.language) ??
              rawToolInfo.tool.name,
            description: resolveLocalizedText(
              rawToolInfo.tool.description,
              i18n.language,
            ) ?? undefined,
          },
        };
        const theme = buildMcpAppTheme(containerRef.current);
        const hostLocale = normalizeHostLocale(i18n.language);
        const hostLanguage = getLocaleLanguage(hostLocale);
        const hostDirection = getLocaleDirection(hostLocale);
        postToApp(
          jsonRpcResult(request.id, {
            protocolVersion: '2026-01-26',
            hostInfo: {
              name: 'xpert-chatkit',
              version: '1.0.0',
              title: 'Xpert ChatKit',
            },
            hostCapabilities: {
              serverTools: {},
              serverResources: {},
              openLinks: {},
              ...(openProject
                ? { experimental: { 'xpert/workbench': { openProject: true } } }
                : {}),
              logging: {},
              message: {
                text: {},
                image: {},
                audio: {},
                resource: {},
                resourceLink: {},
              },
              updateModelContext: {
                text: {},
                structuredContent: {},
              },
              sandbox: {
                ...(permissions ? { permissions } : {}),
                ...(csp ? { csp } : {}),
              },
              downloadFile: {},
            },
            hostContext: {
              toolInfo,
              theme: theme.mode,
              styles: {
                variables: standardMcpAppStyles(theme.cssVariables),
              },
              themeCssVariables: theme.cssVariables,
              locale: hostLocale,
              language: hostLanguage,
              direction: hostDirection,
              timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
              displayMode,
              availableDisplayModes: ['inline', 'fullscreen', 'pip'],
              containerDimensions: getContainerDimensions(containerRef.current),
              userAgent: 'xpert-chatkit',
              platform: 'web',
              deviceCapabilities: {
                touch: navigator.maxTouchPoints > 0,
                hover:
                  typeof window.matchMedia === 'function'
                    ? window.matchMedia('(hover: hover)').matches
                    : false,
              },
            },
            // Legacy compatibility for apps written before the 2026-01-26 result shape.
            capabilities: {
              displayModes: ['inline', 'fullscreen', 'pip'],
              serverTools: true,
              serverResources: true,
              openLinks: true,
            },
            context: {
              toolInfo,
              theme: theme.mode,
              themeCssVariables: theme.cssVariables,
              locale: hostLocale,
              language: hostLanguage,
              direction: hostDirection,
              timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
              displayMode,
              availableDisplayModes: ['inline', 'fullscreen', 'pip'],
              containerDimensions: getContainerDimensions(containerRef.current),
              userAgent: navigator.userAgent,
              platform: navigator.platform,
            },
          }),
        );
        sendInitialToolNotifications();
        return;
      }

      if (request.method === 'ui/open-link') {
        const href =
          isRecord(request.params) && typeof request.params.url === 'string'
            ? request.params.url
            : isRecord(request.params) &&
                typeof request.params.href === 'string'
              ? request.params.href
              : null;
        const projectLink = href ? parseMcpAppProjectLink(href) : null;
        if (projectLink) {
          try {
            const response = await openProject?.(
              projectLink.projectId,
              projectLink.viewKey,
            );
            if (!isRecord(response) || response.success !== true) {
              postToApp(
                jsonRpcError(
                  request.id,
                  i18n.t('message.mcpApp.openProjectFailed'),
                ),
              );
            } else {
              postToApp(jsonRpcResult(request.id, {}));
            }
          } catch (cause) {
            postToApp(jsonRpcError(request.id, getErrorMessage(cause)));
          }
          return;
        }
        if (!href || !isHttpUrl(href)) {
          if (request.id !== undefined) {
            postToApp(jsonRpcError(request.id, 'Invalid URL'));
          }
          return;
        }
        try {
          const response = await callHostRpc({
            ...request,
            params: { url: href },
          });
          if (isMcpAppRpcSuccess(response)) {
            window.open(href, '_blank', 'noopener,noreferrer');
          }
          postToApp(response);
        } catch (linkError) {
          postToApp(jsonRpcError(request.id, getErrorMessage(linkError)));
        }
        return;
      }

      if (request.method === 'ui/update-model-context') {
        try {
          const response = await callHostRpc(request);
          if (isMcpAppRpcSuccess(response)) {
            modelContextRef.current = request.params;
          }
          postToApp(response);
        } catch (rpcError) {
          postToApp(jsonRpcError(request.id, getErrorMessage(rpcError)));
        }
        return;
      }

      if (request.method === 'ui/message') {
        try {
          if (
            !isRecord(request.params) ||
            request.params.role !== 'user' ||
            !Array.isArray(request.params.content)
          ) {
            throw new Error(
              'ui/message params must include role "user" and content blocks',
            );
          }

          const hostResponse = await callHostRpc(request);
          if (isRecord(hostResponse) && hostResponse.error) {
            postToApp(hostResponse);
            return;
          }

          const continuation = readAppContinuation(hostResponse);
          if (continuation) {
            if (continuation.toolCallId !== data.toolCallId)
              throw new Error('App continuation tool mismatch');
            const messageInput = contentBlocksToChatInput(
              request.params.content,
            );
            await resumeAfterTool(
              { client, submit, threadId, conversationId },
              continuation.toolCallId,
              continuation.executionId,
              messageInput.input,
              messageInput.files,
            );
            postToApp(hostResponse);
            return;
          }

          const messageInput = contentBlocksToChatInput(request.params.content);

          await submit(
            {
              input: {
                input: messageInput.input,
                ...(messageInput.files.length
                  ? { files: messageInput.files }
                  : {}),
              },
            },
            {
              ...(streamIsLoading ? { followUpMode: 'queue' as const } : {}),
              context: {
                mcpApp: {
                  appInstanceId: data.appInstanceId,
                  resourceUri: data.resourceUri,
                  toolName: data.toolName,
                  toolCallId: data.toolCallId,
                  modelContext: modelContextRef.current,
                },
              },
            },
          );

          postToApp(hostResponse);
        } catch (messageError) {
          postToApp(jsonRpcError(request.id, getErrorMessage(messageError)));
        }
        return;
      }

      if (request.id === undefined && request.method.startsWith('ui/')) {
        return;
      }

      await dispatchHostRpc(request);
    };

    window.addEventListener('message', handleMessage);
    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, [
    callHostRpc,
    clearPendingApproval,
    client,
    data,
    dispatchHostRpc,
    openProject,
    displayMode,
    i18n.language,
    messageId,
    postToApp,
    resource?.csp,
    resource?.permissions,
    resource?.toolInfo,
    sandboxProxy,
    sendInitialToolNotifications,
    srcDoc,
    streamIsLoading,
    threadId,
    conversationId,
    submit,
  ]);
}
