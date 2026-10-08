import type { ChatKitOptions, ProjectSelection } from '@xpert-ai/chatkit-types';
import * as React from 'react';
import { useConversationBranch } from '../../../hooks/useConversationBranch';
import type { ThreadItem } from '../../../hooks/useThreads';
import { buildHumanMessageInputPayload } from '../../../lib/references';
import { buildInjectedRequestOptions } from '../../../lib/request-options';
import { createMessageId } from '../../../lib/utils';
import type { HumanMessageWithMeta } from '../../thread/MessageList';
import type { useChatDraft } from '../composer/useChatDraft';
import { mergeSubmittedFiles } from '../files/file-utils';
import type { useChatFiles } from '../files/useChatFiles';
import type { useChatHistory } from '../history/useChatHistory';
import type { useRuntimeCapabilitiesState } from '../runtime-capabilities';
import type { useChatBranchState } from './useChatBranchState';
import type { useChatEnvironment } from './useChatEnvironment';
import type { ChatProps } from '../types';

type ChatConversationActionsOptions = Pick<
  ReturnType<typeof useChatDraft>,
  | 'composerPartsRef'
  | 'commitComposerParts'
  | 'setThreadMention'
  | 'setSelectedTool'
  | 'composerInputRef'
  | 'setComposerText'
  | 'focusComposerAt'
> &
  Pick<
    ReturnType<typeof useChatFiles>,
    'attachmentsRef' | 'setReferences' | 'setReferencedWorkspaceFiles'
  > &
  Pick<
    ReturnType<typeof useRuntimeCapabilitiesState>,
    'resetRunRuntimeCapabilities' | 'setRuntimeCapabilityPalette'
  > &
  Pick<
    ReturnType<typeof useChatEnvironment>,
    | 'stream'
    | 'missingConfig'
    | 'setHistoryError'
    | 'missingConfigShortMessage'
    | 'isHistoryLoading'
    | 'activeProjectId'
    | 't'
  > &
  Pick<
    ReturnType<typeof useChatBranchState>,
    | 'activeBranchRef'
    | 'setEditingMessageId'
    | 'editRequestRef'
    | 'setIsChangingBranch'
  > &
  Pick<
    ReturnType<typeof useChatHistory>,
    'refreshThreads' | 'deleteThread' | 'messageHistory'
  > & {
    onConnectorsChange: ((connectorBindingIds: string[]) => void) | undefined;
    onProjectChange: ChatProps['onProjectChange'];
    isPromptEditDisabled: boolean;
    configuredProjectId: string | undefined;
    options: ChatKitOptions | null | undefined;
  };

