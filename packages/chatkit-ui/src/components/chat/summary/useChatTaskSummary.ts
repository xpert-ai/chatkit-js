import type { ChatKitOptions } from '@xpert-ai/chatkit-types';
import * as React from 'react';
import { useTaskSummary } from '../../../hooks/useTaskSummary';
import { useOpenTaskSummaryResource } from '../../../hooks/useOpenTaskSummaryResource';
import {
  collectLiveTaskSummary,
  type TaskSummaryMessage,
  type TaskSummaryPending,
  type TaskSummaryRuntimeItem,
} from '../../../lib/task-summary';
import type { useStreamContext } from '../../../providers/Stream';
import type { TaskSummaryProps } from '../../task-summary/TaskSummary';
import type { useChatDraft } from '../composer/useChatDraft';
import type { useChatGoal } from '../goal/useChatGoal';
import type { useChatHost } from '../host/useChatHost';
import type { useChatQuotes } from '../messages/useChatQuotes';
import type { useChatViewport } from '../messages/useChatViewport';
import type { useRuntimeCapabilitiesState } from '../runtime-capabilities';
import type { useChatEnvironment } from '../session/useChatEnvironment';

const TASK_SUMMARY_PANEL_WIDTH_REM = 20;

const TASK_SUMMARY_PANEL_EDGE_INSET_REM = 1.25;

const TASK_SUMMARY_PANEL_SAFE_GAP_REM = 0.75;

type ChatTaskSummaryOptions = Pick<
  ReturnType<typeof useChatEnvironment>,
  'stream' | 't'
> &
  Pick<
    ReturnType<typeof useRuntimeCapabilitiesState>,
    'runtimeCapabilityOptions'
  > &
  Pick<ReturnType<typeof useChatGoal>, 'threadGoal'> &
  Pick<
    ReturnType<typeof useChatViewport>,
    'messageNavigationAnchorsRef' | 'disableAutoFollow'
  > &
  Pick<ReturnType<typeof useChatQuotes>, 'clearQuoteSelection'> &
  Pick<ReturnType<typeof useChatHost>, 'parentMessenger'> &
  Pick<ReturnType<typeof useChatDraft>, 'focusComposerAt'> & {
    options: ChatKitOptions | null | undefined;
    pendingFollowUps: ReturnType<typeof useStreamContext>['pendingFollowUps'];
    messages: ReturnType<typeof useStreamContext>['messages'];
    viewportRef: React.RefObject<HTMLDivElement | null>;
    chatColumnRef: React.RefObject<HTMLDivElement | null>;
    layoutMaxWidth: string | number | undefined;
    characterPresentation?: boolean;
  };

