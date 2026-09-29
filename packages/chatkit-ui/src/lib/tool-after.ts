import type { StreamContextType } from '../providers/Stream';
import type { ChatRequestFile } from '@xpert-ai/chatkit-types';

export type ToolAfterInterrupt = { id?: string; toolCallId: string; toolName: string; app: boolean };
export function collectToolAfterInterrupts(operation: unknown): ToolAfterInterrupt[] {
  if (!operation || typeof operation !== 'object' || !('tasks' in operation) || !Array.isArray(operation.tasks)) return [];
  return operation.tasks.flatMap((task: unknown) => {
    if (!task || typeof task !== 'object' || !('interrupts' in task) || !Array.isArray(task.interrupts)) return [];
    return task.interrupts.flatMap((entry: unknown) => {
      if (!entry || typeof entry !== 'object' || !('value' in entry)) return [];
      const value = entry.value;
      if (!value || typeof value !== 'object' || !('type' in value) || value.type !== 'tool_after' ||
        !('toolCallId' in value) || typeof value.toolCallId !== 'string' ||
        !('toolName' in value) || typeof value.toolName !== 'string') return [];
      return [{ id: 'id' in entry && typeof entry.id === 'string' ? entry.id : undefined,
        toolCallId: value.toolCallId, toolName: value.toolName, app: 'app' in value && value.app === true }];
    });
  });
}

export function readAppContinuation(response: unknown): { toolCallId: string; executionId: string } | null {
  if (!response || typeof response !== 'object' || !('result' in response)) return null;
  const result = response.result;
  if (!result || typeof result !== 'object' || !('continuation' in result)) return null;
  const next = result.continuation;
  if (!next || typeof next !== 'object' || !('type' in next) || next.type !== 'tool_after' ||
    !('toolCallId' in next) || typeof next.toolCallId !== 'string' ||
    !('executionId' in next) || typeof next.executionId !== 'string') return null;
  return { toolCallId: next.toolCallId, executionId: next.executionId };
}

/** A standard App message may continue only its own completed tool, never another checkpoint. */
export async function resumeAfterTool(
  stream: Pick<StreamContextType, 'client' | 'submit' | 'threadId' | 'conversationId'>,
  toolCallId: string, executionId?: string, message?: string, files?: ChatRequestFile[],
) {
  if (!stream.threadId || !stream.conversationId) throw new Error('Missing conversation for tool continuation');
  const conversationId = stream.conversationId;
  // The App may submit while the original stream is still sealing its checkpoint.
  for (let attempt = 0; attempt < 30; attempt++) {
    const thread = await stream.client.threads.get(stream.threadId);
    const pending = collectToolAfterInterrupts(thread.operation).find((item) => item.toolCallId === toolCallId);
    if (pending) {
      const answer = { toolCallId, ...(message?.trim() ? { message } : {}), ...(files?.length ? { files } : {}) };
      // A resumed Agent can run for minutes. Acknowledge dispatch to the App once
      // the server has accepted the run; Stream owns later errors and SSE events.
      // Waiting for the complete run here would time out the App's ui/message RPC.
      await new Promise<void>((resolve, reject) => {
        void stream.submit({ action: 'resume', conversationId,
          target: executionId ? { executionId } : {},
          decision: { type: 'confirm', payload: pending.id ? { [pending.id]: answer } : answer } },
        { onRunAccepted: () => resolve() }).then(
          () => reject(new Error('The server did not acknowledge the continuation.')),
          reject,
        );
      });
      return;
    }
    if (!['running', 'busy'].includes(String(thread.status))) break;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error('This tool is no longer waiting for input. Reopen the current configuration to continue.');
}