export function useChatConversationActions({
  composerPartsRef,
  commitComposerParts,
  attachmentsRef,
  setReferences,
  setReferencedWorkspaceFiles,
  setThreadMention,
  setSelectedTool,
  resetRunRuntimeCapabilities,
  stream,
  onConnectorsChange,
  onProjectChange,
  activeBranchRef,
  setEditingMessageId,
  composerInputRef,
  refreshThreads,
  isPromptEditDisabled,
  setComposerText,
  setRuntimeCapabilityPalette,
  focusComposerAt,
  missingConfig,
  setHistoryError,
  missingConfigShortMessage,
  isHistoryLoading,
  activeProjectId,
  configuredProjectId,
  t,
  deleteThread,
  messageHistory,
  editRequestRef,
  setIsChangingBranch,
  options,
}: ChatConversationActionsOptions) {
  const previousProjectRef = React.useRef(activeProjectId);
  React.useLayoutEffect(() => {
    if (previousProjectRef.current === activeProjectId) return;
    previousProjectRef.current = activeProjectId;
    commitComposerParts(
      composerPartsRef.current.filter((part) => part.type === 'text'),
      {
        resetDom: true,
        syncRemovedCapabilityTokens: false,
      },
    );
    attachmentsRef.current?.clear();
    setReferences([]);
    setReferencedWorkspaceFiles([]);
    setThreadMention(null);
    setSelectedTool(null);
    setEditingMessageId(null);
    editRequestRef.current = null;
    activeBranchRef.current = null;
    setIsChangingBranch(false);
    setHistoryError(null);
    setRuntimeCapabilityPalette(null);
    resetRunRuntimeCapabilities();
    // The stream clears local connector state. Do not mutate the previous
    // conversation's persisted bindings while changing the active project.
  }, [activeProjectId, commitComposerParts, resetRunRuntimeCapabilities]);

  const handleProjectSelectionChange = React.useCallback(
    (projectId: string | null, selection?: ProjectSelection) => {
      const navigation = {
        resumeLatestConversation: selection?.mode !== 'auto-new',
      };
      // Existing conversations retain their stored project and Connector bindings.
      if (stream.threadId || stream.conversationId) {
        onProjectChange?.(projectId, selection, navigation);
        return;
      }
      const textParts = composerPartsRef.current.filter(
        (part) => part.type === 'text',
      );
      commitComposerParts(textParts, {
        resetDom: true,
        syncRemovedCapabilityTokens: false,
      });
      attachmentsRef.current?.clear();
      setReferences([]);
      setReferencedWorkspaceFiles([]);
      setThreadMention(null);
      setSelectedTool(null);
      resetRunRuntimeCapabilities();
      void stream.setConnectorBindingIds([]).catch((persistError) => {
        console.warn(
          '[Chat] Failed to clear connector selection before changing project:',
          persistError,
        );
      });
      onConnectorsChange?.([]);
      onProjectChange?.(projectId, selection, navigation);
    },
    [
      commitComposerParts,
      onProjectChange,
      onConnectorsChange,
      resetRunRuntimeCapabilities,
      stream,
    ],
  );

  const conversationBranch = useConversationBranch({
    client: stream.client,
    conversationId: stream.conversationId,
    threadId: stream.threadId,
    navigate: async (threadId) => {
      activeBranchRef.current = threadId;
      stream.reset(threadId, []);
      await stream.loadThread(threadId);
    },
    onReady: () => {
      commitComposerParts([], {
        resetDom: true,
        syncRemovedCapabilityTokens: false,
      });
      attachmentsRef.current?.clear();
      setReferences([]);
      setReferencedWorkspaceFiles([]);
      setThreadMention(null);
      setSelectedTool(null);
      setEditingMessageId(null);
      resetRunRuntimeCapabilities();
      requestAnimationFrame(() => composerInputRef.current?.focus());
    },
    refresh: refreshThreads,
  });

  const handlePromptEdit = React.useCallback(
    (prompt: string) => {
      if (isPromptEditDisabled) return;
      setComposerText(prompt, prompt.length);
      setRuntimeCapabilityPalette(null);
      focusComposerAt(prompt.length);
    },
    [
      focusComposerAt,
      isPromptEditDisabled,
      setComposerText,
      setRuntimeCapabilityPalette,
    ],
  );

  const loadThreadHistory = React.useCallback(
    async (threadId: string) => {
      if (missingConfig) {
        setHistoryError(missingConfigShortMessage);
        return;
      }
      setHistoryError(null);
      try {
        await stream.loadThread(threadId);
      } catch {
        // Stream history state supplies the error and retry action.
      }
    },
    [missingConfig, missingConfigShortMessage, stream],
  );

  const handleNewThread = async () => {
    if (missingConfig || isHistoryLoading) return;
    setHistoryError(null);
    try {
      const hadSelectedConnectors = stream.connectorBindingIds.length > 0;
      if (activeProjectId) {
        onProjectChange?.(activeProjectId, {
          mode: 'existing',
          projectId: activeProjectId,
        });
      } else if (configuredProjectId && stream.projectScopeResolved) {
        onProjectChange?.(null, { mode: 'none' });
      }
      stream.reset(null, []);
      if (hadSelectedConnectors) onConnectorsChange?.([]);
    } catch (err) {
      console.warn('Failed to create thread', err);
      setHistoryError(
        err instanceof Error ? err.message : t('chat.errors.createThread'),
      );
    }
  };

  const handleSelectThread = (thread: ThreadItem) => {
    if (isHistoryLoading) return;
    setHistoryError(null);
    if (thread.id !== stream.threadId) stream.reset(thread.id, []);
    void loadThreadHistory(thread.id);
  };

  const handleDeleteThread = async (thread: ThreadItem) => {
    setHistoryError(null);
    await deleteThread(thread.recordId);
    messageHistory.remove(thread.recordId);
    if (stream.threadId === thread.id) stream.reset(null, []);
    messageHistory.refresh();
    await refreshThreads();
  };

  const saveEditedMessage = async (
    message: Omit<HumanMessageWithMeta, 'content' | 'type'>,
    text: string,
  ) => {
    const sourceThreadId = stream.threadId;
    if (!sourceThreadId || !message.id) return;
    const request =
      editRequestRef.current?.messageId === message.id
        ? editRequestRef.current
        : { messageId: message.id, requestId: createMessageId() };
    editRequestRef.current = request;
    setIsChangingBranch(true);
    try {
      const branch = await stream.client.threads.copy(sourceThreadId, {
        beforeMessageId: message.id,
        requestId: request.requestId,
      });
      if (activeBranchRef.current !== sourceThreadId) return;
      // Read fresh run identity: the branch list may still show a finished run.
      const source = await stream.client.threads.get(sourceThreadId);
      if (activeBranchRef.current !== sourceThreadId) return;
      if (source.status === 'busy') {
        if (!source.runControl?.executionId) {
          throw new Error(t('threadControl.sourcePauseUnavailable'));
        }
        try {
          await stream.pauseRun(source.runControl.executionId);
        } catch (error) {
          // Completion or another pause can win the race with this request.
          // Continue only after verifying the source is no longer running.
          const latest = await stream.client.threads
            .get(sourceThreadId)
            .catch(() => null);
          if (!latest || latest.status === 'busy') throw error;
        }
      }
      if (activeBranchRef.current !== sourceThreadId) return;
      // A pause acknowledgement is enough; an in-flight tool can finish while
      // the new branch starts. Detaching the stream must not cancel that tool.
      activeBranchRef.current = branch.thread_id;
      stream.reset(branch.thread_id, []);
      await stream.loadThread(branch.thread_id);
      if (activeBranchRef.current !== branch.thread_id) return;
      const humanInput = buildHumanMessageInputPayload({
        content: text,
        references: message.references,
        referenceComposition: 'compose',
      });
      if (!humanInput) return;
      const files = mergeSubmittedFiles(
        message.fileAssets ?? [],
        message.attachments ?? [],
      );
      const edited: HumanMessageWithMeta = {
        ...message,
        type: 'human',
        id: createMessageId(),
        content: text,
        submittedInput: humanInput.input,
        referenceComposition: humanInput.referenceComposition,
      };
      const input = {
        ...humanInput,
        ...(files.length ? { files } : {}),
        ...(message.runtimeCapabilities
          ? { runtimeCapabilities: message.runtimeCapabilities }
          : {}),
        ...(message.model ? { model: message.model } : {}),
      };
      const requestOptions = buildInjectedRequestOptions({
        defaults: options?.request,
        humanInput: input,
      });
      setEditingMessageId(null);
      setIsChangingBranch(false);
      const submission = stream.submit(
        {
          id: edited.id,
          input,
          ...(requestOptions.state ? { state: requestOptions.state } : {}),
        },
        {
          threadId: branch.thread_id,
          joinExistingThread: true,
          ...(requestOptions.context
            ? { context: requestOptions.context }
            : {}),
          ...(requestOptions.config ? { config: requestOptions.config } : {}),
          optimisticValues: (previous) => ({
            ...previous,
            messages: [...(previous.messages ?? []), edited],
          }),
        },
      );
      void submission.catch((error) => {
        setHistoryError(error instanceof Error ? error.message : String(error));
      });
    } finally {
      setIsChangingBranch(false);
    }
  };
  return {
    conversationBranch,
    handleNewThread,
    handleSelectThread,
    handleDeleteThread,
    loadThreadHistory,
    handlePromptEdit,
    saveEditedMessage,
    handleProjectSelectionChange,
  };
}
