import { ArrowDown } from 'lucide-react';
import * as React from 'react';
import { getComposerThreadReferences } from '../lib/composer-parts';
import { sortVisiblePendingFollowUps } from '../lib/follow-ups';
import {
  cn,
  getMenuItemRoundedClass,
  getPanelRoundedClass,
} from '../lib/utils';
import { useRuntimeCapabilitiesState } from './chat/runtime-capabilities';
import { type ChatProps } from './chat/types';
import { UploadDroppedFiles } from './chat/upload-dropped-files';
import { useConversationSummaryEvent } from './chat/useConversationSummaryEvent';
import { usePetAutoState } from './chat/usePetAutoState';
import { useRuntimeResources } from './chat/useRuntimeResources';
import { PromptWorkflowShortcuts } from './composer/PromptWorkflowShortcuts';
import { SlashPalette } from './composer/SlashPalette';
import { StarterPromptSuggestions } from './composer/StarterPromptSuggestions';
import { ThreadMentionPalette } from './composer/ThreadMentionPalette';
import { PetBridge } from './pet/PetBridge';
import { SettingsSheet } from './settings/SettingsSheet';
import { TaskSummaryPanel } from './task-summary/TaskSummary';
import { MessageNavigator } from './thread/MessageNavigator';
import { Button } from './ui/button';

