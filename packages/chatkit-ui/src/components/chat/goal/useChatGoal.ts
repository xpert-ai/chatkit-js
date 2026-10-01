import type {
  ChatKitCommandSource,
  ChatKitGoalAdapter,
  ChatKitOptions,
  ThreadGoal,
} from '@xpert-ai/chatkit-types';
import * as React from 'react';
import { getComposerPlainText } from '../../../lib/composer-parts';
import { withConnectorBindingIds } from '../../../lib/conversation-connectors';
import { buildInjectedRequestOptions } from '../../../lib/request-options';
import type { RuntimeCapabilitiesSelection } from '../../../lib/runtime-capabilities';
import { hasSelectedRuntimeSlashCommand } from '../../../lib/slash-commands';
import {
  executeThreadGoalCommand,
  loadThreadGoal,
  parseGoalCommand,
} from '../../../lib/thread-goals';
import { createMessageId } from '../../../lib/utils';
import {
  createXpertThreadGoalAdapter,
  supportsXpertThreadGoalAdapter,
} from '../../../lib/xpert-thread-goal-adapter';
import type { HumanMessageWithMeta } from '../../thread/MessageList';
import type { useChatDraft } from '../composer/useChatDraft';
import type { useChatHistory } from '../history/useChatHistory';
import type { useChatStreamingFeedback } from '../messages/useChatStreamingFeedback';
import type { useRuntimeCapabilitiesState } from '../runtime-capabilities';
import type { useChatEnvironment } from '../session/useChatEnvironment';
import { GOAL_RUN_INPUT, isGoalAdapter } from './goal-utils';

type ChatGoalOptions = Pick<
  ReturnType<typeof useChatEnvironment>,
  'stream' | 'activeProjectId' | 't'
> &
  Pick<ReturnType<typeof useChatStreamingFeedback>, 'streamingNow'> &
  Pick<
    ReturnType<typeof useRuntimeCapabilitiesState>,
    | 'runtimeCapabilities'
    | 'effectiveSessionRuntimeCapabilities'
    | 'getRuntimeCapabilitiesForCommand'
    | 'setRuntimeCapabilityPalette'
    | 'runRuntimeCapabilities'
  > &
  Pick<ReturnType<typeof useChatHistory>, 'refreshThreads'> &
  Pick<
    ReturnType<typeof useChatDraft>,
    'composerPartsRef' | 'setComposerText' | 'focusComposerAt'
  > & {
    surface: 'main' | 'side';
    options: ChatKitOptions | null | undefined;
  };

