import type { Message } from '@langchain/core/messages';
import type { ToolCall } from '@langchain/core/messages/tool';
import {
  ChatMessageEventTypeEnum,
  ChatMessageTypeEnum,
  parseFileActivityContent,
  parseResourceCardContent,
  type ChatEventEnvelope,
  type TMessageContentComponent,
  type TThreadContextUsageEvent,
  type ThreadGoal,
} from '@xpert-ai/chatkit-types';
import { parseWorkbenchViewOpenEvent } from '@xpert-ai/xpert-sdk';
import type React from 'react';
import {
  createAgentEventContent,
  isMiddlewareAgentRunInfo,
  normalizeAgentRunInfo,
} from '../../../lib/agent-runs';
import { parseFollowUpConsumedEvent } from '../../../lib/follow-up-consumed';
import {
  extractMessageExecutionId,
  isMessageMetadataContainer,
} from '../../../lib/message-metadata';
import {
  resolveRuntimeActivityTriggerFromMessageComponent,
  type RuntimeActivityTrigger,
} from '../../../lib/runtime-activity';
import { upsertAgentRunOnLatestMessage } from '../../../lib/stream-agent-runs';
import { applyFileActivityReceipt } from '../../../lib/stream-file-activity';
import { applyResourceCard } from '../../../lib/stream-resource-card';
import {
  extractThreadContextUsageEvent,
  isThreadContextUsageRenderArtifact,
} from '../../../lib/thread-context-usage';
import {
  parseThreadGoalClearedEvent,
  parseThreadGoalUpdatedEvent,
  parseThreadGoalUpdatedPatchEvent,
  type ThreadGoalUpdatedPatchEvent,
} from '../../../lib/thread-goals';
import {
  resolveTodoListSnapshotFromMessageComponent,
  type TodoListSnapshot,
} from '../../../lib/todos';
import { createMessageId } from '../../../lib/utils';
import type { ParentMessenger } from '../../ParentMessenger';
import {
  mapLangGraphEventToChatKit,
  type LangGraphEventContext,
  type LangGraphEventState,
} from '../../langGraphEventMapper';
import {
  collectClientToolCalls,
  rememberClientToolCalls,
} from '../interrupts/client-tools';
import {
  createMessageFromData,
  extractMessageMeta,
} from '../messages/metadata';
import {
  appendMessageComponent,
  appendMessages,
  appendStreamTextToMessage,
  applyMessageData,
  findAssistantMessageIndex,
  findLatestAssistantMessageIndex,
  isAssistantMessage,
  mergePreservedMessages,
  startFreshAssistantMessageIfNeeded,
  updateAssistantMessage,
} from '../messages/reducer';
import type { ChatKitAIMessage, StateType } from '../types';
import {
  getStreamEventErrorMessage,
  isStreamCompletionMarker,
  parseEventData,
  type StreamChunk,
} from './envelope';

type StreamEventState = LangGraphEventState & {
  /** Message identity for deltas, including replay into already loaded history. */
  activeMessageId?: string;
};

