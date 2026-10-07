import type {
  ChatKitCommandSource,
  ChatKitOptions,
  ChatKitReference,
  ChatKitReferenceCompositionMode,
} from '@xpert-ai/chatkit-types';
import * as React from 'react';
import {
  createComposerTextParts,
  getComposerThreadReferences,
  getComposerTokenPartMap,
} from '../../../lib/composer-parts';
import {
  buildHumanMessageInputPayload,
  mergeReferences,
} from '../../../lib/references';
import { buildInjectedRequestOptions } from '../../../lib/request-options';
import type { RuntimeCapabilitiesSelection } from '../../../lib/runtime-capabilities';
import { createMessageId } from '../../../lib/utils';
import type { useStreamContext } from '../../../providers/Stream';
import type { HumanMessageWithMeta } from '../../thread/MessageList';
import { mergeSubmittedFiles } from '../files/file-utils';
import type { useChatFiles } from '../files/useChatFiles';
import type { useChatViewport } from '../messages/useChatViewport';
import type { useRuntimeCapabilitiesState } from '../runtime-capabilities';
import type { useChatEnvironment } from '../session/useChatEnvironment';
import type { useChatRunControl } from '../session/useChatRunControl';
import type { useRuntimeResources } from '../useRuntimeResources';
import type { SubmitDraftOptions } from './submission-types';
import type { useChatCapabilities } from './useChatCapabilities';
import type { useChatDraft } from './useChatDraft';

type ChatSubmissionOptions = Pick<
  ReturnType<typeof useChatDraft>,
  | 'trimmedDraft'
  | 'composerPartsRef'
  | 'selectedTool'
  | 'commitComposerParts'
  | 'setThreadMention'
  | 'setSelectedTool'
> &
  Pick<
    ReturnType<typeof useChatFiles>,
    | 'uploadedFiles'
    | 'referencedWorkspaceFiles'
    | 'references'
    | 'attachmentsRef'
    | 'setReferences'
    | 'setReferencedWorkspaceFiles'
  > &
  Pick<ReturnType<typeof useChatEnvironment>, 'stream' | 't'> &
  Pick<ReturnType<typeof useChatRunControl>, 'isRunPaused' | 'clearRunControlError'> &
  Pick<
    ReturnType<typeof useRuntimeCapabilitiesState>,
    | 'getRuntimeCapabilitiesForSubmit'
    | 'effectiveSessionRuntimeCapabilities'
    | 'runRuntimeCapabilities'
    | 'resetRunRuntimeCapabilities'
    | 'addRunRuntimeCapabilities'
    | 'persistSessionRuntimeCapabilities'
  > &
  Pick<ReturnType<typeof useChatCapabilities>, 'promptWorkflow'> &
  Pick<ReturnType<typeof useChatViewport>, 'scrollToBottom'> & {
    isSubmissionBlocked: boolean;
    planModeEnabled: boolean;
    resourcesEnabled: boolean;
    runtimeResources: ReturnType<typeof useRuntimeResources>;
    options: ChatKitOptions | null | undefined;
    messages: ReturnType<typeof useStreamContext>['messages'];
  };