import { ChatComposerForm } from './chat/composer/ChatComposerForm';
import { ChatPendingActions } from './chat/composer/ChatPendingActions';
import { useChatCapabilities } from './chat/composer/useChatCapabilities';
import { useChatCommands } from './chat/composer/useChatCommands';
import { useChatDraft } from './chat/composer/useChatDraft';
import { useChatInput } from './chat/composer/useChatInput';
import { useChatSubmission } from './chat/composer/useChatSubmission';
import { ChatComposerAttachments } from './chat/files/ChatComposerAttachments';
import { useChatFiles } from './chat/files/useChatFiles';
import { ChatGoalStatus } from './chat/goal/ChatGoalStatus';
import { useChatGoal } from './chat/goal/useChatGoal';
import { ChatHeader } from './chat/header/ChatHeader';
import { useChatHistory } from './chat/history/useChatHistory';
import { useChatHost } from './chat/host/useChatHost';
import { ChatQuoteActions } from './chat/messages/ChatQuoteActions';
import { ChatTranscript } from './chat/messages/ChatTranscript';
import { useChatQuotes } from './chat/messages/useChatQuotes';
import { useChatStreamingFeedback } from './chat/messages/useChatStreamingFeedback';
import { useChatViewport } from './chat/messages/useChatViewport';
import { useChatModels } from './chat/models/useChatModels';
import { useChatModelState } from './chat/models/useChatModelState';
import { useChatPetSettings } from './chat/pet/useChatPetSettings';
import { useChatAssistant } from './chat/session/useChatAssistant';
import { useChatBranchState } from './chat/session/useChatBranchState';
import { useChatConversationActions } from './chat/session/useChatConversationActions';
import { useChatEnvironment } from './chat/session/useChatEnvironment';
import { useChatRunControl } from './chat/session/useChatRunControl';
import { useChatTaskSummary } from './chat/summary/useChatTaskSummary';
import { resolveMessagePresentation } from '../lib/message-presentation';
export type { ChatProps, ChatReferenceRequest } from './chat/types';
export function Chat({
  className,
  options,
  title,
  placeholder,
  clientSecret = '',
  isClientSecretInitializing = false,
  surface = 'main',
  referenceRequest,
  activeProjectId: configuredProjectId,
  projectSelection,
  projectsEnabled = false,
  connectorsEnabled = false,
  onProjectChange,
  onProjectCreate,
  onProjectTypeCreate,
  onConnectorsChange,
}: ChatProps) {
  const session = useChatEnvironment({
    options,
    configuredProjectId,
    clientSecret,
    isClientSecretInitializing,
  });

  const branch = useChatBranchState({ ...session });
  const runControl = useChatRunControl({ ...branch, ...session });
  const assistant = useChatAssistant({ ...session, title, placeholder });
  const messagePresentation = resolveMessagePresentation(
    options?.messagePresentation,
    assistant.assistantMessagePresentation,
  );
  const feedback = useChatStreamingFeedback({ ...session, surface });
  const runtime = useRuntimeCapabilitiesState({
    client: session.stream.client,
    assistantId: session.stream.assistantId,
    projectId: session.activeProjectId,
    threadId: session.stream.threadId,
    disabled:
      session.missingConfig ||
      !session.stream.client ||
      !session.stream.assistantId,
  });

  const historyState = useChatHistory({ ...session, surface });
  const draft = useChatDraft({ ...runtime });
  const goal = useChatGoal({
    ...session,
    ...feedback,
    ...runtime,
    ...historyState,
    ...draft,
    surface,
    options,
  });

  const modelState = useChatModelState({ ...session });
  const [planModeEnabled, setPlanModeEnabled] = React.useState(false);
  const pet = useChatPetSettings({ options });
  const headerMoreButtonRef = React.useRef<HTMLButtonElement>(null);
  const restoreHeaderFocus = React.useCallback((event: Event) => {
    if (headerMoreButtonRef.current) {
      event.preventDefault();
      headerMoreButtonRef.current.focus();
    }
  }, []);

  const [hasSelectableProjects, setHasSelectableProjects] =
    React.useState(false);

  const files = useChatFiles({ ...draft, ...session, referenceRequest });
  const viewportRef = React.useRef<HTMLDivElement>(null);
  const messages = React.useMemo(
    () => session.stream.messages ?? [],
    [session.stream.messages],
  );

  const quotes = useChatQuotes({
    ...session,
    ...files,
    ...draft,
    surface,
    viewportRef,
    messages,
  });

  const viewport = useChatViewport({
    messagePresentation,
    ...session,
    ...assistant,
    ...quotes,
    messages,
    viewportRef,
  });

  const chatColumnRef = React.useRef<HTMLDivElement>(null);
  const capabilities = useChatCapabilities({
    ...runtime,
    ...draft,
    ...session,
  });

  const host = useChatHost({
    ...draft,
    ...files,
    ...session,
    ...modelState,
    ...capabilities,
    ...runtime,
    ...pet,
    surface,
    options,
  });

  const hasPendingRequestUserInput = Boolean(
    session.stream.pendingRequestUserInput,
  );

  const hasPendingHITLRequest = Boolean(session.stream.pendingHITLRequest);
  const hasPendingInteractiveRequest =
    hasPendingRequestUserInput || hasPendingHITLRequest;

  const isPromptEditDisabled =
    hasPendingInteractiveRequest ||
    session.missingConfig ||
    session.isHistoryLoading;

  const conversation = useChatConversationActions({
    ...draft,
    ...files,
    ...runtime,
    ...session,
    ...branch,
    ...historyState,
    onConnectorsChange,
    onProjectChange,
    isPromptEditDisabled,
    configuredProjectId,
    options,
  });

  const resourcesEnabled =
    options?.composer?.resources?.enabled === true &&
    Boolean(session.xpertPlatformClient && session.stream.assistantId);

  const runtimeResources = useRuntimeResources({
    client: session.xpertPlatformClient,
    enabled: resourcesEnabled,
    assistantId: session.stream.assistantId,
    projectId: session.activeProjectId,
    conversationId: session.stream.conversationId,
    threadId: session.stream.threadId,
  });

  const hasUploadingFiles = files.attachmentState.hasUploadingFiles;
  const isSubmissionBlocked =
    Boolean(conversation.conversationBranch.pendingMessageId) ||
    (resourcesEnabled && (runtimeResources.busy || !runtimeResources.ready)) ||
    branch.isChangingBranch ||
    runControl.isResumingRun ||
    runControl.isRunPausing ||
    hasPendingInteractiveRequest ||
    session.missingConfig ||
    session.isHistoryUnavailable ||
    hasUploadingFiles ||
    files.isUploadingReferenceImages;

  const submission = useChatSubmission({
    ...draft,
    ...files,
    ...session,
    ...runControl,
    ...runtime,
    ...capabilities,
    ...viewport,
    isSubmissionBlocked,
    planModeEnabled,
    resourcesEnabled,
    runtimeResources,
    options,
    messages,
  });

  const pendingFollowUps = React.useMemo(
    () => sortVisiblePendingFollowUps(session.stream.pendingFollowUps ?? []),
    [session.stream.pendingFollowUps],
  );

  const commands = useChatCommands({
    ...session,
    ...runtime,
    ...draft,
    ...host,
    ...goal,
    ...pet,
    ...capabilities,
    ...submission,
    ...files,
    setPlanModeEnabled,
    pendingFollowUps,
  });

  const inputPlaceholder =
    draft.selectedTool?.placeholderOverride ??
    session.composer?.placeholder ??
    assistant.resolvedPlaceholder;

  const isInitialComposer =
    !session.stream.threadId &&
    messages.length === 0 &&
    !viewport.canLoadMoreMessages &&
    !session.stream.isLoading;

  const hasPendingFollowUps = pendingFollowUps.length > 0;
  const isProjectSelectionLocked =
    Boolean(session.stream.threadId || session.stream.conversationId) ||
    messages.length > 0 ||
    viewport.canLoadMoreMessages;

  const isProjectScopeLocked =
    Boolean(session.activeProjectId) &&
    (isProjectSelectionLocked || options?.composer?.projects?.locked === true);

  const isFileSelectorVisible = Boolean(
    session.xpertPlatformClient &&
    (session.activeProjectId || session.stream.assistantId),
  );

  const isProjectSelectorVisible =
    projectsEnabled &&
    (isProjectScopeLocked ||
      (!isProjectSelectionLocked && hasSelectableProjects));

  const hasPendingTodos = Boolean(session.stream.todos?.items.length);
  const models = useChatModels({ ...modelState, ...session, ...host });
  const layoutMaxWidth = options?.layout?.maxWidth;
  const summary = useChatTaskSummary({
    ...session,
    ...runtime,
    ...goal,
    ...viewport,
    ...quotes,
    ...host,
    ...draft,
    options,
    pendingFollowUps,
    messages,
    viewportRef,
    chatColumnRef,
    layoutMaxWidth,
  });

  const hasComposerInput = Boolean(
    draft.trimmedDraft ||
    files.hasReferences ||
    files.attachmentState.uploadedFiles.length,
  );

  const isSendDisabled = !hasComposerInput || isSubmissionBlocked;
  const canUploadAttachments =
    session.composer?.attachments?.enabled === true && !isPromptEditDisabled;

  const input = useChatInput({
    ...draft,
    ...runtime,
    ...capabilities,
    ...commands,
    ...session,
    ...goal,
    ...submission,
    ...files,
    isSendDisabled,
    canUploadAttachments,
  });

  const streamErrorMessage =
    session.stream.error instanceof Error
      ? session.stream.error.message
      : undefined;

  const threadErrorMessage = React.useMemo(() => {
    if (streamErrorMessage?.trim()) return streamErrorMessage.trim();
    if (historyState.currentThread?.status !== 'error') return undefined;
    const message = historyState.currentThread.error?.trim();
    return message || session.t('thread.errorToast');
  }, [historyState.currentThread, streamErrorMessage, session.t]);

  const errorMessage = threadErrorMessage ? undefined : streamErrorMessage;
  const currentThreadIsRunning =
    session.stream.isLoading ||
    historyState.currentThread?.status === 'busy' ||
    String(historyState.currentThread?.status ?? '').toLowerCase() ===
      'running';

  const petAutoState = usePetAutoState({
    currentThreadStatus: historyState.currentThread?.status,
    currentThreadIsRunning,
    isClientSecretInitializing,
    isHistoryLoading: session.isHistoryLoading,
    isStreamLoading: session.stream.isLoading,
    isStreamReady: session.stream.isReady,
    lastStreamOutputAt: feedback.lastStreamOutputAtRef.current,
    messages,
    now: feedback.streamingNow,
    threadErrorMessage,
  });

  useConversationSummaryEvent({
    parentMessenger: host.parentMessenger,
    threadId: session.stream.threadId,
    currentThread: historyState.currentThread,
    currentThreadIsRunning: session.stream.isLoading,
    threadErrorMessage,
    messages,
    historyMessageLoadVersion: session.stream.historyMessageLoadVersion ?? 0,
    fallbackTitle: session.t('history.threadFallback'),
  });

  const chatColumnStyle = React.useMemo<React.CSSProperties | undefined>(() => {
    if (
      layoutMaxWidth === undefined ||
      layoutMaxWidth === null ||
      layoutMaxWidth === ''
    ) {
      return undefined;
    }

    return { maxWidth: layoutMaxWidth };
  }, [layoutMaxWidth]);
  return (
    <div
      className="relative flex h-full w-full min-w-0 bg-background"
      data-task-summary-layout={
        summary.taskSummaryDocked ? 'docked' : 'popover'
      }
    >
      <UploadDroppedFiles
        ref={viewportRef}
        data-chatkit-root=""
        enabled={canUploadAttachments}
        dropTitle={session.t('chat.dropFilesTitle')}
        dropHint={session.t('chat.dropFilesHint')}
        activeClassName="ring-2 ring-primary/40 ring-inset"
        onFiles={files.queueAttachmentFiles}
        className={cn(
          'relative flex h-full w-full min-w-0 flex-col flex-1 overflow-x-hidden overflow-y-auto bg-background shadow-sm transition-[box-shadow] duration-150',
          className,
        )}
      >
        <ChatHeader
          {...assistant}
          {...session}
          {...historyState}
          {...branch}
          {...pet}
          {...conversation}
          {...summary}
          {...host}
          surface={surface}
          options={options}
          chatColumnRef={chatColumnRef}
          chatColumnStyle={chatColumnStyle}
          headerMoreButtonRef={headerMoreButtonRef}
          restoreHeaderFocus={restoreHeaderFocus}
        />

        {viewport.showMessageNavigation && (
          <MessageNavigator
            items={viewport.messageNavigationItems}
            viewportRef={viewportRef}
            getAnchor={viewport.getMessageNavigationAnchor}
            onNavigate={viewport.handleMessageNavigationNavigate}
            label={session.t('message.navigation.label')}
            tagsOverflowLabel={(count) =>
              session.t('message.navigation.moreTags', { count })
            }
          />
        )}

        <ChatTranscript
          {...session}
          {...conversation}
          {...viewport}
          {...input}
          {...host}
          {...assistant}
          {...runControl}
          {...feedback}
          {...pet}
          {...runtime}
          {...branch}
          {...submission}
          isInitialComposer={isInitialComposer}
          chatColumnStyle={chatColumnStyle}
          errorMessage={errorMessage}
          messages={messages}
          isSubmissionBlocked={isSubmissionBlocked}
          isPromptEditDisabled={isPromptEditDisabled}
          options={options}
          currentThreadIsRunning={currentThreadIsRunning}
          messagePresentation={messagePresentation}
        />

        <ChatQuoteActions {...quotes} {...session} />

        <div
          data-slot="chatkit-chat-composer"
          data-position={isInitialComposer ? 'centered' : 'bottom'}
          className={cn(
            'mx-auto w-full max-w-2xl px-4 pb-4 pt-2 z-10 bg-background',
            isInitialComposer ? 'mb-auto' : 'sticky bottom-0',
          )}
          style={chatColumnStyle}
        >
          {runControl.runControlError?.threadId === session.stream.threadId && (
            <p role="alert" className="text-xs text-destructive">
              {runControl.runControlError.message}
            </p>
          )}
          {!viewport.isAtBottom && messages.length > 0 && (
            <div
              data-slot="scroll-to-bottom"
              className="pointer-events-none absolute left-1/2 top-0 z-20 flex -translate-x-1/2 -translate-y-full justify-center"
            >
              <Button
                type="button"
                size="icon-sm"
                variant={viewport.hasUpdatesBelow ? 'default' : 'outline'}
                className={cn(
                  'pointer-events-auto rounded-full shadow-md dark:border-white/20 dark:ring-1 dark:ring-white/15 dark:shadow-[0_0_0_1px_rgba(255,255,255,0.06),0_10px_30px_rgba(0,0,0,0.45)]',
                  viewport.hasUpdatesBelow && 'animate-bounce',
                )}
                onClick={() => viewport.scrollToBottom(true, true)}
                aria-label={session.t('chat.scrollToBottom')}
                title={session.t('chat.scrollToBottom')}
              >
                <ArrowDown size={16} />
              </Button>
            </div>
          )}

          {threadErrorMessage && (
            <div className="mb-3 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive overflow-auto">
              {threadErrorMessage}
            </div>
          )}
          <ChatGoalStatus {...goal} {...session} {...draft} />

          <ChatPendingActions
            {...session}
            {...commands}
            {...host}
            hasPendingTodos={hasPendingTodos}
            hasPendingFollowUps={hasPendingFollowUps}
            pendingFollowUps={pendingFollowUps}
          />

          {isInitialComposer && (
            <PromptWorkflowShortcuts
              commands={capabilities.promptWorkflow.commands}
              selected={capabilities.promptWorkflow.shortcutCommand}
              disabled={isSubmissionBlocked}
              onSelect={(command) => {
                capabilities.promptWorkflow.selectShortcut(command);
                runtime.setRuntimeCapabilityPalette(null);
              }}
              onScenario={capabilities.promptWorkflow.chooseScenario}
              onBack={capabilities.promptWorkflow.showPrompts}
            />
          )}

          <ChatComposerAttachments {...files} {...session} />

          {draft.threadMention && (
            <ThreadMentionPalette
              ref={draft.threadMentionPaletteRef}
              client={session.xpertPlatformClient}
              assistantId={session.stream.assistantId ?? null}
              projectId={session.activeProjectId ?? null}
              query={draft.threadMention.query}
              threadId={session.stream.threadId}
              selectedThreadIds={
                new Set(
                  [
                    ...files.references,
                    ...getComposerThreadReferences(draft.composerParts),
                  ].flatMap((reference) =>
                    reference.type === 'thread' ? [reference.threadId] : [],
                  ),
                )
              }
              onSelect={draft.selectThreadMention}
            />
          )}

          {runtime.runtimeCapabilityPalette && !draft.threadMention && (
            <SlashPalette
              palette={runtime.runtimeCapabilityPalette}
              options={commands.slashPaletteOptions}
              paletteRef={commands.slashPaletteRef}
              optionRefs={commands.slashPaletteOptionRefs}
              panelRoundedClass={getPanelRoundedClass(session.theme.radius)}
              itemRoundedClass={getMenuItemRoundedClass(session.theme.radius)}
              emptyLabel={commands.slashPaletteEmptyLabel}
              capabilityEmptyLabels={commands.slashPaletteCapabilityEmptyLabels}
              onSelect={commands.selectSlashPaletteOption}
            />
          )}

          <ChatComposerForm
            {...commands}
            {...session}
            {...draft}
            {...capabilities}
            {...input}
            {...files}
            {...goal}
            {...runtime}
            {...modelState}
            {...models}
            {...runControl}
            {...branch}
            {...conversation}
            isProjectSelectorVisible={isProjectSelectorVisible}
            isFileSelectorVisible={isFileSelectorVisible}
            isPromptEditDisabled={isPromptEditDisabled}
            hasPendingInteractiveRequest={hasPendingInteractiveRequest}
            inputPlaceholder={inputPlaceholder}
            planModeEnabled={planModeEnabled}
            setPlanModeEnabled={setPlanModeEnabled}
            onConnectorsChange={onConnectorsChange}
            connectorsEnabled={connectorsEnabled}
            resourcesEnabled={resourcesEnabled}
            isSendDisabled={isSendDisabled}
            hasComposerInput={hasComposerInput}
            projectsEnabled={projectsEnabled}
            isProjectScopeLocked={isProjectScopeLocked}
            isProjectSelectionLocked={isProjectSelectionLocked}
            projectSelection={projectSelection}
            options={options}
            setHasSelectableProjects={setHasSelectableProjects}
            onProjectCreate={onProjectCreate}
            onProjectTypeCreate={onProjectTypeCreate}
            runtimeResources={runtimeResources}
          />

          {isInitialComposer &&
            session.startScreen?.promptsLayout === 'list' && (
              <StarterPromptSuggestions
                prompts={session.startScreen.prompts ?? []}
                onPromptClick={input.handlePromptClick}
                onPromptEdit={conversation.handlePromptEdit}
                promptSendDisabled={isSubmissionBlocked}
                promptEditDisabled={isPromptEditDisabled}
              />
            )}

          {/* Disclaimer */}
          {session.disclaimer?.text && (
            <p
              className={cn(
                'mt-2 text-center text-xs',
                session.disclaimer.highContrast
                  ? 'text-foreground'
                  : 'text-muted-foreground',
              )}
            >
              {session.disclaimer.text}
            </p>
          )}
        </div>
        <SettingsSheet
          open={!pet.petDisabled && pet.petSettingsOpen}
          settings={pet.displayedPetSettings}
          petRequired={pet.petRequired}
          onOpenChange={pet.setPetSettingsOpen}
          onCloseAutoFocus={restoreHeaderFocus}
          onSave={pet.savePetLocalSettings}
        />
        <PetBridge pet={pet.effectivePet} state={petAutoState} />
      </UploadDroppedFiles>
      {summary.taskSummaryAvailable &&
        summary.taskSummaryDocked &&
        summary.taskSummaryOpen && (
          <div className="pointer-events-none absolute right-5 top-3 z-20 max-h-[calc(100%-1.5rem)] w-80">
            <TaskSummaryPanel
              {...summary.taskSummaryProps}
              className="pointer-events-auto max-h-full"
            />
          </div>
        )}
    </div>
  );
}