export function applyStreamEvent(
  chunk: StreamChunk,
  setValues: React.Dispatch<React.SetStateAction<StateType>>,
  setError: React.Dispatch<React.SetStateAction<unknown>>,
  sendEvent: ParentMessenger['sendEvent'],
  interrupts: unknown[],
  langGraphEventState: StreamEventState,
  eventContext?: LangGraphEventContext,
  onExecutionId?: (executionId: string | undefined) => void,
  onThreadContextUsage?: (event: TThreadContextUsageEvent) => void,
  onFollowUpConsumed?: (
    event: ReturnType<typeof parseFollowUpConsumedEvent>,
  ) => void,
  consumeFreshAssistantSplit?: () => boolean,
  getCurrentTodos?: () => TodoListSnapshot | null,
  onTodosChange?: (snapshot: TodoListSnapshot | null) => void,
  onRuntimeActivityTrigger?: (trigger: RuntimeActivityTrigger) => void,
  onThreadGoalUpdated?: (goal: ThreadGoal) => void,
  onThreadGoalCleared?: (threadId: string) => void,
  onThreadGoalPatched?: (event: ThreadGoalUpdatedPatchEvent) => void,
  preservedMessages?: ChatKitAIMessage[],
  onConversationStart?: (conversationId: string) => void,
  onConversationEnd?: (status: string) => void,
) {
  const parsed = parseEventData(chunk.data);
  if (parsed == null) return;

  // Redis persists this transport marker after the last chat event. It is not
  // a ChatKit message and must never enter the display snapshot.
  if (isStreamCompletionMarker(parsed)) return;

  if (chunk.event === 'error') {
    const message =
      typeof parsed === 'string' ? parsed : JSON.stringify(parsed);
    setError(new Error(message));
    return;
  }

  if (isMessageMetadataContainer(parsed) && Array.isArray(parsed.messages)) {
    const normalizedMessages = parsed.messages
      .map((item) => createMessageFromData(item))
      .filter((item): item is ChatKitAIMessage => Boolean(item));
    setValues((prev) => ({
      ...prev,
      messages: mergePreservedMessages(
        normalizedMessages,
        preservedMessages,
        prev.messages ?? [],
      ),
    }));
    return;
  }

  if (typeof parsed === 'string') {
    const shouldStartFreshAssistant = consumeFreshAssistantSplit?.() ?? false;
    if (shouldStartFreshAssistant)
      langGraphEventState.activeMessageId = undefined;
    startFreshAssistantMessageIfNeeded(setValues, shouldStartFreshAssistant);
    appendStreamTextToMessage(
      setValues,
      parsed,
      langGraphEventState.activeMessageId,
    );
    return;
  }

  if (Array.isArray(parsed)) {
    const messages = parsed
      .map((item) => createMessageFromData(item))
      .filter((item): item is Message => Boolean(item));
    appendMessages(setValues, messages);
    return;
  }

  if (typeof parsed !== 'object' || parsed == null) return;

  const payload = parsed as ChatEventEnvelope<TMessageContentComponent<any>>;
  const payloadType: ChatMessageTypeEnum = payload.type;
  const resourceCard = parseResourceCardContent(payload.data);
  if (resourceCard && payloadType === ChatMessageTypeEnum.MESSAGE) {
    setValues((prev) => ({
      ...prev,
      messages: applyResourceCard(prev.messages, resourceCard),
    }));
    return;
  }

  const fileActivity = parseFileActivityContent(payload.data);
  if (
    fileActivity &&
    (payloadType === ChatMessageTypeEnum.MESSAGE ||
      (payloadType === ChatMessageTypeEnum.EVENT &&
        payload.event === ChatMessageEventTypeEnum.ON_CHAT_EVENT))
  ) {
    setValues((prev) => ({
      ...prev,
      messages: applyFileActivityReceipt(prev.messages, fileActivity),
    }));
    return;
  }

  if (payloadType === ChatMessageTypeEnum.MESSAGE) {
    if (typeof payload.data === 'string') {
      const shouldStartFreshAssistant = consumeFreshAssistantSplit?.() ?? false;
      if (shouldStartFreshAssistant)
        langGraphEventState.activeMessageId = undefined;
      startFreshAssistantMessageIfNeeded(setValues, shouldStartFreshAssistant);
      appendStreamTextToMessage(
        setValues,
        payload.data,
        langGraphEventState.activeMessageId,
      );
      return;
    }

    const message = payload.data;
    if (message.type === 'component') {
      const runtimeActivityTrigger =
        resolveRuntimeActivityTriggerFromMessageComponent(message);
      if (runtimeActivityTrigger) {
        onRuntimeActivityTrigger?.({
          ...runtimeActivityTrigger,
          threadId: eventContext?.threadId ?? null,
        });
      }

      const todoResolution = resolveTodoListSnapshotFromMessageComponent(
        message,
        getCurrentTodos?.() ?? null,
      );
      if (todoResolution.matched) {
        onTodosChange?.(todoResolution.snapshot);
        return;
      }
      sendEvent('public_event', ['log', { ...message, name: 'component' }]);
    }
    const shouldStartFreshAssistant = consumeFreshAssistantSplit?.() ?? false;
    if (shouldStartFreshAssistant)
      langGraphEventState.activeMessageId = undefined;
    startFreshAssistantMessageIfNeeded(setValues, shouldStartFreshAssistant);
    appendMessageComponent(
      setValues,
      message,
      langGraphEventState.activeMessageId,
    );
    return;
  }

  if (payloadType === ChatMessageTypeEnum.EVENT) {
    const eventType = (
      typeof payload.event === 'string' ? payload.event.toLowerCase() : ''
    ) as ChatMessageEventTypeEnum;
    const eventPayloadData: unknown = payload.data;
    const eventData = isMessageMetadataContainer(eventPayloadData)
      ? eventPayloadData
      : null;
    const meta = eventData ? extractMessageMeta(eventData) : {};
    const executionId = eventData
      ? extractMessageExecutionId(eventData)
      : undefined;

    mapLangGraphEventToChatKit({
      eventType,
      data: eventPayloadData,
      tags: payload.tags,
      messageType: typeof meta.type === 'string' ? meta.type : undefined,
      executionId,
      sendEvent,
      state: langGraphEventState,
      context: eventContext,
    });

    const eventErrorMessage = getStreamEventErrorMessage(
      eventType,
      eventPayloadData,
    );
    if (eventErrorMessage) {
      setError(new Error(eventErrorMessage));
    }

    if (
      eventType === ChatMessageEventTypeEnum.ON_CONVERSATION_START &&
      eventData &&
      typeof eventData.id === 'string'
    ) {
      const conversationId = eventData.id.trim();
      if (conversationId) {
        onConversationStart?.(conversationId);
      }
      const acknowledged = eventData.userMessage;
      if (
        isMessageMetadataContainer(acknowledged) &&
        typeof acknowledged.id === 'string' &&
        typeof acknowledged.clientMessageId === 'string'
      ) {
        const persistedId = acknowledged.id;
        const acknowledgedMeta = extractMessageMeta(acknowledged);
        setValues((previous) => ({
          ...previous,
          messages: (previous.messages ?? []).map((message) =>
            message.id === acknowledged.clientMessageId
              ? {
                  ...message,
                  id: persistedId,
                  ...(acknowledgedMeta.createdAt
                    ? { createdAt: acknowledgedMeta.createdAt }
                    : {}),
                  ...(acknowledgedMeta.updatedAt
                    ? { updatedAt: acknowledgedMeta.updatedAt }
                    : {}),
                }
              : message,
          ),
        }));
      }
    }

    if (
      eventType === ChatMessageEventTypeEnum.ON_CONVERSATION_END &&
      typeof eventData?.status === 'string'
    ) {
      onConversationEnd?.(eventData.status);
    }
    switch (eventType) {
      case ChatMessageEventTypeEnum.ON_CONVERSATION_START:
      case ChatMessageEventTypeEnum.ON_CONVERSATION_END: {
        if (eventData && Array.isArray(eventData.messages)) {
          const normalizedMessages = eventData.messages
            .map((item) => createMessageFromData(item))
            .filter((item): item is ChatKitAIMessage => Boolean(item));
          setValues((prev) => ({
            ...prev,
            messages: mergePreservedMessages(
              normalizedMessages,
              preservedMessages,
              prev.messages ?? [],
            ),
          }));
        }
        break;
      }
      case ChatMessageEventTypeEnum.ON_AGENT_START:
      case ChatMessageEventTypeEnum.ON_AGENT_END: {
        const agentRun = normalizeAgentRunInfo(eventPayloadData, eventType);
        if (agentRun && !isMiddlewareAgentRunInfo(agentRun)) {
          upsertAgentRunOnLatestMessage(
            setValues,
            agentRun,
            findLatestAssistantMessageIndex,
            (run) =>
              ({
                id: createMessageId(),
                type: 'ai',
                content: '',
                agentRuns: [run],
              }) as ChatKitAIMessage,
          );
        }
        break;
      }
      case ChatMessageEventTypeEnum.ON_MESSAGE_START: {
        langGraphEventState.activeMessageId = meta.id;
        if (executionId) {
          onExecutionId?.(executionId);
        }
        const message: ChatKitAIMessage = {
          id: meta.id ?? createMessageId(),
          type: meta.type ?? 'ai',
          content: meta.content ?? '',
          executionId,
          ...(meta.createdAt ? { createdAt: meta.createdAt } : {}),
          ...(meta.updatedAt ? { updatedAt: meta.updatedAt } : {}),
          ...(meta.status ? { status: meta.status } : {}),
          ...(meta.references ? { references: meta.references } : {}),
          ...(meta.attachments ? { attachments: meta.attachments } : {}),
          ...(meta.fileAssets ? { fileAssets: meta.fileAssets } : {}),
          ...(meta.submittedInput !== undefined
            ? { submittedInput: meta.submittedInput }
            : {}),
          ...(meta.referenceComposition
            ? { referenceComposition: meta.referenceComposition }
            : {}),
          ...(meta.runtimeCapabilities
            ? { runtimeCapabilities: meta.runtimeCapabilities }
            : {}),
          ...(meta.clientToolCalls
            ? { clientToolCalls: meta.clientToolCalls }
            : {}),
        };
        setValues((prev) => {
          const messages = prev.messages ?? [];
          const shouldStartFreshAssistant =
            consumeFreshAssistantSplit?.() ?? false;
          const lastAssistantIndex = findAssistantMessageIndex(
            messages,
            meta.id,
          );
          const last =
            lastAssistantIndex >= 0 ? messages[lastAssistantIndex] : undefined;
          if (!shouldStartFreshAssistant && last && isAssistantMessage(last)) {
            if (
              meta.id
                ? last.id === meta.id
                : executionId && last.executionId === executionId
            ) {
              const nextMessages = [...messages];
              const nextLast: ChatKitAIMessage = {
                ...last,
                executionId,
                ...(meta.createdAt ? { createdAt: meta.createdAt } : {}),
                ...(meta.updatedAt ? { updatedAt: meta.updatedAt } : {}),
                ...(meta.status ? { status: meta.status } : {}),
                ...(meta.id ? { id: meta.id } : {}),
                ...(meta.type ? { type: meta.type } : {}),
                ...(meta.references ? { references: meta.references } : {}),
                ...(meta.attachments ? { attachments: meta.attachments } : {}),
                ...(meta.fileAssets ? { fileAssets: meta.fileAssets } : {}),
                ...(meta.submittedInput !== undefined
                  ? { submittedInput: meta.submittedInput }
                  : {}),
                ...(meta.referenceComposition
                  ? { referenceComposition: meta.referenceComposition }
                  : {}),
                ...(meta.runtimeCapabilities
                  ? { runtimeCapabilities: meta.runtimeCapabilities }
                  : {}),
                ...(meta.clientToolCalls
                  ? { clientToolCalls: meta.clientToolCalls }
                  : {}),
              };
              if (
                meta.content !== undefined &&
                (last.content == null ||
                  (typeof last.content === 'string' &&
                    last.content.length === 0))
              ) {
                nextLast.content = meta.content;
              }
              nextMessages[lastAssistantIndex] = nextLast;
              return { ...prev, messages: nextMessages };
            }
            // Only reuse a trailing empty placeholder. An empty assistant
            // message with newer items after it belongs to an earlier failed
            // run; replacing it in place would insert the new response above
            // those items.
            if (
              !last.executionId &&
              typeof last.content === 'string' &&
              last.content.length === 0 &&
              lastAssistantIndex === messages.length - 1
            ) {
              const nextMessages = [...messages];
              nextMessages[lastAssistantIndex] = {
                ...message,
                ...(last.agentRuns ? { agentRuns: last.agentRuns } : {}),
              };
              return { ...prev, messages: nextMessages };
            }
          }
          return { ...prev, messages: [...messages, message] };
        });
        break;
      }
      case ChatMessageEventTypeEnum.ON_MESSAGE_END: {
        if (
          meta.content === undefined &&
          meta.id === undefined &&
          meta.type === undefined &&
          meta.updatedAt === undefined &&
          meta.agentRuns === undefined &&
          !meta.runtimeCapabilities
        ) {
          break;
        }
        updateAssistantMessage(
          setValues,
          (message) => {
            return {
              ...(message as ChatKitAIMessage),
              ...(meta.createdAt ? { createdAt: meta.createdAt } : {}),
              ...(meta.updatedAt ? { updatedAt: meta.updatedAt } : {}),
              ...(meta.status ? { status: meta.status } : {}),
              ...(meta.agentRuns ? { agentRuns: meta.agentRuns } : {}),
              ...(meta.id ? { id: meta.id } : {}),
              ...(meta.type ? { type: meta.type } : {}),
              ...(meta.branching ? { branching: meta.branching } : {}),
              ...(meta.content !== undefined ? { content: meta.content } : {}),
              ...(meta.references ? { references: meta.references } : {}),
              ...(meta.submittedInput !== undefined
                ? { submittedInput: meta.submittedInput }
                : {}),
              ...(meta.referenceComposition
                ? { referenceComposition: meta.referenceComposition }
                : {}),
              ...(meta.runtimeCapabilities
                ? { runtimeCapabilities: meta.runtimeCapabilities }
                : {}),
              ...(meta.clientToolCalls
                ? { clientToolCalls: meta.clientToolCalls }
                : {}),
            };
          },
          meta.id,
        );
        break;
      }
      case ChatMessageEventTypeEnum.ON_INTERRUPT: {
        interrupts.push(payload.data);
        rememberClientToolCalls(
          setValues,
          collectClientToolCalls(payload.data),
        );
        break;
      }
      case ChatMessageEventTypeEnum.ON_CLIENT_EFFECT: {
        const toolCall = payload.data as unknown as ToolCall;
        sendEvent('public_event', [
          'effect',
          { name: toolCall.name, data: toolCall.args },
        ]);
        break;
      }
      case ChatMessageEventTypeEnum.ON_CHAT_EVENT: {
        // The live log already delivered this UI request; it is not conversation content.
        if (parseWorkbenchViewOpenEvent(payload.data)) break;
        const contextUsageEvent = extractThreadContextUsageEvent(payload.data);
        if (contextUsageEvent) {
          onThreadContextUsage?.(contextUsageEvent);
          break;
        }
        if (isThreadContextUsageRenderArtifact(payload.data)) {
          break;
        }

        const goalUpdatedEvent = parseThreadGoalUpdatedEvent(payload.data);
        if (goalUpdatedEvent) {
          onThreadGoalUpdated?.(goalUpdatedEvent.goal);
          break;
        }

        const goalPatchEvent = parseThreadGoalUpdatedPatchEvent(payload.data);
        if (goalPatchEvent) {
          onThreadGoalPatched?.(goalPatchEvent);
          break;
        }

        const goalClearedEvent = parseThreadGoalClearedEvent(payload.data);
        if (goalClearedEvent) {
          onThreadGoalCleared?.(goalClearedEvent.threadId);
          break;
        }

        const followUpConsumedEvent = parseFollowUpConsumedEvent(payload.data);
        if (followUpConsumedEvent) {
          onFollowUpConsumed?.(followUpConsumedEvent);
          break;
        }

        const agentEvent = createAgentEventContent(payload.data);
        if (agentEvent) {
          const shouldStartFreshAssistant =
            consumeFreshAssistantSplit?.() ?? false;
          startFreshAssistantMessageIfNeeded(
            setValues,
            shouldStartFreshAssistant,
          );
          appendMessageComponent(setValues, agentEvent);
        }
        break;
      }
      default:
        break;
    }
    return;
  }

  if ('data' in payload) {
    const shouldStartFreshAssistant = consumeFreshAssistantSplit?.() ?? false;
    startFreshAssistantMessageIfNeeded(setValues, shouldStartFreshAssistant);
    applyMessageData(setValues, payload.data);
    return;
  }

  const fallbackMessage = createMessageFromData(parsed);
  if (fallbackMessage) {
    appendMessages(setValues, [fallbackMessage]);
  }
}