export function useChatSubmission({
  isSubmissionBlocked,
  trimmedDraft,
  uploadedFiles,
  referencedWorkspaceFiles,
  references,
  composerPartsRef,
  stream,
  isRunPaused,
  clearRunControlError,
  planModeEnabled,
  getRuntimeCapabilitiesForSubmit,
  promptWorkflow,
  t,
  resourcesEnabled,
  runtimeResources,
  options,
  effectiveSessionRuntimeCapabilities,
  runRuntimeCapabilities,
  selectedTool,
  commitComposerParts,
  attachmentsRef,
  setReferences,
  setReferencedWorkspaceFiles,
  setThreadMention,
  setSelectedTool,
  resetRunRuntimeCapabilities,
  addRunRuntimeCapabilities,
  persistSessionRuntimeCapabilities,
  scrollToBottom,
  messages,
}: ChatSubmissionOptions) {
  const submitDraft = React.useCallback(
    (submitOptions: SubmitDraftOptions = {}) => {
      if (isSubmissionBlocked) return;

      const contentToSubmit = (submitOptions.inputText ?? trimmedDraft).trim();
      const mergedFiles = mergeSubmittedFiles(
        uploadedFiles,
        referencedWorkspaceFiles,
      );
      const filesToSend = mergedFiles.length > 0 ? mergedFiles : undefined;
      const mergedReferences = mergeReferences(
        references,
        getComposerThreadReferences(composerPartsRef.current),
      );
      const referencesToSend =
        mergedReferences.length > 0 ? mergedReferences : undefined;
      const nextFollowUpMode =
        stream.isLoading && !stream.isDisplayPaused && !isRunPaused
          ? 'queue'
          : undefined;
      const effectivePlanMode = submitOptions.planMode ?? planModeEnabled;
      const humanInput =
        buildHumanMessageInputPayload({
          content: contentToSubmit,
          references: referencesToSend,
        }) ?? (filesToSend ? { input: '' } : null);

      if (!humanInput) {
        return;
      }

      clearRunControlError();

      const {
        runtimeCapabilitiesForSubmit,
        runtimeCapabilityOptionsForMessage,
      } = getRuntimeCapabilitiesForSubmit(
        submitOptions.runtimeCapabilities ??
          promptWorkflow.runtimeCapabilities ??
          undefined,
      );

      const displayContent =
        submitOptions.displayText ||
        contentToSubmit ||
        (referencesToSend || filesToSend
          ? t('chat.referencedContentOnly')
          : '');
      const newMessage: HumanMessageWithMeta = {
        id: createMessageId(),
        type: 'human',
        content: displayContent,
        submittedInput: humanInput.input,
        ...(humanInput.referenceComposition
          ? { referenceComposition: humanInput.referenceComposition }
          : {}),
        ...(runtimeCapabilitiesForSubmit
          ? { runtimeCapabilities: runtimeCapabilitiesForSubmit }
          : {}),
        ...(runtimeCapabilityOptionsForMessage.length > 0
          ? { runtimeCapabilityOptions: runtimeCapabilityOptionsForMessage }
          : {}),
        ...(filesToSend ? { fileAssets: filesToSend } : {}),
        ...(referencesToSend ? { references: referencesToSend } : {}),
        ...(stream.selectedModelId ? { model: stream.selectedModelId } : {}),
      };

      const inputPayload: {
        input: string;
        files?: typeof uploadedFiles;
        references?: ChatKitReference[];
        referenceComposition?: ChatKitReferenceCompositionMode;
        planMode?: boolean;
        runtimeResources?: import('@xpert-ai/chatkit-types').RuntimeResourcesSelection;
        runtimeCapabilities?: RuntimeCapabilitiesSelection;
        commandSource?: ChatKitCommandSource;
        model?: string;
      } = {
        ...humanInput,
        ...(stream.selectedModelId ? { model: stream.selectedModelId } : {}),
      };
      if (
        resourcesEnabled &&
        (runtimeResources.selection.resources.length ||
          runtimeResources.selection.revision)
      )
        inputPayload.runtimeResources = runtimeResources.selection;
      if (filesToSend) {
        inputPayload.files = filesToSend;
      }
      if (effectivePlanMode) {
        inputPayload.planMode = true;
      }
      if (runtimeCapabilitiesForSubmit) {
        inputPayload.runtimeCapabilities = runtimeCapabilitiesForSubmit;
      }
      if (submitOptions.commandSource ?? promptWorkflow.commandSource) {
        inputPayload.commandSource =
          submitOptions.commandSource ?? promptWorkflow.commandSource;
      }

      const requestOptions = buildInjectedRequestOptions({
        defaults: options?.request,
        humanInput: inputPayload,
      });
      const sessionRuntimeCapabilitiesForPersistence =
        effectiveSessionRuntimeCapabilities;
      const shouldPersistSessionRuntimeCapabilities =
        !!sessionRuntimeCapabilitiesForPersistence &&
        !stream.threadId &&
        !nextFollowUpMode;

      const submittedComposerParts = composerPartsRef.current;
      const submittedPromptWorkflow = promptWorkflow.selected;
      promptWorkflow.clear();
      const submittedReferences = references;
      const submittedWorkspaceFiles = referencedWorkspaceFiles;
      const submittedRunRuntimeCapabilities = runRuntimeCapabilities;
      const submittedTool =
        selectedTool && !selectedTool.pinned ? selectedTool : null;

      commitComposerParts([], {
        caretOffset: 0,
        resetDom: true,
        syncRemovedCapabilityTokens: false,
      });
      const rollbackAttachments =
        attachmentsRef.current?.clearWithRollback() ?? (() => undefined);
      setReferences([]);
      setReferencedWorkspaceFiles([]);
      setThreadMention(null);
      if (submittedTool) {
        setSelectedTool(null);
      }
      resetRunRuntimeCapabilities();

      const restoreSubmittedDraft = () => {
        promptWorkflow.restore(submittedPromptWorkflow);
        const currentParts = composerPartsRef.current;
        const currentCapabilities = getComposerTokenPartMap(currentParts);
        const submittedPartsToRestore = submittedComposerParts.filter(
          (part) => part.type === 'text' || !currentCapabilities.has(part.key),
        );
        const separator =
          submittedPartsToRestore.length > 0 && currentParts.length > 0
            ? createComposerTextParts('\n')
            : [];
        commitComposerParts(
          [...submittedPartsToRestore, ...separator, ...currentParts],
          {
            resetDom: true,
            syncRemovedCapabilityTokens: false,
          },
        );
        rollbackAttachments();
        setReferences((current) =>
          mergeReferences(submittedReferences, current),
        );
        setReferencedWorkspaceFiles((current) =>
          mergeSubmittedFiles(submittedWorkspaceFiles, current),
        );
        if (submittedTool) {
          setSelectedTool((current) => current ?? submittedTool);
        }
        addRunRuntimeCapabilities(submittedRunRuntimeCapabilities);
      };

      const resourceSubmission = !nextFollowUpMode
        ? runtimeResources.beginSubmission()
        : undefined;
      const submission = stream.submit(
        {
          id: newMessage.id,
          input: inputPayload,
          ...(requestOptions.state ? { state: requestOptions.state } : {}),
        },
        {
          ...(nextFollowUpMode ? { followUpMode: nextFollowUpMode } : {}),
          ...(requestOptions.context
            ? { context: requestOptions.context }
            : {}),
          ...(requestOptions.config ? { config: requestOptions.config } : {}),
          ...(shouldPersistSessionRuntimeCapabilities || resourceSubmission
            ? {
                onThreadResolved: (
                  threadId: string,
                  conversationId?: string | null,
                ) => {
                  resourceSubmission?.onThreadResolved(
                    threadId,
                    conversationId,
                  );
                  if (shouldPersistSessionRuntimeCapabilities) {
                    return persistSessionRuntimeCapabilities(
                      threadId,
                      sessionRuntimeCapabilitiesForPersistence,
                    );
                  }
                },
              }
            : {}),
          ...(!nextFollowUpMode
            ? {
                optimisticValues: (prev) => {
                  const prevMessages = prev?.messages ?? [];
                  return { ...prev, messages: [...prevMessages, newMessage] };
                },
              }
            : {}),
        },
      );
      void submission.then(
        () => resourceSubmission?.onSettled(true),
        () => {
          resourceSubmission?.onSettled(false);
          restoreSubmittedDraft();
        },
      );

      scrollToBottom(true, true);
    },
    [
      addRunRuntimeCapabilities,
      effectiveSessionRuntimeCapabilities,
      getRuntimeCapabilitiesForSubmit,
      promptWorkflow,
      isSubmissionBlocked,
      isRunPaused,
      clearRunControlError,
      options?.request,
      persistSessionRuntimeCapabilities,
      resourcesEnabled,
      runtimeResources.selection,
      runtimeResources.busy,
      runtimeResources.ready,
      runtimeResources.beginSubmission,
      references,
      referencedWorkspaceFiles,
      resetRunRuntimeCapabilities,
      scrollToBottom,
      selectedTool,
      commitComposerParts,
      planModeEnabled,
      runRuntimeCapabilities,
      stream,
      trimmedDraft,
      uploadedFiles,
      t,
    ],
  );

  const handleRetry = (messageIndex: number) => {
    // Find the last human message before this AI message to resend
    const messagesUpToIndex = messages.slice(0, messageIndex);
    const lastHumanMessage = [...messagesUpToIndex]
      .reverse()
      .find((m) => String(m.type) === 'human') as
      | HumanMessageWithMeta
      | undefined;

    const humanInput = buildHumanMessageInputPayload({
      content:
        lastHumanMessage && typeof lastHumanMessage.content === 'string'
          ? lastHumanMessage.content
          : '',
      submittedInput: lastHumanMessage?.submittedInput,
      references: lastHumanMessage?.references,
      referenceComposition: lastHumanMessage?.referenceComposition,
    });

    if (humanInput) {
      const retryTarget = messages[messageIndex];
      const retryInput = {
        ...humanInput,
        ...(lastHumanMessage?.runtimeCapabilities
          ? { runtimeCapabilities: lastHumanMessage.runtimeCapabilities }
          : {}),
      };
      stream.submit(
        retryTarget?.executionId
          ? {
              input: retryInput,
              retry: true,
              id: retryTarget.id,
              executionId: retryTarget.executionId,
              conversationId: stream.conversationId ?? undefined,
            }
          : {
              input: {
                ...retryInput,
                ...(lastHumanMessage?.model
                  ? { model: lastHumanMessage.model }
                  : {}),
              },
            },
        {
          optimisticValues: (prev) => {
            // Remove the AI message that we're retrying
            const prevMessages = prev?.messages ?? [];
            return {
              ...prev,
              messages: prevMessages.slice(0, messageIndex),
            };
          },
        },
      );
      scrollToBottom(true, true);
    }
  };
  return { submitDraft, handleRetry };
}
