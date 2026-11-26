import type { LangGraphEventContext } from './langGraphEventMapper';
import type { ParentMessenger } from './ParentMessenger';

const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** Public tool rows are the server's participant-facing lifecycle protocol. */
export function emitToolComponentEvent(
  message: unknown,
  context: LangGraphEventContext | undefined,
  sendEvent: ParentMessenger['sendEvent'],
): void {
  if (
    !record(message) ||
    message.type !== 'component' ||
    typeof message.id !== 'string' ||
    !message.id
  )
    return;
  const data = message.data;
  if (
    !record(data) ||
    data.category !== 'Tool' ||
    data.toolPresentation !== 'redacted' ||
    typeof data.tool !== 'string' ||
    !data.tool
  )
    return;
  if (!context?.threadId || !context.conversationId) return;
  const name =
    data.status === 'running'
      ? 'lg.tool.start'
      : data.status === 'success'
        ? 'lg.tool.end'
        : data.status === 'fail'
          ? 'lg.tool.error'
          : null;
  if (!name) return;
  sendEvent('public_event', [
    'log',
    {
      name,
      data: {
        toolCallId: message.id,
        toolName: data.tool,
        threadId: context.threadId,
        conversationId: context.conversationId,
        ...(typeof message.executionId === 'string'
          ? { runId: message.executionId }
          : {}),
      },
    },
  ]);
}
