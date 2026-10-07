import type { ChatKitOptions, ProjectSelection } from '@xpert-ai/chatkit-types';
import type { XpertProjectTypeRef } from '@xpert-ai/xpert-sdk';
import { X } from 'lucide-react';
import * as React from 'react';
import { getSurfaceThemeStyle } from '../../../lib/theme-surfaces';
import { cn } from '../../../lib/utils';
import { ComposerCapabilityChip } from '../../composer/ComposerCapabilityChip';
import { ComposerMenu } from '../../composer/ComposerMenu';
import { ComposerThreadToken } from '../../composer/ComposerThreadToken';
import { ModelPicker } from '../../composer/ModelPicker';
import { ProjectSelector } from '../../composer/ProjectSelector';
import { RuntimeResourceSelector } from '../../composer/RuntimeResourceSelector';
import { SendButton } from '../../composer/SendButton';
import { WorkspaceFileSelector } from '../../composer/WorkspaceFileSelector';
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

type ChatComposerFormProps = Pick<
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

export function ChatComposerForm({
  handleSubmit,
  theme,
  isProjectSelectorVisible,
  isFileSelectorVisible,
  focusComposerAt,
  composerCapabilities,
  isPromptEditDisabled,
  composerDomVersion,
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
}: ChatComposerFormProps) {
  return (
    <form className="flex items-end" onSubmit={handleSubmit}>
      <div
        data-slot="composer-input-shell"
        style={getSurfaceThemeStyle(theme)}
        data-layout="stacked"
        className={cn(
          'relative flex min-w-0 flex-1 flex-col overflow-visible',
          'bg-composer-shell px-composer-inset pt-composer-inset',
          !isProjectSelectorVisible &&
            !isFileSelectorVisible &&
            'pb-composer-inset',
          'transition-[border-radius] duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)]',
          'rounded-composer-shell shadow-composer-shell',
        )}
      >
        <div
          data-slot="composer-editor-surface"
          className={cn(
            'relative flex min-h-[6.5rem] min-w-0 bg-background px-2 pt-2 pb-14',
            'rounded-composer-editor',
          )}
        >
          <div
            data-slot="composer-body"
            className="min-h-10 max-h-32 w-full cursor-text overflow-y-auto break-words px-2 py-2 text-base leading-6 text-foreground"
            onClick={(event) => {
              if (event.target === event.currentTarget) focusComposerAt();
            }}
          >
            {composerCapabilities.inline.map((option) => (
              <ComposerCapabilityChip
                key={`${option.type}:${option.id}`}
                option={option}
                onRemove={composerCapabilities.remove}
                disabled={isPromptEditDisabled}
              />
            ))}
            <div
              key={composerDomVersion}
              ref={composerInputRef}
              role="textbox"
              aria-multiline="true"
              aria-disabled={
                missingConfig ||
                isHistoryLoading ||
                hasPendingInteractiveRequest
              }
              contentEditable={
                !(
                  missingConfig ||
                  isHistoryLoading ||
                  hasPendingInteractiveRequest
                )
              }
              suppressContentEditableWarning
              onInput={handleComposerInput}
              onCompositionStart={handleComposerCompositionStart}
              onCompositionEnd={handleComposerCompositionEnd}
              onSelect={handleComposerSelect}
              onPaste={handleComposerPaste}
              onKeyDown={handleComposerKeyDown}
              data-placeholder={inputPlaceholder}
              className={cn(
                'whitespace-pre-wrap break-words bg-transparent outline-none',
                composerCapabilities.inline.length > 0
                  ? 'inline'
                  : 'block min-h-10',
                'empty:before:pointer-events-none empty:before:text-muted-foreground empty:before:content-[attr(data-placeholder)]',
                (missingConfig ||
                  isHistoryLoading ||
                  hasPendingInteractiveRequest) &&
                  'cursor-not-allowed opacity-50',
              )}
            >
              {renderedComposerParts.map((part, index) =>
                part.type === 'text' ? (
                  <React.Fragment key={`text-${index}`}>
                    {part.text}
                  </React.Fragment>
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
            </div>
          </div>
          <div
            data-slot="composer-action-bar"
            className="pointer-events-none absolute inset-x-3 bottom-2 flex min-h-10 items-center justify-between gap-2"
          >
            <div className="pointer-events-none flex min-w-0 flex-1 items-center gap-1.5">
              <div className="pointer-events-auto flex shrink-0 items-center gap-1.5">
                <ComposerMenu
                  composer={composer}
                  onAttachmentClick={handleAttachmentClick}
                  onToolSelect={handleToolSelect}
                  selectedTool={selectedTool}
                  planModeEnabled={planModeEnabled}
                  onPlanModeChange={setPlanModeEnabled}
                  goalCommandAvailable={goalCommandAvailable}
                  goalPanelOpen={isGoalModeOpen}
                  onGoalPanelOpenChange={handleGoalPanelOpenChange}
                  runtimeCapabilities={
                    runtimeCapabilitiesReady ? runtimeCapabilities : null
                  }
                  selectedRuntimeCapabilities={composerCapabilities.selection}
                  onRuntimeCapabilityToggle={composerCapabilities.toggle}
                  connectorClient={xpertPlatformClient}
                  connectorXpertId={stream.assistantId}
                  connectorProjectId={activeProjectId}
                  selectedConnectorBindingIds={stream.connectorBindingIds}
                  onConnectorSelectionChange={(bindingIds) => {
                    void stream
                      .setConnectorBindingIds(bindingIds)
                      .then(() => onConnectorsChange?.(bindingIds))
                      .catch((persistError) => {
                        console.warn(
                          '[Chat] Failed to persist connector selection:',
                          persistError,
                        );
                      });
                  }}
                  connectorsEnabled={connectorsEnabled}
                  unifiedResourcesEnabled={resourcesEnabled}
                  apiUrl={apiUrl}
                  disabled={
                    missingConfig ||
                    isHistoryLoading ||
                    hasPendingInteractiveRequest
                  }
                />
              </div>

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
            </div>

            <div className="pointer-events-auto flex shrink-0 items-center gap-1">
              <ContextUsageIndicator className="size-8" />
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
                <span role="status" className="text-xs text-muted-foreground" title={t('threadControl.pausingDescription')}>
                  {t('threadControl.pausing')}
                </span>
              )}
              <SendButton
                disabled={isSendDisabled}
                isLoading={stream.isLoading}
                showStop={
                  !isPauseActive &&
                  (stream.isLoading || canPauseRun) &&
                  (!hasComposerInput || hasPendingInteractiveRequest)
                }
                stopDisabled={isChangingBranch || isStoppingRun || !canPauseRun}
                onStop={() => void handleComposerRunControl('pause')}
                stopLabel={t('threadControl.stop')}
                showResume={isPauseActive && !hasComposerInput}
                resumeDisabled={
                  !isRunPaused ||
                  isStoppingRun ||
                  isRunPausing ||
                  isResumingRun ||
                  isChangingBranch ||
                  !currentRunControl?.pauseId
                }
                onResume={() => void handleComposerRunControl('resume')}
                resumeLabel={t('threadControl.resume')}
                sendLabel={t('chat.send')}
                shortcuts={
                  isVisibleStreaming && !isRunPaused && trimmedDraft
                    ? [
                        {
                          label: t('chat.followUps.queue'),
                          keys: 'Enter',
                        },
                      ]
                    : undefined
                }
              />
            </div>
          </div>
        </div>

        <div
          data-slot="composer-context-rail"
          className="flex min-w-0 flex-wrap items-center"
        >
          <div className="min-w-0 max-w-full">
            {projectsEnabled &&
            (isProjectScopeLocked || !isProjectSelectionLocked) ? (
              <ProjectSelector
                client={xpertPlatformClient}
                xpertId={stream.assistantId}
                activeProjectId={activeProjectId}
                selection={projectSelection}
                autoNewEnabled={options?.composer?.projects?.autoNewEnabled}
                autoNewMode={options?.composer?.projects?.autoNewMode}
                allowNone={options?.composer?.projects?.allowNone}
                locked={isProjectScopeLocked}
                label={options?.composer?.projects?.label}
                disabled={
                  missingConfig ||
                  isHistoryLoading ||
                  isGoalLoading ||
                  hasPendingInteractiveRequest
                }
                onAvailabilityChange={setHasSelectableProjects}
                onProjectChange={handleProjectSelectionChange}
                onProjectCreate={onProjectCreate}
                onProjectTypeCreate={onProjectTypeCreate}
              />
            ) : null}
          </div>
          {isFileSelectorVisible && (
            <WorkspaceFileSelector
              client={xpertPlatformClient}
              assistantId={stream.assistantId ?? null}
              projectId={activeProjectId ?? null}
              selectedFilePaths={referencedWorkspaceFilePaths}
              disabled={
                missingConfig ||
                isHistoryLoading ||
                isGoalLoading ||
                hasPendingInteractiveRequest
              }
              onSelect={addWorkspaceFileReference}
            />
          )}
          {resourcesEnabled && xpertPlatformClient && stream.assistantId && (
            <RuntimeResourceSelector
              key={JSON.stringify([
                stream.assistantId,
                activeProjectId,
                stream.conversationId,
                stream.threadId,
              ])}
              connectorsEnabled={connectorsEnabled}
              connectorBindingIds={stream.connectorBindingIds}
              onConnect={options?.composer?.resources?.onConnect}
              onConnectorsChange={async (ids) => {
                await stream.setConnectorBindingIds(ids);
                onConnectorsChange?.(ids);
              }}
              client={xpertPlatformClient}
              assistantId={stream.assistantId}
              projectId={activeProjectId}
              selection={runtimeResources.selection}
              busy={runtimeResources.busy}
              canEditResources={runtimeResources.canEdit}
              error={runtimeResources.error}
              disabled={
                missingConfig ||
                isHistoryLoading ||
                hasPendingInteractiveRequest
              }
              onToggle={runtimeResources.toggle}
              onRefresh={runtimeResources.refresh}
            />
          )}
        </div>
      </div>
    </form>
  );
}
