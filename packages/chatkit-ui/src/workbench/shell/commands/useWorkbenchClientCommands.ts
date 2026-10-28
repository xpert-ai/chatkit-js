import { contentTabKey, contentViewKey } from '../../content/tab-identity';
import {
  executeContentCommand,
  isContentCommand,
  type ReviewSession,
} from '../../content/commands';
import { ContentReview } from '../../content/ContentReview';
import type { EditorLifecycle } from '../../editors/editor-lifecycle';
import {
  ASSISTANT_CHAT_SEND_MESSAGE_COMMAND,
  ASSISTANT_CONTEXT_SET_COMMAND,
  type XpertExtensionViewManifest,
  type XpertViewQuery,
} from '@xpert-ai/xpert-sdk';
import * as React from 'react';
import type { ResourceCardOpenTarget } from '@xpert-ai/chatkit-types';
import type { useParentMessenger } from '../../../hooks/useParentMessenger';
import type { useChatkitTranslation } from '../../../i18n/useChatkitTranslation';
import { buildHumanMessageInputPayload } from '../../../lib/references';
import { buildInjectedRequestOptions } from '../../../lib/request-options';
import { createMessageId } from '../../../lib/utils';
import type { WorkbenchRuntime } from '../../WorkbenchRuntime';
import type { WorkbenchPreview } from '../../preview/types';
import { ViewFilePreviewAccess } from '../../remote-view/view-file-preview-access';
import {
  executeWorkbenchCommand,
  unsupportedCommand,
} from '../../client-commands';
import {
  parseChatMessagePayload,
  parseContextSetPayload,
} from '../../message-command-payload';
import type { useMessageFocus } from '../../useMessageFocus';
import type { useLocalExecutionNavigation } from '../../useLocalExecutionNavigation';
import type { useWorkbenchLayout } from '../../useWorkbenchLayout';
import type { useWorkbenchViews } from '../../useWorkbenchViews';
import type { useWorkbenchViewTabs } from '../../useWorkbenchViewTabs';
import type { WorkbenchAssistantContext, WorkbenchShellProps } from '../types';
import {
  buildWorkbenchRequestContext,
  getErrorMessage,
} from './request-context';

type WorkbenchClientCommandsOptions = {
  editors: EditorLifecycle;
  viewQueries: Record<string, XpertViewQuery>;
  closeView: (key: string) => void;
  rememberViewNavigation: (target: ResourceCardOpenTarget) => void;
  onRequestContextChange: WorkbenchShellProps['onRequestContextChange'];
  contextsRef: React.RefObject<Map<string, WorkbenchAssistantContext>>;
  t: ReturnType<typeof useChatkitTranslation>['t'];
  options: WorkbenchShellProps['options'];
  stream: WorkbenchRuntime;
  setNotification: React.Dispatch<
    React.SetStateAction<{ level: 'success' | 'error'; message: string } | null>
  >;
  views: ReturnType<typeof useWorkbenchViews>['views'];
  setViewQueries: React.Dispatch<
    React.SetStateAction<Record<string, XpertViewQuery>>
  >;
  selectView: ReturnType<typeof useWorkbenchViewTabs>['selectView'];
  setOpen: ReturnType<typeof useWorkbenchLayout>['setOpen'];
  openPreview: (preview: WorkbenchPreview) => void;
  setExpanded: ReturnType<typeof useWorkbenchLayout>['setExpanded'];
  isNarrow: boolean;
  parentMessenger: ReturnType<typeof useParentMessenger>;
  onNavigate: WorkbenchShellProps['onNavigate'];
  openMessage: ReturnType<typeof useMessageFocus>;
  openExecution: ReturnType<typeof useLocalExecutionNavigation>;
};

