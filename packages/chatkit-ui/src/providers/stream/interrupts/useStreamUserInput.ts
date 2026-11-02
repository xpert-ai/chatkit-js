import type { ToolCall } from '@langchain/core/messages/tool';
import {
  REQUEST_USER_INPUT_RESULT_TYPE,
  REQUEST_USER_INPUT_TOOL_NAME,
  isRequestUserInputForm,
  validateUserInputValues,
  type UserInputValues,
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
      if (isRequestUserInputForm(params) && params.mode !== 'blocking') {
        throw new Error(
          'Non-blocking user input is not supported by this host.',
        );
      }
      if (pendingRequestUserInputRef.current?.id === toolCall.id) {
        throw new Error('This user input request is already being handled.');
      }
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
    (
      answers: RequestUserInputAnswer[] | UserInputValues,
      status: 'submitted' | 'cancelled' = 'submitted',
    ) => {
      const pendingRequest = pendingRequestUserInputRef.current;
      const resolver = requestUserInputResolverRef.current;
      if (!pendingRequest || !resolver) {
        return;
      }

      const form = isRequestUserInputForm(pendingRequest.params)
        ? pendingRequest.params
        : undefined;
      const validated =
        form && status === 'submitted'
          ? validateUserInputValues(form, answers)
          : null;
      if (validated && !validated.valid) return;
      if (!form && !Array.isArray(answers)) return;
      const content: RequestUserInputResult = {
        type: REQUEST_USER_INPUT_RESULT_TYPE,
        purpose: getRequestUserInputResultPurpose(pendingRequest.params),
        answers:
          Array.isArray(answers) && status === 'submitted' ? answers : [],
        status,
        requestId: pendingRequest.id,
        ...(form
          ? {
              schemaVersion: 1,
              form,
              ...(validated?.valid ? { values: validated.values } : {}),
            }
          : {}),
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
  const hasPendingUserInput = useCallback(
    () => pendingRequestUserInputRef.current !== null,
    [],
  );
  return {
    hasPendingUserInput,
    clearPendingRequestUserInput,
    waitForRequestUserInput,
    pendingRequestUserInput,
    submitRequestUserInput,
  };
}
