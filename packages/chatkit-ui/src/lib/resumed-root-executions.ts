import type { Run } from '@xpert-ai/xpert-sdk';
import type { Message } from '@langchain/core/messages';
import type { TMessageContentReasoning } from '@xpert-ai/chatkit-types';
import type { AgentRunInfo } from './agent-runs';

type RootExecutionMessage = {
  executionId?: string;
  rootExecutionIds?: string[];
  content: Message['content'];
  reasoning?: TMessageContentReasoning[];
  agentRuns?: AgentRunInfo[];
};

// Execution ancestry is immutable. Cache SDK lookups for history pagination and
// final stream reconciliation, without treating a failed lookup as no ancestry.
export function createResumedRootExecutionHydrator(
  getRun: (threadId: string, runId: string) => Promise<Pick<Run, 'metadata'>>,
) {
  const cache = new Map<string, Promise<Pick<Run, 'metadata'>>>();
  function readRun(threadId: string, runId: string) {
    const key = `${threadId}:${runId}`;
    let pending = cache.get(key);
    if (!pending) {
      pending = getRun(threadId, runId).catch((error) => {
        cache.delete(key);
        throw error;
      });
      cache.set(key, pending);
    }
    return pending;
  }

  return async function hydrate<T extends RootExecutionMessage>(
    messages: T[],
    threadId: string | null | undefined,
  ): Promise<T[]> {
    if (!threadId) return messages;
    return Promise.all(
      messages.map(async (message) => {
        const rootId = message.executionId;
        if (!rootId) return message;
        const parts = [
          ...(Array.isArray(message.content) ? message.content : []),
          ...(message.reasoning ?? []),
        ];
        const hasOtherExecution =
          parts.some(
            (part) =>
              typeof part === 'object' &&
              part !== null &&
              'executionId' in part &&
              typeof part.executionId === 'string' &&
              part.executionId !== rootId,
          ) || message.agentRuns?.some((run) => run.id !== rootId);
        if (!hasOtherExecution) return message;

        try {
          const roots = new Set([rootId]);
          let runId = rootId;
          while (true) {
            const run = await readRun(threadId, runId);
            const previous = run.metadata?.resumedFromExecutionId;
            if (
              typeof previous !== 'string' ||
              !previous.trim() ||
              roots.has(previous.trim())
            )
              break;
            runId = previous.trim();
            roots.add(runId);
          }
          if (roots.size === 1) return message;
          return { ...message, rootExecutionIds: [...roots] };
        } catch (error) {
          console.warn(
            '[chatkit-ui] Failed to resolve resumed root executions',
            error,
          );
          return message;
        }
      }),
    );
  };
}
