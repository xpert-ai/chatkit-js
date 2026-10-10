import type { ChatKitOptions, ProjectSelection } from '@xpert-ai/chatkit-types';
import type { XpertProjectTypeRef } from '@xpert-ai/xpert-sdk';
import { X } from 'lucide-react';
import * as React from 'react';
import { getSurfaceThemeStyle } from '../../../lib/theme-surfaces';
import { cn } from '../../../lib/utils';
import { ComposerCapabilityChip } from '../../composer/ComposerCapabilityChip';
import { ComposerThreadToken } from '../../composer/ComposerThreadToken';
import { ModelPicker } from '../../composer/ModelPicker';
import { ContextUsageIndicator } from '../../thread/context-usage-indicator';
import type { useChatFiles } from '../files/useChatFiles';
import type { useChatGoal } from '../goal/useChatGoal';
import type { useChatModels } from '../models/useChatModels';
import type { useChatModelState } from '../models/useChatModelState';
import {
  ComposerCapabilityToken,
  type useRuntimeCapabilitiesState,
} from '../runtime-capabilities';
import type { useChatBranchState } from '../session/useChatBranchState';
import type { useChatConversationActions } from '../session/useChatConversationActions';
import type { useChatEnvironment } from '../session/useChatEnvironment';
import type { useChatRunControl } from '../session/useChatRunControl';
import type { useRuntimeResources } from '../useRuntimeResources';
import type { useChatCapabilities } from './useChatCapabilities';
import type { useChatCommands } from './useChatCommands';
import type { useChatDraft } from './useChatDraft';
import type { useChatInput } from './useChatInput';

type AssistantComposerProps = Pick<
  ReturnType<typeof useChatCommands>,
  'handleSubmit'
> &
  Pick<
    ReturnType<typeof useChatEnvironment>,
    | 'theme'
    | 'missingConfig'
    | 'isHistoryLoading'
    | 'composer'
    | 'xpertPlatformClient'
    | 'stream'
    | 'activeProjectId'
    | 'apiUrl'
    | 't'
  > &
  Pick<
    ReturnType<typeof useChatDraft>,
    | 'focusComposerAt'
    | 'composerDomVersion'
    | 'composerInputRef'
    | 'renderedComposerParts'
    | 'removeThreadToken'
    | 'selectedTool'
    | 'setSelectedTool'
    | 'trimmedDraft'
    | 'draft'
  > &
  Pick<ReturnType<typeof useChatCapabilities>, 'composerCapabilities'> &
  Pick<
    ReturnType<typeof useChatInput>,
    | 'handleComposerInput'
    | 'handleComposerCompositionStart'
    | 'handleComposerCompositionEnd'
    | 'handleComposerSelect'
    | 'handleComposerPaste'
    | 'handleComposerKeyDown'
    | 'handleToolSelect'
  > &
  Pick<
    ReturnType<typeof useChatFiles>,
    | 'handleAttachmentClick'
    | 'referencedWorkspaceFilePaths'
    | 'addWorkspaceFileReference'
  > &
  Pick<
    ReturnType<typeof useChatGoal>,
    | 'goalCommandAvailable'
    | 'isGoalModeOpen'
    | 'handleGoalPanelOpenChange'
    | 'isGoalLoading'
  > &
  Pick<
    ReturnType<typeof useRuntimeCapabilitiesState>,
    'runtimeCapabilitiesReady' | 'runtimeCapabilities'
  > &
  Pick<ReturnType<typeof useChatModelState>, 'availableModels'> &
  Pick<ReturnType<typeof useChatModels>, 'handleModelSelect'> &
  Pick<
    ReturnType<typeof useChatRunControl>,
    | 'isPauseActive'
    | 'canPauseRun'
    | 'handleComposerRunControl'
    | 'isRunPaused'
    | 'isStoppingRun'
    | 'isRunPausing'
    | 'isResumingRun'
    | 'currentRunControl'
    | 'isVisibleStreaming'
  > &
  Pick<ReturnType<typeof useChatBranchState>, 'isChangingBranch'> &
  Pick<
    ReturnType<typeof useChatConversationActions>,
    'handleProjectSelectionChange'
  > & {
    isProjectSelectorVisible: boolean;
    isFileSelectorVisible: boolean;
    isPromptEditDisabled: boolean;
    hasPendingInteractiveRequest: boolean;
    inputPlaceholder: string;
    planModeEnabled: boolean;
    setPlanModeEnabled: React.Dispatch<React.SetStateAction<boolean>>;
    onConnectorsChange: ((connectorBindingIds: string[]) => void) | undefined;
    connectorsEnabled: boolean;
    resourcesEnabled: boolean;
    isSendDisabled: boolean;
    hasComposerInput: boolean;
    projectsEnabled: boolean;
    isProjectScopeLocked: boolean;
    isProjectSelectionLocked: boolean;
    projectSelection: ProjectSelection | undefined;
    options: ChatKitOptions | null | undefined;
    setHasSelectableProjects: React.Dispatch<React.SetStateAction<boolean>>;
    onProjectCreate:
      | ((name: string, projectType?: XpertProjectTypeRef) => void)
      | undefined;
    onProjectTypeCreate:
      | ((projectType: XpertProjectTypeRef) => void)
      | undefined;
    runtimeResources: ReturnType<typeof useRuntimeResources>;
  };

