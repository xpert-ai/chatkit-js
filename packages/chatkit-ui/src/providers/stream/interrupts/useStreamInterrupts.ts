import type {
  ClientToolMessageInput,
  ClientToolResponse,
  HITLResponse,
} from '@xpert-ai/chatkit-types';
import { useCallback } from 'react';
import { createConversationThreadSearchWhere } from '../../../lib/conversation-runtime-capabilities';
import { buildHITLResumeRunInput, useHITLInterrupts } from '../../../lib/hitl';
import type { useStreamHost } from '../host/useStreamHost';
import { getLatestAssistantMessageTarget } from '../messages/reducer';
import type { useStreamMessages } from '../messages/useStreamMessages';
import type { useStreamRunState } from '../runs/useStreamRunState';
import type { useStreamScope } from '../scope/useStreamScope';
import { isAbortError } from '../transport/errors';
import {
  collectClientToolRequests,
  normalizeToolMessagesResponse,
  resolveClientToolCallResponse,
} from './client-tools';
import type { useStreamUserInput } from './useStreamUserInput';

type StreamInterruptsOptions = Pick<
  ReturnType<typeof useStreamScope>,
  | 'conversationIdRef'
  | 'activeThreadIdRef'
  | 'clientRef'
  | 'updateConversationId'
> &
  Pick<ReturnType<typeof useStreamMessages>, 'valuesRef'> &
  Pick<
    ReturnType<typeof useStreamRunState>,
    | 'lastExecutionIdRef'
    | 'submitRef'
    | 'lastStreamOptionsRef'
    | 'rememberActiveRunId'
    | 'setError'
  > &
  Pick<ReturnType<typeof useStreamHost>, 'isParentAvailable' | 'sendCommand'> &
  Pick<ReturnType<typeof useStreamUserInput>, 'waitForRequestUserInput'> & {
    assistantId: string;
    projectId: string | undefined;
  };

export function useStreamInterrupts({
  conversationIdRef,
  activeThreadIdRef,
  clientRef,
  assistantId,
  updateConversationId,
  valuesRef,
  lastExecutionIdRef,
  submitRef,
  lastStreamOptionsRef,
  projectId,
  rememberActiveRunId,
  setError,
  isParentAvailable,
  sendCommand,
  waitForRequestUserInput,
}: StreamInterruptsOptions) {
  const submitHITLResponse = useCallback(
    async (response: HITLResponse, executionId?: string) => {
      let conversationId = conversationIdRef.current?.trim() || null;
      if (!conversationId) {
        const activeThreadId = activeThreadIdRef.current?.trim() || null;
        if (activeThreadId) {
          const activeClient = clientRef.current;
          if (!activeClient) {
            throw new Error('Missing Xpert client for HITL resume');
          }
          const conversationResult = await activeClient.conversations.search({
            where: createConversationThreadSearchWhere(activeThreadId, {
              xpertId: assistantId,
            }),
            limit: 1,
          });
          conversationId = conversationResult.items?.[0]?.id?.trim() ?? null;
          updateConversationId(conversationId);
        }
      }
      if (!conversationId) {
        throw new Error('Missing conversation context for HITL resume');
      }

      const latestTarget = getLatestAssistantMessageTarget(
        valuesRef.current.messages ?? [],
      );
      const resumeInput = buildHITLResumeRunInput({
        response,
        conversationId,
        executionId:
          executionId ??
          latestTarget.executionId ??
          lastExecutionIdRef.current ??
          undefined,
        aiMessageId: latestTarget.aiMessageId,
      });

      return (
        submitRef.current?.(resumeInput, lastStreamOptionsRef.current) ??
        Promise.resolve()
      );
    },
    [assistantId, projectId, updateConversationId],
  );

  const rememberHITLExecutionId = useCallback(
    (executionId: string) => {
      rememberActiveRunId(executionId);
    },
    [rememberActiveRunId],
  );

  const {
    pendingHITLRequest,
    clearPendingHITLRequest,
    submitHITLDecision,
    hydratePendingHITLRequestFromOperation,
    handleHITLInterrupt,
  } = useHITLInterrupts({
    submitResponse: submitHITLResponse,
    setError,
    onExecutionId: rememberHITLExecutionId,
  });

  const handleInterrupt = useCallback(
    async (data: unknown) => {
      const requests = collectClientToolRequests(data);

      const toolMessages: ClientToolMessageInput[] = [];
      for (const request of requests) {
        const calls = request.clientToolCalls ?? [];
        for (const call of calls) {
          let response: unknown;
          try {
            response = await resolveClientToolCallResponse(call, {
              isParentAvailable,
              sendCommand,
              waitForRequestUserInput,
            });
            if (!response) {
              continue;
            }
          } catch (requestError) {
            if (isAbortError(requestError)) {
              continue;
            }
            setError(requestError);
            continue;
          }

          const toolMessage = normalizeToolMessagesResponse(response);
          if (!toolMessage) continue;

          toolMessages.push(toolMessage);
        }
      }

      if (toolMessages.length > 0) {
        await submitRef.current?.(
          {
            input: {},
            command: {
              resume: {
                toolMessages: toolMessages,
              } as ClientToolResponse,
            },
            executionId: lastExecutionIdRef.current ?? undefined,
          },
          lastStreamOptionsRef.current,
        );
      }

      await handleHITLInterrupt(data);
    },
    [
      handleHITLInterrupt,
      isParentAvailable,
      sendCommand,
      setError,
      waitForRequestUserInput,
    ],
  );
  return {
    clearPendingHITLRequest,
    hydratePendingHITLRequestFromOperation,
    handleInterrupt,
    pendingHITLRequest,
    submitHITLDecision,
  };
}
