import { useThreadActivitySubscription } from './activity/useThreadActivitySubscription';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  type ReactNode,
} from 'react';
import type { AgentRunInfo } from '../../lib/agent-runs';
import { reconcileAgentRun } from './messages/reconcile-agent-run';
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
  const reconcileExecution = useCallback(
    (threadId: string, run: AgentRunInfo) => {
      if (scope.activeThreadIdRef.current !== threadId) return;
      messages.setValues((previous) =>
        scope.activeThreadIdRef.current === threadId
          ? reconcileAgentRun(previous, run)
          : previous,
      );
    },
    [scope.activeThreadIdRef, messages.setValues],
  );
  const runState = useStreamRunState();
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

  // Keep Assistant views mounted; reset chat state only for a new binding.
  const bindingKey = JSON.stringify([projectId, projectSelection?.mode, runtimeKey]);
  const previousBinding = useRef({ key: bindingKey, runtimeKey });
  const navigationChanged = previousBinding.current.runtimeKey !== runtimeKey;
  const adoptingConversationProject = Boolean(
    projectId && scope.conversationId && conversationProject.resolved &&
    conversationProject.projectId === projectId,
  );
  const bindingChanged = previousBinding.current.key !== bindingKey &&
    (navigationChanged || !adoptingConversationProject);
  useLayoutEffect(() => {
    if (previousBinding.current.key === bindingKey) return;
    previousBinding.current = { key: bindingKey, runtimeKey };
    if (!navigationChanged && adoptingConversationProject) return;
    scope.initialSelectedThreadRef.current = null;
    // Project changes must not reopen the old initial thread. Explicit navigation may reload it.
    if (navigationChanged) scope.consumedInitialThreadRef.current = null;
    lifecycle.reset(navigationChanged ? initialThread ?? null : null, [], {
      suppressThreadChange: !navigationChanged,
    });
  }, [bindingKey, runtimeKey, navigationChanged, adoptingConversationProject, initialThread, lifecycle.reset]);

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

  useThreadActivitySubscription({
    ...messages,
    ...runState,
    ...transport,
    client: credentials.client,
    threadId: scope.threadId ?? null,
    conversationId: scope.conversationId,
    enabled:
      runtimeActivitiesEnabled &&
      !bindingChanged &&
      host.historyLoad.status !== 'loading' &&
      host.historyLoad.status !== 'error',
    scopeKey: JSON.stringify([
      assistantId,
      projectId,
      bindingKey,
      credentials.runtimeOrganizationId,
    ]),
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

  const isThreadInterrupted =
    runState.interruptedThreadId !== null &&
    runState.interruptedThreadId === scope.threadId;
  const hasPendingUserInput = Boolean(
    interrupts.pendingHITLRequest || userInput.pendingRequestUserInput,
  );
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
    values: messages.values,
    messages: messages.values.messages ?? [],
    historyMessageLoadVersion: messages.historyMessageLoadVersion,
    historyMessagePagination: messages.historyMessagePagination,
    historyLoad: host.historyLoad,
    todos: messages.todos,
    runtimeActivities: activities.runtimeActivities,
    pendingFollowUps: followUpState.pendingFollowUps,
    pendingRequestUserInput: userInput.pendingRequestUserInput,
    pendingHITLRequest: interrupts.pendingHITLRequest,
    // Waiting for a decision may retain a local resolver, but is not execution.
    isLoading:
      runState.isLoading && !isThreadInterrupted && !hasPendingUserInput,
    isDisplayPaused: false,
    isThreadInterrupted,
    // Compatibility fields for embedders; messages are always server-backed.
    displayPause: null,
    resumeDisplay: async () => {},
    isReady,
    error: runState.error,
    selectedModelId: messages.selectedModelId,
    setSelectedModelId: messages.setSelectedModelId,
    loadThread: threadLoading.loadThread,
    loadConversationMessages: history.loadConversationMessages,
    loadMoreConversationMessages: history.loadMoreConversationMessages,
    reconcileAgentRun: reconcileExecution,
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