import type { ChatComposerFormProps } from './ChatComposerForm';
export function getAssistantComposerProps({
  handleSubmit,
  theme,
  isProjectSelectorVisible,
  isFileSelectorVisible,
  focusComposerAt,
  composerCapabilities,
  isPromptEditDisabled,
  composerDomVersion,
  draft,
  composerInputRef,
  missingConfig,
  isHistoryLoading,
  hasPendingInteractiveRequest,
  handleComposerInput,
  handleComposerCompositionStart,
  handleComposerCompositionEnd,
  handleComposerSelect,
  handleComposerPaste,
  handleComposerKeyDown,
  inputPlaceholder,
  renderedComposerParts,
  removeThreadToken,
  composer,
  handleAttachmentClick,
  handleToolSelect,
  selectedTool,
  planModeEnabled,
  setPlanModeEnabled,
  goalCommandAvailable,
  isGoalModeOpen,
  handleGoalPanelOpenChange,
  runtimeCapabilitiesReady,
  runtimeCapabilities,
  xpertPlatformClient,
  stream,
  activeProjectId,
  onConnectorsChange,
  connectorsEnabled,
  resourcesEnabled,
  apiUrl,
  setSelectedTool,
  t,
  availableModels,
  handleModelSelect,
  isSendDisabled,
  isPauseActive,
  canPauseRun,
  hasComposerInput,
  isChangingBranch,
  handleComposerRunControl,
  isRunPaused,
  isStoppingRun,
  isRunPausing,
  isResumingRun,
  currentRunControl,
  isVisibleStreaming,
  trimmedDraft,
  projectsEnabled,
  isProjectScopeLocked,
  isProjectSelectionLocked,
  projectSelection,
  options,
  isGoalLoading,
  setHasSelectableProjects,
  handleProjectSelectionChange,
  onProjectCreate,
  onProjectTypeCreate,
  referencedWorkspaceFilePaths,
  addWorkspaceFileReference,
  runtimeResources,
}: AssistantComposerProps): ChatComposerFormProps {
  return {
    onSubmit: handleSubmit,
    style: getSurfaceThemeStyle(theme),
    paddedBottom: !isProjectSelectorVisible && !isFileSelectorVisible,
    leadingActions: (
      <>
        {composerCapabilities.subAgents.length > 0 && (
          <div
            data-slot="composer-selected-sub-agents"
            className="pointer-events-auto flex min-w-0 items-center gap-1 overflow-x-auto overflow-y-hidden [scrollbar-width:none]! [&::-webkit-scrollbar]:hidden"
          >
            {composerCapabilities.subAgents.map((option) => (
              <ComposerCapabilityChip
                key={option.id}
                option={option}
                onRemove={composerCapabilities.remove}
                disabled={isPromptEditDisabled}
              />
            ))}
          </div>
        )}

        {selectedTool && (
          <span
            data-slot="composer-selected-tool"
            className="group/tool pointer-events-auto inline-flex h-8 min-w-0 max-w-[14rem] shrink items-center rounded-full bg-primary/10 px-2 text-xs font-medium text-primary transition-all duration-200"
          >
            <span className="truncate">
              {selectedTool.shortLabel ?? selectedTool.label}
            </span>
            <button
              data-slot="composer-selected-tool-remove"
              type="button"
              onClick={() => setSelectedTool(null)}
              aria-label={t('composer.removeTool', {
                label: selectedTool.shortLabel ?? selectedTool.label,
              })}
              className={cn(
                'pointer-events-none ml-0 flex w-0 shrink-0 items-center justify-center overflow-hidden rounded-full p-0 text-primary/70 opacity-0 outline-none',
                'transition-[width,margin,opacity,background-color,color] duration-200',
                'group-hover/tool:pointer-events-auto group-hover/tool:ml-1 group-hover/tool:w-4 group-hover/tool:opacity-100',
                'focus-visible:pointer-events-auto focus-visible:ml-1 focus-visible:w-4 focus-visible:opacity-100',
                'hover:bg-primary/10 hover:text-primary focus-visible:bg-primary/10 focus-visible:text-primary',
              )}
            >
              <X className="size-3 shrink-0" />
            </button>
          </span>
        )}
      </>
    ),
    trailingActions: (
      <>
        <ContextUsageIndicator
          className="size-8"
          modelName={
            availableModels.find((model) => model.id === stream.selectedModelId)
              ?.label
          }
        />

        <ModelPicker
          models={availableModels}
          selectedModelId={stream.selectedModelId}
          onSelect={handleModelSelect}
          disabled={
            Boolean(missingConfig) ||
            isHistoryLoading ||
            hasPendingInteractiveRequest
          }
          copy={{
            label: t('chat.modelPicker.label'),
            title: t('chat.modelPicker.title'),
            description: t('chat.modelPicker.description'),
            availableModels: t('chat.modelPicker.availableModels'),
            defaultBadge: t('chat.modelPicker.defaultBadge'),
            unavailableBadge: t('chat.modelPicker.unavailableBadge'),
            futureTitle: t('chat.modelPicker.futureTitle'),
            futureDescription: t('chat.modelPicker.futureDescription'),
            futureBadge: t('chat.modelPicker.futureBadge'),
          }}
        />

        {isRunPausing && (
          <span
            role="status"
            className="text-xs text-muted-foreground"
            title={t('threadControl.pausingDescription')}
          >
            {t('threadControl.pausing')}
          </span>
        )}
      </>
    ),
    send: {
      disabled: isSendDisabled,
      isLoading: stream.isLoading,
      showStop:
        !isPauseActive &&
        (stream.isLoading || canPauseRun) &&
        (!hasComposerInput || hasPendingInteractiveRequest),
      stopDisabled: isChangingBranch || isStoppingRun || !canPauseRun,
      onStop: () => void handleComposerRunControl('pause'),
      stopLabel: t('threadControl.stop'),
      showResume: isPauseActive && !hasComposerInput,
      resumeDisabled:
        !isRunPaused ||
        isStoppingRun ||
        isRunPausing ||
        isResumingRun ||
        isChangingBranch ||
        !currentRunControl?.pauseId,
      onResume: () => void handleComposerRunControl('resume'),
      resumeLabel: t('threadControl.resume'),
      sendLabel: t('chat.send'),
      shortcuts:
        isVisibleStreaming && !isRunPaused && trimmedDraft
          ? [
              {
                label: t('chat.followUps.queue'),
                keys: 'Enter',
              },
            ]
          : undefined,
    },
    menu: {
      composer,
      onAttachmentClick: handleAttachmentClick,
      onToolSelect: handleToolSelect,
      selectedTool,
      planModeEnabled,
      onPlanModeChange: setPlanModeEnabled,
      goalCommandAvailable,
      goalPanelOpen: isGoalModeOpen,
      onGoalPanelOpenChange: handleGoalPanelOpenChange,
      runtimeCapabilities: runtimeCapabilitiesReady
        ? runtimeCapabilities
        : null,
      selectedRuntimeCapabilities: composerCapabilities.selection,
      onRuntimeCapabilityToggle: composerCapabilities.toggle,
      connectorClient: xpertPlatformClient,
      connectorXpertId: stream.assistantId,
      connectorProjectId: activeProjectId,
      selectedConnectorBindingIds: stream.connectorBindingIds,
      onConnectorSelectionChange: (ids) => {
        void stream
          .setConnectorBindingIds(ids)
          .then(() => onConnectorsChange?.(ids))
          .catch((error) =>
            console.warn(
              '[Chat] Failed to persist connector selection:',
              error,
            ),
          );
      },
      connectorsEnabled,
      unifiedResourcesEnabled: resourcesEnabled,
      apiUrl,
      disabled:
        missingConfig || isHistoryLoading || hasPendingInteractiveRequest,
    },
    context: {
      project:
        projectsEnabled && (isProjectScopeLocked || !isProjectSelectionLocked)
          ? {
              ready: stream.isReady,
              client: xpertPlatformClient,
              xpertId: stream.assistantId,
              activeProjectId,
              selection: projectSelection,
              autoNewEnabled: options?.composer?.projects?.autoNewEnabled,
              autoNewMode: options?.composer?.projects?.autoNewMode,
              allowNone: options?.composer?.projects?.allowNone,
              locked: isProjectScopeLocked,
              label: options?.composer?.projects?.label,
              disabled:
                missingConfig ||
                isHistoryLoading ||
                isGoalLoading ||
                hasPendingInteractiveRequest,
              onAvailabilityChange: setHasSelectableProjects,
              onProjectChange: handleProjectSelectionChange,
              onProjectCreate,
              onProjectTypeCreate,
            }
          : undefined,
      files: isFileSelectorVisible
        ? {
            client: xpertPlatformClient,
            assistantId: stream.assistantId ?? null,
            projectId: activeProjectId ?? null,
            selectedFilePaths: referencedWorkspaceFilePaths,
            disabled:
              missingConfig ||
              isHistoryLoading ||
              isGoalLoading ||
              hasPendingInteractiveRequest,
            onSelect: addWorkspaceFileReference,
          }
        : undefined,
      resources:
        resourcesEnabled && xpertPlatformClient && stream.assistantId
          ? {
              key: JSON.stringify([
                stream.assistantId,
                activeProjectId,
                stream.conversationId,
                stream.threadId,
              ]),
              connectorsEnabled,
              connectorBindingIds: stream.connectorBindingIds,
              onConnect: options?.composer?.resources?.onConnect,
              onConnectorsChange: async (ids) => {
                await stream.setConnectorBindingIds(ids);
                onConnectorsChange?.(ids);
              },
              client: xpertPlatformClient,
              assistantId: stream.assistantId,
              projectId: activeProjectId,
              selection: runtimeResources.selection,
              busy: runtimeResources.busy,
              canEditResources: runtimeResources.canEdit,
              error: runtimeResources.error,
              disabled:
                missingConfig ||
                isHistoryLoading ||
                hasPendingInteractiveRequest,
              onToggle: runtimeResources.toggle,
              onRefresh: runtimeResources.refresh,
            }
          : undefined,
    },
    editor: {
      inputRef: composerInputRef,
      version: composerDomVersion,
      value: draft,
      disabled:
        missingConfig || isHistoryLoading || hasPendingInteractiveRequest,
      placeholder: inputPlaceholder,
      focus: focusComposerAt,
      hasInline: composerCapabilities.inline.length > 0,
      onInput: handleComposerInput,
      onCompositionStart: handleComposerCompositionStart,
      onCompositionEnd: handleComposerCompositionEnd,
      onSelect: handleComposerSelect,
      onPaste: handleComposerPaste,
      onKeyDown: handleComposerKeyDown,
      inline: (
        <>
          {' '}
          {composerCapabilities.inline.map((option) => (
            <ComposerCapabilityChip
              key={`${option.type}:${option.id}`}
              option={option}
              onRemove={composerCapabilities.remove}
              disabled={isPromptEditDisabled}
            />
          ))}
        </>
      ),
      children: (
        <>
          {renderedComposerParts.map((part, index) =>
            part.type === 'text' ? (
              <React.Fragment key={`text-${index}`}>{part.text}</React.Fragment>
            ) : part.type === 'thread' ? (
              <ComposerThreadToken
                key={part.key}
                part={part}
                onRemove={removeThreadToken}
                disabled={isPromptEditDisabled}
              />
            ) : (
              <ComposerCapabilityToken
                key={part.key}
                part={part}
                onRemove={composerCapabilities.remove}
                disabled={isPromptEditDisabled}
              />
            ),
          )}
        </>
      ),
    },
  };
}