export function useChatGoal({
  stream,
  activeProjectId,
  surface,
  options,
  streamingNow,
  runtimeCapabilities,
  effectiveSessionRuntimeCapabilities,
  t,
  refreshThreads,
  getRuntimeCapabilitiesForCommand,
  composerPartsRef,
  setComposerText,
  setRuntimeCapabilityPalette,
  focusComposerAt,
  runRuntimeCapabilities,
}: ChatGoalOptions) {
  const [threadGoal, setThreadGoal] = React.useState<ThreadGoal | null>(null);
  const [goalError, setGoalError] = React.useState<string | null>(null);
  const [isGoalLoading, setIsGoalLoading] = React.useState(false);
  const [isGoalPanelOpen, setIsGoalPanelOpen] = React.useState(false);
  const [isGoalObjectiveExpanded, setIsGoalObjectiveExpanded] =
    React.useState(false);

  const [goalElapsedStartedAt, setGoalElapsedStartedAt] = React.useState<
    number | null
  >(null);

  React.useEffect(() => {
    if (threadGoal?.status === 'active' && stream.isLoading) {
      setGoalElapsedStartedAt(Date.now());
      return;
    }
    setGoalElapsedStartedAt(null);
  }, [
    stream.isLoading,
    threadGoal?.elapsedSeconds,
    threadGoal?.id,
    threadGoal?.status,
  ]);

  React.useEffect(() => {
    setIsGoalObjectiveExpanded(false);
  }, [threadGoal?.id]);

  const goalRequestIdRef = React.useRef(0);
  const goalAbortControllerRef = React.useRef<AbortController | null>(null);
  const activeProjectIdRef = React.useRef(activeProjectId);

  activeProjectIdRef.current = activeProjectId;

  const hasCompletedGoal = threadGoal?.status === 'complete';
  const isGoalModeOpen = isGoalPanelOpen;
  const goalAdapter = React.useMemo<ChatKitGoalAdapter | null>(() => {
    if (surface !== 'main') return null;
    if (isGoalAdapter(options?.goal)) {
      return options.goal;
    }
    return supportsXpertThreadGoalAdapter(stream.client)
      ? createXpertThreadGoalAdapter(stream.client, {
          xpertId: stream.assistantId,
          projectId: activeProjectId,
        })
      : null;
  }, [
    activeProjectId,
    options?.goal,
    stream.assistantId,
    stream.client,
    surface,
  ]);

  const displayedGoalElapsedSeconds = threadGoal
    ? (threadGoal.elapsedSeconds ?? 0) +
      (goalElapsedStartedAt
        ? Math.max(0, Math.floor((streamingNow - goalElapsedStartedAt) / 1000))
        : 0)
    : 0;

  const goalCommandAvailable = hasSelectedRuntimeSlashCommand(
    surface === 'main' ? runtimeCapabilities : null,
    surface === 'main' ? effectiveSessionRuntimeCapabilities : null,
    'goal',
  );

  const showGoalStatus =
    goalCommandAvailable &&
    !hasCompletedGoal &&
    (Boolean(goalError) ||
      (threadGoal?.status === 'active' && stream.isLoading));

  React.useEffect(() => {
    setThreadGoal(stream.threadGoal);
  }, [stream.threadGoal]);

  React.useEffect(() => {
    const threadId = stream.threadId?.trim();
    if (!threadId || !goalCommandAvailable) {
      setThreadGoal(null);
      setGoalError(null);
      setIsGoalLoading(false);
      setIsGoalPanelOpen(false);
      return;
    }
    if (!goalAdapter) {
      setThreadGoal(null);
      setGoalError(null);
      setIsGoalLoading(false);
      setIsGoalPanelOpen(false);
      return;
    }

    const controller = new AbortController();
    setIsGoalLoading(true);
    setGoalError(null);

    void loadThreadGoal({
      goal: goalAdapter,
      threadId,
      signal: controller.signal,
    })
      .then((goal) => {
        if (!controller.signal.aborted) {
          setThreadGoal(goal);
        }
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) {
          return;
        }
        setGoalError(error instanceof Error ? error.message : String(error));
        setThreadGoal(null);
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setIsGoalLoading(false);
        }
      });

    return () => controller.abort();
  }, [goalAdapter, goalCommandAvailable, stream.threadId]);

  const handleGoalCommand = React.useCallback(
    async ({
      args,
      commandSource,
      runtimeCapabilities: commandRuntimeCapabilities,
      visibleInput,
    }: {
      args: string;
      commandSource: ChatKitCommandSource;
      runtimeCapabilities?: RuntimeCapabilitiesSelection;
      visibleInput?: string;
    }) => {
      const command = parseGoalCommand(args);
      const threadId = stream.threadId?.trim();
      setGoalError(null);

      if (!threadId) {
        if (command.type === 'show') {
          setThreadGoal(null);
          setIsGoalLoading(false);
          return;
        }
        if (command.type !== 'set' && command.type !== 'edit') {
          setGoalError(t('chat.goal.startThreadRequired'));
          return;
        }
      }
      if (!goalAdapter) {
        setGoalError(t('chat.goal.unavailable'));
        return;
      }

      goalAbortControllerRef.current?.abort();
      const goalAbortController = new AbortController();
      goalAbortControllerRef.current = goalAbortController;
      const goalRequestId = ++goalRequestIdRef.current;
      const goalProjectId = activeProjectId;
      setIsGoalLoading(true);
      try {
        const runtimeCapabilitiesForGoalSetup =
          commandRuntimeCapabilities || stream.connectorBindingIds.length
            ? withConnectorBindingIds(
                commandRuntimeCapabilities
                  ? { runtimeCapabilities: commandRuntimeCapabilities }
                  : undefined,
                stream.connectorBindingIds,
              ).runtimeCapabilities
            : undefined;
        const result = await executeThreadGoalCommand({
          goal: goalAdapter,
          threadId,
          assistantId: stream.assistantId,
          projectId: goalProjectId,
          command,
          runtimeCapabilities: runtimeCapabilitiesForGoalSetup,
          signal: goalAbortController.signal,
        });
        if (
          goalAbortController.signal.aborted ||
          goalRequestIdRef.current !== goalRequestId ||
          activeProjectIdRef.current !== goalProjectId
        ) {
          return;
        }
        if (!threadId && result.threadId) {
          stream.reset(result.threadId, []);
          void refreshThreads();
        }
        const startsGoalRun =
          result.goal?.status === 'active' &&
          (command.type === 'set' ||
            command.type === 'edit' ||
            command.type === 'resume');

        setThreadGoal(command.type === 'clear' ? null : result.goal);
        if (command.type === 'clear' || startsGoalRun) {
          setIsGoalPanelOpen(false);
        }
        if (startsGoalRun) {
          const goalRunThreadId = result.threadId ?? threadId;
          const runtimeCapabilitiesForGoalRun =
            getRuntimeCapabilitiesForCommand(commandRuntimeCapabilities);
          const inputPayload: {
            input: string;
            runtimeCapabilities?: RuntimeCapabilitiesSelection;
            commandSource: ChatKitCommandSource;
            goalRun: true;
            model?: string;
          } = {
            input: GOAL_RUN_INPUT,
            commandSource,
            goalRun: true,
            ...(stream.selectedModelId
              ? { model: stream.selectedModelId }
              : {}),
            ...(runtimeCapabilitiesForGoalRun
              ? { runtimeCapabilities: runtimeCapabilitiesForGoalRun }
              : {}),
          };
          const requestOptions = buildInjectedRequestOptions({
            defaults: options?.request,
            humanInput: inputPayload,
          });
          const visibleGoalMessage: HumanMessageWithMeta | null = visibleInput
            ? {
                id: createMessageId(),
                type: 'human',
                content: visibleInput,
                submittedInput: visibleInput,
                ...(stream.selectedModelId
                  ? { model: stream.selectedModelId }
                  : {}),
              }
            : null;

          void stream
            .submit(
              {
                input: inputPayload,
                ...(requestOptions.state
                  ? { state: requestOptions.state }
                  : {}),
              },
              {
                ...(goalRunThreadId && !threadId
                  ? {
                      threadId: goalRunThreadId,
                      joinExistingThread: true,
                    }
                  : {}),
                ...(requestOptions.context
                  ? { context: requestOptions.context }
                  : {}),
                ...(requestOptions.config
                  ? { config: requestOptions.config }
                  : {}),
                ...(visibleGoalMessage
                  ? {
                      preserveOptimisticMessages: true,
                      optimisticValues: (prev) => {
                        const prevMessages = prev?.messages ?? [];
                        return {
                          ...prev,
                          messages: [...prevMessages, visibleGoalMessage],
                        };
                      },
                    }
                  : {}),
              },
            )
            .catch((error: unknown) => {
              setGoalError(
                error instanceof Error ? error.message : String(error),
              );
            });
        }
      } catch (error) {
        if (
          goalAbortController.signal.aborted ||
          goalRequestIdRef.current !== goalRequestId ||
          activeProjectIdRef.current !== goalProjectId
        ) {
          return;
        }
        setGoalError(error instanceof Error ? error.message : String(error));
      } finally {
        if (goalRequestIdRef.current === goalRequestId) {
          if (goalAbortControllerRef.current === goalAbortController) {
            goalAbortControllerRef.current = null;
          }
          setIsGoalLoading(false);
        }
      }
    },
    [
      activeProjectId,
      getRuntimeCapabilitiesForCommand,
      goalAdapter,
      options?.request,
      refreshThreads,
      stream,
      t,
    ],
  );

  const handleGoalPanelOpenChange = React.useCallback((open: boolean) => {
    setIsGoalPanelOpen(open);
  }, []);

  const submitGoalModeDraft = React.useCallback(() => {
    const objective = getComposerPlainText(composerPartsRef.current).trim();
    if (!isGoalModeOpen || !goalCommandAvailable || !objective) {
      return false;
    }

    setComposerText('', 0);
    setRuntimeCapabilityPalette(null);
    focusComposerAt(0);
    void handleGoalCommand({
      args: objective,
      commandSource: {
        type: 'slash_command',
        name: 'goal',
        source: 'runtime',
        executionType: 'insert_invocation',
      },
      runtimeCapabilities: runRuntimeCapabilities,
      visibleInput: objective,
    });
    return true;
  }, [
    focusComposerAt,
    goalCommandAvailable,
    handleGoalCommand,
    isGoalModeOpen,
    runRuntimeCapabilities,
    setComposerText,
    setRuntimeCapabilityPalette,
  ]);

  React.useEffect(() => {
    setIsGoalLoading(false);
    return () => {
      goalRequestIdRef.current += 1;
      goalAbortControllerRef.current?.abort();
      goalAbortControllerRef.current = null;
    };
  }, [activeProjectId, stream.assistantId]);
  return {
    threadGoal,
    setIsGoalPanelOpen,
    handleGoalCommand,
    submitGoalModeDraft,
    showGoalStatus,
    isGoalObjectiveExpanded,
    isGoalLoading,
    goalError,
    displayedGoalElapsedSeconds,
    setIsGoalObjectiveExpanded,
    goalCommandAvailable,
    isGoalModeOpen,
    handleGoalPanelOpenChange,
  };
}
