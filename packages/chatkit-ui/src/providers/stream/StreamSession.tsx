import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  type ReactNode,
} from 'react';
import { createMissingApiConfigurationError } from '../../lib/api-config';
import { createResumedRootExecutionHydrator } from '../../lib/resumed-root-executions';
import {
  logRuntimeActivity,
  useRuntimeActivities,
} from '../runtime-activities';
import { useConversationProject } from '../useConversationProject';
import { StreamContext } from './context';
import { normalizeThreadIdentifier } from './scope/thread-identity';
import type { ProjectSelection, StateType, StreamContextType } from './types';

import { useStreamCredentials } from './auth/useStreamCredentials';
import { useStreamFollowUpState } from './follow-ups/useStreamFollowUpState';
import { useStreamFollowUps } from './follow-ups/useStreamFollowUps';
import { useStreamHistoryMessages } from './history/useStreamHistoryMessages';
import { useStreamThreadLoading } from './history/useStreamThreadLoading';
import { useStreamHost } from './host/useStreamHost';
import { useStreamInterrupts } from './interrupts/useStreamInterrupts';
import { useStreamUserInput } from './interrupts/useStreamUserInput';
import { useStreamMessages } from './messages/useStreamMessages';
import { useStreamResume } from './runs/useStreamResume';
import { useStreamRunControl } from './runs/useStreamRunControl';
import { useStreamRunState } from './runs/useStreamRunState';
import { useStreamScope } from './scope/useStreamScope';
import { useStreamLifecycle } from './session/useStreamLifecycle';
import { useStreamSubmission } from './transport/useStreamSubmission';
import { useStreamTransport } from './transport/useStreamTransport';
export const StreamSession = ({
  children,
  apiKey,
  organizationId,
  apiUrl,
  assistantId,
  projectId,
  projectSelection,
  initialThread,
  runtimeKey,
  locale,
  additionalContext,
  threadStateMode,
  hostIntegration,
  resetThreadOnMount = false,
  getClientSecret,
}: {
  children: ReactNode;
  apiKey: string;
  organizationId?: string;
  apiUrl: string;
  assistantId: string;
  projectId?: string;
  projectSelection?: ProjectSelection;
  initialThread?: string | null;
  runtimeKey?: string | number;
  locale?: string | null;
  additionalContext?: Record<string, unknown>;
  threadStateMode: 'url' | 'memory';
  hostIntegration: boolean;
  resetThreadOnMount?: boolean;
  getClientSecret?: () => Promise<{ secret: string; organizationId?: string }>;
}) => {
  const scope = useStreamScope({
    initialThread,
    threadStateMode,
    resetThreadOnMount,
  });

  const messages = useStreamMessages();
  const runState = useStreamRunState({ ...messages });
  const followUpState = useStreamFollowUpState({ ...messages });
  const userInput = useStreamUserInput();
  const host = useStreamHost({ ...scope, hostIntegration });
  const credentials = useStreamCredentials({
    ...host,
    ...runState,
    ...scope,
    apiKey,
    organizationId,
    getClientSecret,
    apiUrl,
    locale,
  });

  const interrupts = useStreamInterrupts({
    ...scope,
    ...messages,
    ...runState,
    ...host,
    ...userInput,
    assistantId,
    projectId,
  });

  const runtimeActivitiesEnabled =
    createMissingApiConfigurationError({
      apiUrl,
      clientSecret: credentials.runtimeClientSecret,
    }) === null;

  const activities = useRuntimeActivities<StateType>({
    client: credentials.client,
    threadId: scope.threadId ?? null,
    enabled: runtimeActivitiesEnabled,
    getOrganizationId: credentials.getRuntimeOrganizationId,
    setError: runState.setError,
  });

  const lifecycle = useStreamLifecycle({
    ...scope,
    ...runState,
    ...userInput,
    ...interrupts,
    ...messages,
    ...host,
    ...followUpState,
    ...activities,
    resetThreadOnMount,
  });

  // Reset chat execution state without unmounting Assistant-owned Workbench views.
  const bindingKey = JSON.stringify([
    projectId,
    projectSelection?.mode,
    runtimeKey,
  ]);
  const previousBinding = useRef(bindingKey);
  const bindingChanged = previousBinding.current !== bindingKey;
  useLayoutEffect(() => {
    if (previousBinding.current === bindingKey) return;
    previousBinding.current = bindingKey;
    scope.consumedInitialThreadRef.current = null;
    scope.initialSelectedThreadRef.current = null;
    lifecycle.reset(initialThread ?? null, []);
  }, [bindingKey, initialThread, lifecycle.reset]);

  const conversationProject = useConversationProject({
    client: credentials.client,
    projectId,
    conversationId: scope.conversationId,
    threadId: scope.threadId ?? null,
    isLoading: runState.isLoading,
    historyReady:
      host.historyLoad.status !== 'loading' &&
      host.historyLoad.status !== 'error',
    historyMessageLoadVersion: messages.historyMessageLoadVersion,
  });

  const refreshConversationProject = conversationProject.refresh;
  const hydrateConversationProject = conversationProject.hydrate;
  const hydrateResumedRootExecutions = useMemo(
    () =>
      createResumedRootExecutionHydrator((thread, run) =>
        credentials.client.runs.get(thread, run),
      ),
    [credentials.client],
  );

  useEffect(() => {
    logRuntimeActivity('stream config', {
      threadId: scope.threadId ?? null,
      enabled: runtimeActivitiesEnabled,
      hasApiUrl: apiUrl.trim().length > 0,
      hasClientSecret: credentials.runtimeClientSecret.trim().length > 0,
      organizationId: credentials.runtimeOrganizationId ?? null,
    });
  }, [
    apiUrl,
    runtimeActivitiesEnabled,
    credentials.runtimeClientSecret,
    credentials.runtimeOrganizationId,
    scope.threadId,
  ]);

  const controls = useStreamRunControl({
    ...runState,
    ...userInput,
    ...interrupts,
    ...scope,
    ...messages,
    ...credentials,
  });

  const history = useStreamHistoryMessages({
    ...credentials,
    ...controls,
    ...messages,
    ...scope,
    ...activities,
    ...followUpState,
    ...runState,
    ...interrupts,
    ...host,
    hydrateResumedRootExecutions,
  });

  const followUps = useStreamFollowUps({
    ...scope,
    ...credentials,
    ...runState,
    ...messages,
    ...followUpState,
    assistantId,
    projectId,
    additionalContext,
  });

  const transport = useStreamTransport({
    ...runState,
    ...scope,
    ...credentials,
    ...messages,
    ...host,
    ...followUpState,
    ...activities,
    ...interrupts,
    ...history,
    additionalContext,
    conversationProject,
    projectSelection,
    assistantId,
    refreshConversationProject,
    projectId,
  });

  const threadLoading = useStreamThreadLoading({
    ...scope,
    ...runState,
    ...host,
    ...messages,
    ...activities,
    ...controls,
    ...credentials,
    ...followUpState,
    ...history,
    ...interrupts,
    ...transport,
    assistantId,
    hydrateConversationProject,
    projectId,
    initialThread,
    apiUrl,
  });

  const submission = useStreamSubmission({
    ...runState,
    ...scope,
    ...credentials,
    ...controls,
    ...followUpState,
    ...followUps,
    ...messages,
    ...activities,
    ...host,
    ...transport,
    assistantId,
    projectId,
  });

  const resume = useStreamResume({
    ...runState,
    ...scope,
    ...history,
    ...credentials,
    ...messages,
    ...transport,
  });

  const isReady = Boolean(
    credentials.runtimeClientSecret &&
    credentials.runtimeClientSecret.startsWith('cs-x-'),
  );

  const isDisplayPaused = runState.pausedDisplay?.threadId === scope.threadId;
  const isThreadInterrupted =
    runState.interruptedThreadId !== null &&
    runState.interruptedThreadId === scope.threadId;
  const hasPendingUserInput = Boolean(
    interrupts.pendingHITLRequest || userInput.pendingRequestUserInput,
  );
  const displayValues =
    isDisplayPaused && runState.pausedDisplay
      ? runState.pausedDisplay.values
      : messages.values;

  const initialHistoryThread = normalizeThreadIdentifier(
    initialThread ?? scope.initialSelectedThreadRef.current,
  );

  const value: StreamContextType = {
    client: credentials.client,
    authenticatedFetch: credentials.fetchWithClientSecretRefresh,
    refreshClientSecret: credentials.refreshClientSecret,
    apiUrl,
    assistantId,
    projectId: conversationProject.projectId,
    projectScopeResolved: conversationProject.resolved,
    runtimeScopeReady:
      !bindingChanged &&
      host.historyLoad.status !== 'loading' &&
      host.historyLoad.status !== 'error' &&
      (!initialHistoryThread ||
        scope.consumedInitialThreadRef.current === initialHistoryThread),
    apiKey: credentials.runtimeClientSecret,
    organizationId: credentials.runtimeOrganizationId,
    threadId: scope.threadId ?? null,
    conversationId: scope.conversationId,
    connectorBindingIds: scope.connectorBindingIds,
    threadGoal: messages.threadGoal,
    contextUsageByAgentKey: messages.contextUsageByAgentKey,
    values: displayValues,
    messages: displayValues.messages ?? [],
    historyMessageLoadVersion: messages.historyMessageLoadVersion,
    historyMessagePagination: isDisplayPaused
      ? { ...messages.historyMessagePagination, hasMore: false }
      : messages.historyMessagePagination,
    historyLoad: host.historyLoad,
    todos: messages.todos,
    runtimeActivities: activities.runtimeActivities,
    pendingFollowUps: followUpState.pendingFollowUps,
    pendingRequestUserInput: userInput.pendingRequestUserInput,
    pendingHITLRequest: interrupts.pendingHITLRequest,
    // Waiting for a decision may retain a local resolver, but is not execution.
    isLoading:
      runState.isLoading && !isThreadInterrupted && !hasPendingUserInput,
    isDisplayPaused,
    isThreadInterrupted,
    displayPause: isDisplayPaused
      ? (runState.pausedDisplay?.pause ?? null)
      : null,
    resumeDisplay: resume.resumeDisplay,
    isReady,
    error: runState.error,
    selectedModelId: messages.selectedModelId,
    setSelectedModelId: messages.setSelectedModelId,
    loadThread: threadLoading.loadThread,
    loadConversationMessages: history.loadConversationMessages,
    loadMoreConversationMessages: history.loadMoreConversationMessages,
    submit: submission.submit,
    stop: controls.stop,
    activeRunId: runState.activeRunId,
    pauseRun: controls.pauseRun,
    resumeRun: resume.resumeRun,
    reset: lifecycle.reset,
    removePendingFollowUp: followUpState.removePendingFollowUp,
    canSendPendingFollowUpNow: followUps.canSendPendingFollowUpNow,
    sendPendingFollowUpNow: followUps.sendPendingFollowUpNow,
    promotePendingFollowUpToSteer: followUps.promotePendingFollowUpToSteer,
    submitRequestUserInput: userInput.submitRequestUserInput,
    submitHITLDecision: interrupts.submitHITLDecision,
    stopRuntimeActivityItem: activities.stopRuntimeActivityItem,
    setThreadId: scope.setThreadId,
    setConnectorBindingIds: scope.setConnectorBindingIds,
  };

  return (
    <StreamContext.Provider value={value}>{children}</StreamContext.Provider>
  );
};
