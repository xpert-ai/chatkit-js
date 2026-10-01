import type { ToolCall } from '@langchain/core/messages/tool';
import {
  REQUEST_USER_INPUT_RESULT_TYPE,
  REQUEST_USER_INPUT_TOOL_NAME,
  type ClientToolMessageInput,
  type RequestUserInputAnswer,
  type RequestUserInputResult,
  type RequestUserInputToolArgs,
} from '@xpert-ai/chatkit-types';
import { useCallback, useRef, useState } from 'react';
import { createMessageId } from '../../../lib/utils';
import { createAbortError } from '../transport/errors';
import type { PendingRequestUserInput } from '../types';
import { getRequestUserInputResultPurpose } from './client-tools';

export function useStreamUserInput() {
  const [pendingRequestUserInput, setPendingRequestUserInput] =
    useState<PendingRequestUserInput | null>(null);

  const pendingRequestUserInputRef = useRef<PendingRequestUserInput | null>(
    null,
  );

  const requestUserInputResolverRef = useRef<{
    resolve: (message: ClientToolMessageInput) => void;
    reject: (error: unknown) => void;
  } | null>(null);

  const updatePendingRequestUserInput = useCallback(
    (nextRequest: PendingRequestUserInput | null) => {
      pendingRequestUserInputRef.current = nextRequest;
      setPendingRequestUserInput(nextRequest);
    },
    [],
  );

  const clearPendingRequestUserInput = useCallback(
    (reason?: unknown) => {
      const resolver = requestUserInputResolverRef.current;
      requestUserInputResolverRef.current = null;
      updatePendingRequestUserInput(null);

      if (resolver) {
        resolver.reject(
          reason ??
            createAbortError('The pending user input request was cancelled.'),
        );
      }
    },
    [updatePendingRequestUserInput],
  );

  const waitForRequestUserInput = useCallback(
    (toolCall: ToolCall, params: RequestUserInputToolArgs) => {
      clearPendingRequestUserInput(
        createAbortError('A newer user input request replaced this one.'),
      );

      const requestId = toolCall.id ?? createMessageId();
      const pendingRequest: PendingRequestUserInput = {
        id: requestId,
        ...(toolCall.id ? { toolCallId: toolCall.id } : {}),
        params,
        createdAt: Date.now(),
      };

      updatePendingRequestUserInput(pendingRequest);

      return new Promise<ClientToolMessageInput>((resolve, reject) => {
        requestUserInputResolverRef.current = {
          resolve,
          reject,
        };
      });
    },
    [clearPendingRequestUserInput, updatePendingRequestUserInput],
  );

  const submitRequestUserInput = useCallback(
    (answers: RequestUserInputAnswer[]) => {
      const pendingRequest = pendingRequestUserInputRef.current;
      const resolver = requestUserInputResolverRef.current;
      if (!pendingRequest || !resolver) {
        return;
      }

      const content: RequestUserInputResult = {
        type: REQUEST_USER_INPUT_RESULT_TYPE,
        purpose: getRequestUserInputResultPurpose(pendingRequest.params),
        answers,
      };
      requestUserInputResolverRef.current = null;
      updatePendingRequestUserInput(null);
      resolver.resolve({
        tool_call_id: pendingRequest.toolCallId ?? pendingRequest.id,
        name: REQUEST_USER_INPUT_TOOL_NAME,
        content,
        status: 'success',
      });
    },
    [updatePendingRequestUserInput],
  );
  return {
    clearPendingRequestUserInput,
    waitForRequestUserInput,
    pendingRequestUserInput,
    submitRequestUserInput,
  };
}
