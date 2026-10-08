import {
  ASSISTANT_CHAT_SEND_MESSAGE_COMMAND,
  ASSISTANT_CONTEXT_SET_COMMAND,
  type XpertExtensionViewManifest,
  type XpertViewQuery,
} from '@xpert-ai/xpert-sdk';
import * as React from 'react';
import type { useParentMessenger } from '../../../hooks/useParentMessenger';
import type { useChatkitTranslation } from '../../../i18n/useChatkitTranslation';
import { buildHumanMessageInputPayload } from '../../../lib/references';
import { buildInjectedRequestOptions } from '../../../lib/request-options';
import { createMessageId } from '../../../lib/utils';
import type { useStreamContext } from '../../../providers/Stream';
import type { WorkbenchPreview } from '../../preview/types';
import {
  executeWorkbenchCommand,
  unsupportedCommand,
} from '../../client-commands';
import {
  parseChatMessagePayload,
  parseContextSetPayload,
} from '../../message-command-payload';
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
  onRequestContextChange: WorkbenchShellProps['onRequestContextChange'];
  contextsRef: React.RefObject<Map<string, WorkbenchAssistantContext>>;
  t: ReturnType<typeof useChatkitTranslation>['t'];
  options: WorkbenchShellProps['options'];
  stream: ReturnType<typeof useStreamContext>;
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
  openExecution: ReturnType<typeof useLocalExecutionNavigation>;
};

export function useWorkbenchClientCommands({
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
  openExecution,
}: WorkbenchClientCommandsOptions) {
  const contextKey = JSON.stringify([
    stream.apiUrl,
    stream.organizationId,
    stream.assistantId,
    stream.projectId,
    stream.conversationId,
  ]);
  const currentContext = React.useRef({ key: contextKey });
  if (currentContext.current.key !== contextKey)
    currentContext.current = { key: contextKey };
  const publishContexts = React.useCallback(() => {
    onRequestContextChange(buildWorkbenchRequestContext(contextsRef.current));
  }, [onRequestContextChange]);

  const executeClientCommand = React.useCallback(
    async (
      commandKey: string,
      payload: unknown,
      manifest: Pick<XpertExtensionViewManifest, 'key'>,
      resourceCard?: { messageId: string; id: string },
    ): Promise<unknown> => {
      const context = currentContext.current;
      if (commandKey === ASSISTANT_CONTEXT_SET_COMMAND) {
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
        if (message.newThread) stream.reset(null);
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
        commandKey,
        payload,
        hostType: 'agent' as const,
        hostId: stream.assistantId,
        viewKey: manifest.key,
      };
      return executeWorkbenchCommand(request, {
        apiUrl: stream.apiUrl,
        isCurrent: () => currentContext.current === context,
        openView: (key, query) => {
          if (!views.some((view) => view.key === key)) return false;
          setViewQueries((current) => ({ ...current, [key]: query }));
          selectView(key);
          setOpen(true);
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
      options?.request,
      openPreview,
      views,
      selectView,
      setOpen,
      setExpanded,
      isNarrow,
      onNavigate,
      openExecution,
      options?.workbench?.onClientCommand,
      parentMessenger,
      publishContexts,
      stream,
      t,
    ],
  );
  return { executeClientCommand };
}
