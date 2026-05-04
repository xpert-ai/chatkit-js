import * as React from 'react';
import {
  normalizeHITLRequest,
  type HITLDecision,
  type HITLRequest,
  type HITLResponse,
  type TXpertChatResumeRequest,
} from '@xpert-ai/chatkit-types';

export type PendingHITLRequest = {
  id: string;
  interruptId?: string;
  taskId?: string;
  executionId?: string;
  request: HITLRequest;
  createdAt: number;
};

export type BuildHITLResumeRunInputOptions = {
  response: HITLResponse;
  conversationId: string;
  executionId?: string | null;
  aiMessageId?: string | null;
  state?: TXpertChatResumeRequest['state'];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function readRecordArrayField(value: unknown, key: string) {
  if (!isRecord(value)) return [];
  const field = value[key];
  return Array.isArray(field)
    ? field.filter((item): item is Record<string, unknown> => isRecord(item))
    : [];
}

function readOptionalStringField(value: Record<string, unknown>, key: string) {
  const field = value[key];
  return typeof field === 'string' && field.trim() ? field : undefined;
}

function optionalTrimmedString(value?: string | null) {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

export function buildHITLResumeRunInput({
  response,
  conversationId,
  executionId,
  aiMessageId,
  state,
}: BuildHITLResumeRunInputOptions): TXpertChatResumeRequest {
  const normalizedConversationId = optionalTrimmedString(conversationId);
  const normalizedExecutionId = optionalTrimmedString(executionId);
  const normalizedAiMessageId = optionalTrimmedString(aiMessageId);

  if (!normalizedConversationId) {
    throw new Error('Missing conversationId for HITL resume request.');
  }

  return {
    action: 'resume',
    conversationId: normalizedConversationId,
    target: {
      ...(normalizedAiMessageId ? { aiMessageId: normalizedAiMessageId } : {}),
      ...(normalizedExecutionId ? { executionId: normalizedExecutionId } : {}),
    },
    decision: {
      type: 'confirm',
      payload: response,
    },
    ...(state ? { state } : {}),
  };
}

export function collectHITLRequests(
  payload: unknown,
  options?: { executionId?: string },
): PendingHITLRequest[] {
  const tasks = readRecordArrayField(payload, 'tasks');
  if (tasks.length === 0) return [];

  const requests: PendingHITLRequest[] = [];
  for (const task of tasks) {
    const taskId = readOptionalStringField(task, 'id');
    const interrupts = readRecordArrayField(task, 'interrupts');
    for (const interrupt of interrupts) {
      const request = normalizeHITLRequest(interrupt.value);
      if (!request) continue;

      const interruptId = readOptionalStringField(interrupt, 'id');
      requests.push({
        id: interruptId || `${taskId ?? 'task'}:hitl:${requests.length}`,
        ...(interruptId ? { interruptId } : {}),
        ...(taskId ? { taskId } : {}),
        ...(options?.executionId ? { executionId: options.executionId } : {}),
        request,
        createdAt: Date.now(),
      });
    }
  }

  return requests;
}

function createHITLAbortError(message: string): Error | DOMException {
  if (typeof DOMException !== 'undefined') {
    return new DOMException(message, 'AbortError');
  }

  return new Error(message);
}

function isHITLAbortError(error: unknown) {
  return (
    error !== null &&
    typeof error === 'object' &&
    'name' in error &&
    (error as { name?: unknown }).name === 'AbortError'
  );
}

export type UseHITLInterruptsOptions = {
  submitResponse: (
    response: HITLResponse,
    executionId?: string,
  ) => Promise<void>;
  setError: (error: unknown) => void;
  onExecutionId?: (executionId: string) => void;
};

export function useHITLInterrupts({
  submitResponse,
  setError,
  onExecutionId,
}: UseHITLInterruptsOptions) {
  const [pendingHITLRequest, setPendingHITLRequest] =
    React.useState<PendingHITLRequest | null>(null);
  const pendingHITLRequestRef = React.useRef<PendingHITLRequest | null>(null);
  const hitlResolverRef = React.useRef<{
    resolve: (response: HITLResponse) => void;
    reject: (error: unknown) => void;
  } | null>(null);

  const updatePendingHITLRequest = React.useCallback(
    (nextRequest: PendingHITLRequest | null) => {
      pendingHITLRequestRef.current = nextRequest;
      setPendingHITLRequest(nextRequest);
    },
    [],
  );

  const clearPendingHITLRequest = React.useCallback(
    (reason?: unknown) => {
      const resolver = hitlResolverRef.current;
      hitlResolverRef.current = null;
      updatePendingHITLRequest(null);

      if (resolver) {
        resolver.reject(
          reason ??
            createHITLAbortError('The pending HITL request was cancelled.'),
        );
      }
    },
    [updatePendingHITLRequest],
  );

  const waitForHITLDecision = React.useCallback(
    (request: PendingHITLRequest) => {
      clearPendingHITLRequest(
        createHITLAbortError('A newer HITL request replaced this one.'),
      );
      updatePendingHITLRequest(request);

      return new Promise<HITLResponse>((resolve, reject) => {
        hitlResolverRef.current = {
          resolve,
          reject,
        };
      });
    },
    [clearPendingHITLRequest, updatePendingHITLRequest],
  );

  const submitHITLDecision = React.useCallback(
    (decisions: HITLDecision[]) => {
      const pendingRequest = pendingHITLRequestRef.current;
      const resolver = hitlResolverRef.current;
      if (!pendingRequest) {
        return;
      }

      updatePendingHITLRequest(null);
      const response: HITLResponse = { decisions };

      if (resolver) {
        hitlResolverRef.current = null;
        resolver.resolve(response);
        return;
      }

      void submitResponse(response, pendingRequest.executionId).catch(
        (submitError) => {
          updatePendingHITLRequest(pendingRequest);
          setError(submitError);
        },
      );
    },
    [setError, submitResponse, updatePendingHITLRequest],
  );

  const hydratePendingHITLRequestFromOperation = React.useCallback(
    (operation: unknown, executionId?: string | null) => {
      const requests = collectHITLRequests(operation, {
        ...(executionId ? { executionId } : {}),
      });
      const request = requests[0] ?? null;
      updatePendingHITLRequest(request);
      if (request?.executionId) {
        onExecutionId?.(request.executionId);
      }

      return Boolean(request);
    },
    [onExecutionId, updatePendingHITLRequest],
  );

  const handleHITLInterrupt = React.useCallback(
    async (data: unknown) => {
      const request = collectHITLRequests(data)[0] ?? null;
      if (!request) return false;

      try {
        const response = await waitForHITLDecision(request);
        await submitResponse(response, request.executionId);
        return true;
      } catch (requestError) {
        if (!isHITLAbortError(requestError)) {
          setError(requestError);
        }
        return false;
      }
    },
    [setError, submitResponse, waitForHITLDecision],
  );

  React.useEffect(() => {
    return () => {
      clearPendingHITLRequest(
        createHITLAbortError('The HITL request was cancelled.'),
      );
    };
  }, [clearPendingHITLRequest]);

  return {
    pendingHITLRequest,
    clearPendingHITLRequest,
    submitHITLDecision,
    hydratePendingHITLRequestFromOperation,
    handleHITLInterrupt,
  };
}