export function useWorkbenchClientCommands({
  editors,
  viewQueries,
  closeView,
  rememberViewNavigation,
  onRequestContextChange,
  contextsRef,
  t,
  options,
  stream,
  setNotification,
  views,
  setViewQueries,
  selectView,
  setOpen,
  openPreview,
  setExpanded,
  isNarrow,
  parentMessenger,
  onNavigate,
  openMessage,
  openExecution,
}: WorkbenchClientCommandsOptions) {
  const [review, setReview] = React.useState<{
    id: string;
    scope: string;
    session: ReviewSession;
  } | null>(null);
  const queriesRef = React.useRef(viewQueries);
  queriesRef.current = viewQueries;
  const contextKey = JSON.stringify([
    stream.apiUrl,
    stream.organizationId,
    stream.assistantId,
    stream.projectId,
    stream.conversationId,
  ]);
  const assistantScope = JSON.stringify([
    stream.apiUrl,
    stream.organizationId,
    stream.assistantId,
  ]);
  const navigationScope = JSON.stringify([
    stream.apiUrl,
    stream.organizationId,
    stream.assistantId,
    stream.projectId,
  ]);
  const filePreviews = React.useMemo(
    () => new ViewFilePreviewAccess(stream.client.viewHosts),
    [stream.client],
  );
  React.useEffect(
    () => () => filePreviews.clear(),
    [filePreviews, contextKey, stream.runtimeScopeReady],
  );
  const fileScopeReady = React.useRef(true);
  fileScopeReady.current = stream.runtimeScopeReady !== false;
  const currentContext = React.useRef({
    key: contextKey,
    navigationScope,
    assistantScope,
    projectId: stream.projectId,
    conversationId: stream.conversationId,
  });
  if (currentContext.current.key !== contextKey)
    currentContext.current = {
      key: contextKey,
      navigationScope,
      assistantScope,
      projectId: stream.projectId,
      conversationId: stream.conversationId,
    };
  const publishContexts = React.useCallback(() => {
    onRequestContextChange(buildWorkbenchRequestContext(contextsRef.current));
  }, [onRequestContextChange, contextsRef]);

  const executeClientCommand = React.useCallback(
    async (
      commandKey: string,
      payload: unknown,
      manifest: Pick<XpertExtensionViewManifest, 'key'>,
      resourceCard?: { messageId: string; id: string },
    ): Promise<unknown> => {
      const context = currentContext.current;
      const userActivated = navigator.userActivation?.isActive === true;
      if (isContentCommand(commandKey)) {
        if (
          stream.runtimeScopeReady === false ||
          !stream.projectId ||
          !stream.client.content
        )
          return { success: false, code: 'content_unavailable' };
        return executeContentCommand(commandKey, payload, {
          api: stream.client.content,
          scope: {
            assistantId: stream.assistantId,
            projectId: stream.projectId,
          },
          viewKey: manifest.key,
          editors,
          isCurrent: () => currentContext.current === context,
          close: closeView,
          review: (session) =>
            setReview({ id: crypto.randomUUID(), scope: context.key, session }),
          linkBaseUrl: options?.workbench?.linkBaseUrl,
          copy: async (url) => {
            try {
              await navigator.clipboard.writeText(url);
              return true;
            } catch {
              return false;
            }
          },
        });
      }
      if (commandKey === ASSISTANT_CONTEXT_SET_COMMAND) {
        if (stream.group) return unsupportedCommand(commandKey);
        const parsed = parseContextSetPayload(payload);
        if (!parsed.key) {
          throw new Error(t('workbench.errors.contextKeyRequired'));
        }
        if (parsed.clear) {
          contextsRef.current.delete(parsed.key);
        } else {
          contextsRef.current.set(parsed.key, {
            ...(parsed.env ? { env: parsed.env } : {}),
            ...(parsed.context ? { context: parsed.context } : {}),
          });
        }
        publishContexts();
        return {
          success: true,
          status: parsed.clear ? 'cleared' : 'updated',
          key: parsed.key,
        };
      }

      if (commandKey === ASSISTANT_CHAT_SEND_MESSAGE_COMMAND) {
        const message = parseChatMessagePayload(payload);
        if (stream.group) {
          if ((await stream.group.sendMessage(message)) === false)
            return unsupportedCommand(commandKey);
          return { success: true, status: 'sent', threadId: stream.threadId };
        }
        if (!stream.submit) return unsupportedCommand(commandKey);
        const humanInput = buildHumanMessageInputPayload({
          content: message.text,
          references: message.references,
          referenceComposition: message.referenceComposition,
        });
        if (!humanInput) {
          throw new Error(t('workbench.errors.messageRequired'));
        }
        const input = {
          ...humanInput,
          ...(message.files.length > 0 ? { files: message.files } : {}),
          ...(message.planMode ? { planMode: true } : {}),
          ...(message.runtimeCapabilities
            ? { runtimeCapabilities: message.runtimeCapabilities }
            : {}),
        };
        const requestOptions = buildInjectedRequestOptions({
          defaults: options?.request,
          state: message.state,
          humanInput: input,
        });
        const messageId = message.clientMessageId ?? createMessageId();
        if (message.newThread) {
          if (!(await editors.prepare()))
            return { success: false, code: 'unsaved_changes' };
          if (currentContext.current !== context)
            return { success: false, code: 'stale_context' };
          stream.reset?.(null);
        }
        const followUpMode =
          stream.isLoading && !message.newThread
            ? (message.followUpMode ?? 'queue')
            : undefined;
        void stream
          .submit(
            {
              input,
              ...(requestOptions.state ? { state: requestOptions.state } : {}),
              ...(message.clientMessageId
                ? { id: message.clientMessageId }
                : {}),
            },
            {
              ...(message.newThread ? { newThread: true } : {}),
              ...(followUpMode ? { followUpMode } : {}),
              ...(requestOptions.context
                ? { context: requestOptions.context }
                : {}),
              ...(requestOptions.config
                ? { config: requestOptions.config }
                : {}),
              ...(!followUpMode
                ? {
                    optimisticValues: (previous) => ({
                      ...previous,
                      messages: [
                        ...(previous.messages ?? []),
                        {
                          id: messageId,
                          type: 'human',
                          content: message.text,
                          submittedInput: humanInput.input,
                          ...(message.files.length > 0
                            ? { fileAssets: message.files }
                            : {}),
                          ...(message.references.length > 0
                            ? { references: message.references }
                            : {}),
                          ...(humanInput.referenceComposition
                            ? {
                                referenceComposition:
                                  humanInput.referenceComposition,
                              }
                            : {}),
                          ...(message.runtimeCapabilities
                            ? {
                                runtimeCapabilities:
                                  message.runtimeCapabilities,
                              }
                            : {}),
                        },
                      ],
                    }),
                  }
                : {}),
            },
          )
          .catch((submitError: unknown) => {
            setNotification({
              level: 'error',
              message: getErrorMessage(
                submitError,
                t('workbench.errors.sendFailed'),
              ),
            });
          });
        return {
          success: true,
          status: followUpMode === 'queue' ? 'queued' : 'sent',
          ...(message.clientMessageId
            ? { clientMessageId: message.clientMessageId }
            : {}),
          ...(!message.newThread && stream.threadId
            ? { threadId: stream.threadId }
            : {}),
        };
      }

      const request = {
        ...(resourceCard ? { resourceCard } : {}),
        userActivated,
        commandKey,
        payload,
        hostType: 'agent' as const,
        hostId: stream.assistantId,
        viewKey: manifest.key,
      };
      return executeWorkbenchCommand(request, {
        openExternal: (url) => {
          if (!userActivated) return false;
          const popup = window.open('about:blank', '_blank');
          if (!popup) return false;
          popup.opener = null;
          popup.location.replace(url);
          return true;
        },
        copyText: async (text) => {
          try {
            await navigator.clipboard.writeText(text);
            return true;
          } catch {
            return false;
          }
        },
        prepareLeave: () => editors.prepare(),
        apiUrl: stream.apiUrl,
        resolveFile: (resource) =>
          filePreviews.open(resource, {
            hostId: stream.assistantId,
            viewKey: contentViewKey(manifest.key),
            runtimeScope: {
              projectId: stream.projectId,
              conversationId: stream.conversationId,
            },
            isCurrent: () =>
              currentContext.current === context && fileScopeReady.current,
          }),
        projectId:
          stream.runtimeScopeReady === false ? undefined : stream.projectId,
        isCurrent: (navigation) =>
          currentContext.current === context ||
          Boolean(
            navigation?.target === 'assistant.project' &&
            navigation.projectId &&
            currentContext.current.assistantScope === context.assistantScope &&
            currentContext.current.projectId === navigation.projectId,
          ) ||
          Boolean(
            navigation?.preserveView &&
            currentContext.current.navigationScope ===
              context.navigationScope &&
            currentContext.current.conversationId === navigation.conversationId,
          ),
        forwardUnavailableView: Boolean(options?.workbench?.navigation),
        openView: async (viewKey, query) => {
          const key = contentTabKey(viewKey, query);
          if (
            queriesRef.current[key]?.selectionId &&
            (queriesRef.current[key]?.selectionId !== query.selectionId ||
              query.parameters?.reload)
          ) {
            if (!(await editors.prepare(key)))
              throw new Error(t('contentReview.Unsaved'));
          }
          if (currentContext.current !== context) return false;
          if (!views.some((view) => view.key === viewKey)) return false;
          setViewQueries((current) => ({ ...current, [key]: query }));
          selectView(key);
          setOpen(true);
          // Resource cards already persist after their verified navigation receipt.
          if (!resourceCard)
            rememberViewNavigation({
              target: 'workbench.view',
              viewKey,
              ...(query.selectionId ? { selectionId: query.selectionId } : {}),
              ...(query.parameters ? { parameters: query.parameters } : {}),
            });
          return true;
        },
        openPreview,
        revealChat: () => {
          setExpanded(false);
          if (isNarrow) setOpen(false);
        },
        updateComposer: parentMessenger.updateComposer,
        focusComposer: async () => {
          await new Promise<void>((resolve) =>
            requestAnimationFrame(() => resolve()),
          );
          if (currentContext.current === context)
            await parentMessenger.focusComposer();
        },
        navigate: onNavigate,
        openExecution,
        openMessage,
        forward: async (request) => {
          const onClientCommand = options?.workbench?.onClientCommand;
          if (typeof onClientCommand === 'function')
            return onClientCommand(request);
          if (parentMessenger.isParentAvailable)
            return parentMessenger.sendCommand(
              'onWorkbenchClientCommand',
              request,
            );
          return unsupportedCommand(request.commandKey);
        },
      });
    },
    [
      editors,
      closeView,
      options?.workbench?.linkBaseUrl,
      rememberViewNavigation,
      options?.request,
      openPreview,
      views,
      selectView,
      setOpen,
      setExpanded,
      isNarrow,
      onNavigate,
      openExecution,
      openMessage,
      options?.workbench?.onClientCommand,
      options?.workbench?.navigation,
      parentMessenger,
      publishContexts,
      stream,
      filePreviews,
      contextsRef,
      setNotification,
      setViewQueries,
      t,
    ],
  );
  const activeReview = review?.scope === contextKey ? review.session : null;
  const reviewPanel =
    activeReview && stream.projectId
      ? React.createElement(ContentReview, {
          key: `${contextKey}:${review?.id}`,
          session: activeReview,
          api: stream.client.content,
          scope: {
            assistantId: stream.assistantId,
            projectId: stream.projectId,
          },
          editors,
          close: () => setReview(null),
          reopen: async () => {
            if (!(await editors.prepare(activeReview.viewKey)))
              throw new Error(t('contentReview.Unsaved'));
            setViewQueries((current) => ({
              ...current,
              [activeReview.viewKey]: {
                ...current[activeReview.viewKey],
                selectionId: activeReview.resourceId,
                parameters: {
                  ...current[activeReview.viewKey]?.parameters,
                  reload: Date.now(),
                },
              },
            }));
            selectView(activeReview.viewKey);
          },
          ask: async (text) => {
            const result = await executeClientCommand(
              ASSISTANT_CHAT_SEND_MESSAGE_COMMAND,
              { text },
              { key: activeReview.viewKey },
            );
            if (
              result &&
              typeof result === 'object' &&
              'success' in result &&
              result.success === false
            )
              throw new Error(t('workbench.errors.sendFailed'));
            return result;
          },
        })
      : null;
  return { executeClientCommand, reviewPanel };
}
