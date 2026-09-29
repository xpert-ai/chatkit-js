import { useCallback, useEffect, useRef, useState } from 'react';
import {
  useExecutionFocus,
  type ExecutionFocusOptions,
} from './useExecutionFocus';
import type {
  ExecutionNavigationRequest,
  ExecutionNavigationResult,
} from './client-command-payload';

type LocalExecutionOptions = Omit<
  ExecutionFocusOptions,
  'executionId' | 'requestedThread' | 'requestId' | 'onError' | 'onComplete'
> & {
  conversationId: string | null | undefined;
  projectId: string | null | undefined;
  /** A new host navigation supersedes any pending local selection. */
  navigationKey: string;
  historyError?: string;
};

type Pending = {
  id: string;
  executionId: string;
  threadId: string;
  scope: string;
  resolve: (result: ExecutionNavigationResult) => void;
};

/** Open current-thread executions using existing messages/pagination, without resetting the chat. */
export function useLocalExecutionNavigation(input: LocalExecutionOptions) {
  const scope = JSON.stringify([
    input.scope,
    input.projectId,
    input.conversationId,
    input.threadId,
    input.navigationKey,
  ]);
  const latest = useRef({ input, scope });
  latest.current = { input, scope };
  const pending = useRef<Pending | null>(null);
  const sequence = useRef(0);
  const [selection, setSelection] = useState<Pending | null>(null);

  useEffect(
    () => () => {
      pending.current?.resolve({ success: false, code: 'stale_context' });
      pending.current = null;
    },
    [scope],
  );

  const complete = (result: ExecutionNavigationResult) => {
    if (!selection || pending.current !== selection) return;
    pending.current = null;
    selection.resolve(result);
    setSelection(null);
  };
  const active = selection?.scope === scope ? selection : null;
  const historyMatchesThread =
    !input.history || input.history.threadId === input.threadId;
  useExecutionFocus({
    ...input,
    externalRuns: historyMatchesThread ? input.externalRuns : [],
    messages: historyMatchesThread ? input.messages : [],
    scope,
    executionId: active?.executionId,
    requestedThread: active?.threadId,
    requestId: active?.id,
    onError: () => undefined, // The requesting view displays the returned error.
    onComplete: complete,
  });
  useEffect(() => {
    if (active && input.historyError)
      complete({
        success: false,
        code: 'execution_load_failed',
        message: input.historyError,
      });
  });

  return useCallback(
    (
      request: ExecutionNavigationRequest,
    ): Promise<ExecutionNavigationResult> => {
      const { input: current, scope: currentScope } = latest.current;
      const threadId = current.threadId;
      if (
        !threadId ||
        request.conversationId !== current.conversationId ||
        (request.threadId && request.threadId !== threadId)
      )
        return Promise.resolve({ success: false, code: 'unsupported' });
      if (request.projectId && request.projectId !== current.projectId)
        return Promise.resolve({ success: false, code: 'navigation_mismatch' });

      pending.current?.resolve({ success: false, code: 'stale_context' });
      return new Promise((resolve) => {
        const next: Pending = {
          id: String(++sequence.current),
          executionId: request.executionId,
          threadId,
          scope: currentScope,
          resolve,
        };
        pending.current = next;
        setSelection(next);
      });
    },
    [],
  );
}