export function useChatTaskSummary({
  options,
  stream,
  pendingFollowUps,
  t,
  runtimeCapabilityOptions,
  messages,
  threadGoal,
  messageNavigationAnchorsRef,
  disableAutoFollow,
  clearQuoteSelection,
  viewportRef,
  chatColumnRef,
  layoutMaxWidth,
  focusComposerAt,
  characterPresentation = false,
}: ChatTaskSummaryOptions) {
  const taskSummaryEnabled = options?.taskSummary?.enabled === true;
  const taskSummaryConversationId = stream.conversationId ?? null;
  const [taskSummaryDocked, setTaskSummaryDocked] = React.useState(false);
  const [taskSummaryOpen, setTaskSummaryOpen] = React.useState(false);
  const manuallyClosedTaskSummaryConversationIdsRef = React.useRef(
    new Set<string>(),
  );

  const liveTaskSummaryPending = React.useMemo<TaskSummaryPending[]>(() => {
    const followUps = pendingFollowUps.map((item) => ({
      id: `follow-up:${item.id}`,
      kind: 'follow_up' as const,
      title:
        item.mode === 'steer'
          ? t('taskSummary.pending.steer')
          : t('taskSummary.pending.followUp'),
      messageId: item.clientMessageId,
      createdAt: new Date(item.createdAt).toISOString(),
    }));
    const userInput = stream.pendingRequestUserInput
      ? [
          {
            id: `user-input:${stream.pendingRequestUserInput.id}`,
            kind: 'user_input' as const,
            title:
              stream.pendingRequestUserInput.params.questions[0]?.header ||
              t('taskSummary.pending.userInput'),
            createdAt: new Date(
              stream.pendingRequestUserInput.createdAt,
            ).toISOString(),
          },
        ]
      : [];
    const approvals = stream.pendingHITLRequest
      ? [
          {
            id: `approval:${stream.pendingHITLRequest.id}`,
            kind: 'approval' as const,
            title: t('taskSummary.pending.approval'),
            createdAt: new Date(
              stream.pendingHITLRequest.createdAt,
            ).toISOString(),
          },
        ]
      : [];
    return [...approvals, ...userInput, ...followUps];
  }, [
    pendingFollowUps,
    stream.pendingHITLRequest,
    stream.pendingRequestUserInput,
    t,
  ]);

  const liveTaskSummaryRunning = React.useMemo<TaskSummaryRuntimeItem[]>(
    () =>
      stream.runtimeActivities.sandboxServices.services
        .filter(
          (service) =>
            service.status === 'starting' ||
            service.status === 'running' ||
            service.status === 'stopping',
        )
        .map((service) => ({
          id:
            service.id ??
            `${service.provider}:${service.name}:${service.actualPort ?? service.requestedPort ?? ''}`,
          title: service.name,
          status: service.status,
          description:
            service.actualPort || service.requestedPort
              ? `:${service.actualPort ?? service.requestedPort}`
              : undefined,
          resource: {
            type: 'browser' as const,
            serviceId: service.id,
            url: service.previewUrl ?? undefined,
          },
          updatedAt: service.startedAt ?? undefined,
        })),
    [stream.runtimeActivities.sandboxServices.services],
  );

  const taskSummaryAgentNames = React.useMemo(() => {
    const names = new Map<string, string>();
    runtimeCapabilityOptions.forEach((option) => {
      if (option.type !== 'subAgent') return;
      const name = option.capability.name?.trim();
      if (!name) return;
      names.set(option.id, name);
      const agentKey = option.capability.agentKey?.trim();
      if (agentKey) names.set(agentKey, name);
    });
    return names;
  }, [runtimeCapabilityOptions]);

  const liveTaskSummary = React.useMemo(
    () =>
      collectLiveTaskSummary({
        messages: messages.map(
          (message): TaskSummaryMessage => ({
            id: message.id,
            content: message.content,
            createdAt: message.createdAt,
            updatedAt: message.updatedAt,
            taskSummary: message.taskSummary,
            references: message.references,
            attachments: message.attachments,
            fileAssets: message.fileAssets,
            agentRuns: message.agentRuns,
            runtimeCapabilities: message.runtimeCapabilities,
          }),
        ),
        goal: threadGoal,
        todos: stream.todos,
        pending: liveTaskSummaryPending,
        running: liveTaskSummaryRunning,
        agentNames: taskSummaryAgentNames,
      }),
    [
      liveTaskSummaryPending,
      liveTaskSummaryRunning,
      messages,
      stream.todos,
      taskSummaryAgentNames,
      threadGoal,
    ],
  );

  const taskSummary = useTaskSummary({
    enabled: taskSummaryEnabled,
    conversationId: taskSummaryConversationId,
    client: stream.client,
    live: liveTaskSummary,
    refreshVersion: stream.historyMessageLoadVersion,
  });

  const navigateToTaskSummaryMessage = React.useCallback(
    async (messageId: string) => {
      try {
        let anchor = messageNavigationAnchorsRef.current.get(messageId);
        let pageCount = 0;
        while (!anchor && pageCount < 100) {
          const loaded = await stream.loadMoreConversationMessages();
          if (!loaded.length) break;
          pageCount += 1;
          await new Promise<void>((resolve) =>
            requestAnimationFrame(() => resolve()),
          );
          anchor = messageNavigationAnchorsRef.current.get(messageId);
        }
        if (!anchor) return;
        disableAutoFollow();
        clearQuoteSelection();
        anchor.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } catch (error) {
        console.warn('Failed to locate task summary message', error);
      }
    },
    [clearQuoteSelection, disableAutoFollow, stream],
  );

  const openTaskSummaryResource = useOpenTaskSummaryResource(
    taskSummary.summary.outputs,
    taskSummaryConversationId ?? undefined,
  );

  React.useLayoutEffect(() => {
    if (characterPresentation) {
      setTaskSummaryDocked(true);
      return;
    }
    if (!taskSummaryEnabled) {
      setTaskSummaryDocked(false);
      return;
    }

    const viewport = viewportRef.current;
    const chatColumn = chatColumnRef.current;
    if (!viewport || !chatColumn) {
      setTaskSummaryDocked(false);
      return;
    }

    const updateDockedState = () => {
      const viewportRect = viewport.getBoundingClientRect();
      const chatColumnRect = chatColumn.getBoundingClientRect();
      const rootFontSize = Number.parseFloat(
        window.getComputedStyle(document.documentElement).fontSize,
      );
      const remInPixels = Number.isFinite(rootFontSize) ? rootFontSize : 16;
      const requiredSideSpace =
        (TASK_SUMMARY_PANEL_WIDTH_REM +
          TASK_SUMMARY_PANEL_EDGE_INSET_REM +
          TASK_SUMMARY_PANEL_SAFE_GAP_REM) *
        remInPixels;
      const availableSideSpace = viewportRect.right - chatColumnRect.right;
      setTaskSummaryDocked(availableSideSpace >= requiredSideSpace);
    };

    updateDockedState();
    window.addEventListener('resize', updateDockedState);
    const resizeObserver =
      typeof ResizeObserver === 'function'
        ? new ResizeObserver(updateDockedState)
        : null;
    resizeObserver?.observe(viewport);
    resizeObserver?.observe(chatColumn);

    return () => {
      window.removeEventListener('resize', updateDockedState);
      resizeObserver?.disconnect();
    };
  }, [layoutMaxWidth, taskSummaryEnabled, characterPresentation]);

  const taskSummaryAvailable = Boolean(
    taskSummaryEnabled &&
    (characterPresentation || (stream.threadId && taskSummaryConversationId)),
  );

  const handleTaskSummaryOpenChange = React.useCallback(
    (open: boolean) => {
      setTaskSummaryOpen(open);
      if (!taskSummaryConversationId) return;
      if (open) {
        manuallyClosedTaskSummaryConversationIdsRef.current.delete(
          taskSummaryConversationId,
        );
        return;
      }
      manuallyClosedTaskSummaryConversationIdsRef.current.add(
        taskSummaryConversationId,
      );
    },
    [taskSummaryConversationId],
  );

  React.useEffect(() => {
    if (characterPresentation) {
      setTaskSummaryOpen(false);
      return;
    }
    if (!taskSummaryDocked) {
      setTaskSummaryOpen(false);
    }
  }, [taskSummaryDocked, characterPresentation, stream.assistantId]);

  React.useEffect(() => {
    if (
      characterPresentation ||
      !taskSummaryDocked ||
      !taskSummaryAvailable ||
      !taskSummaryConversationId ||
      manuallyClosedTaskSummaryConversationIdsRef.current.has(
        taskSummaryConversationId,
      )
    ) {
      return;
    }

    setTaskSummaryOpen(true);
  }, [
    taskSummaryAvailable,
    taskSummaryConversationId,
    taskSummaryDocked,
    characterPresentation,
  ]);

  const taskSummaryProps: TaskSummaryProps = {
    summary: taskSummary.summary,
    historyError: taskSummary.historyError,
    loadingSections: taskSummary.loadingSections,
    loadedSectionCounts: taskSummary.loadedSectionCounts,
    onRetryHistory: taskSummary.retryHistory,
    onLoadSection: taskSummary.loadSection,
    onNavigateMessage: (messageId) => {
      void navigateToTaskSummaryMessage(messageId);
    },
    onFocusComposer: () => focusComposerAt(),
    onOpenResource: openTaskSummaryResource,
  };
  return {
    taskSummaryDocked,
    taskSummaryAvailable,
    taskSummaryProps,
    taskSummaryOpen,
    handleTaskSummaryOpenChange,
  };
}
