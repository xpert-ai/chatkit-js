import { z } from 'zod';
import type { TMessageContentComponent } from '@xpert-ai/chatkit-types';
import { normalizeAgentRunInfo } from './agent-runs';
import type { StateType } from '../providers/Stream';

const messageSchema = z.object({
  id: z.string().optional(),
  type: z.enum(['ai', 'human', 'system', 'tool', 'function', 'generic', 'remove']),
  content: z.union([z.string(), z.array(z.object({ type: z.string() }).passthrough())]),
  status: z.string().optional(),
  executionId: z.string().optional(),
  rootExecutionIds: z.array(z.string()).optional(),
  reasoning: z.array(z.object({ type: z.literal('reasoning'), text: z.string() }).passthrough()).optional(),
  agentRuns: z.array(z.unknown()).transform((runs) => runs.flatMap((run) => {
    const normalized = normalizeAgentRunInfo(run);
    return normalized ? [normalized] : [];
  })).optional(),
}).passthrough();
const snapshotSchema = z.object({ version: z.literal(1), messages: z.array(messageSchema) });

const displayMessageTypes = new Set([
  'ai',
  'human',
  'system',
  'tool',
  'function',
  'generic',
  'remove',
]);

function isDisplayMessage(value: unknown): value is { type: string } {
  return (
    typeof value === 'object' &&
    value !== null &&
    'type' in value &&
    typeof value.type === 'string' &&
    displayMessageTypes.has(value.type)
  );
}

export function serializePausedDisplaySnapshot(values: StateType): string {
  return JSON.stringify({
    version: 1,
    messages: values.messages.filter((message) => isDisplayMessage(message)),
  });
}

const settledStepStatuses = new Set(['success', 'fail']);

function isComponentStepPart(
  value: unknown,
): value is TMessageContentComponent {
  return (
    typeof value === 'object' &&
    value !== null &&
    'type' in value &&
    value.type === 'component' &&
    'id' in value &&
    typeof value.id === 'string'
  );
}

function readStepStatus(part: TMessageContentComponent): string | null {
  const data: unknown = part.data;
  if (typeof data !== 'object' || data === null || !('status' in data)) {
    return null;
  }
  return typeof data.status === 'string' ? data.status : null;
}

/**
 * Why this exists: a pause freezes what the user can see, but the backend keeps
 * running the step that had already started. Adopt the settled state of steps
 * that were already visible when the pause was requested, so a finished tool
 * stops looking active forever. Frozen text and steps that appeared after the
 * freeze are left alone, otherwise the pause would keep revealing new output.
 */
export function reconcilePausedDisplaySteps(
  frozen: StateType,
  latest: StateType,
): StateType {
  const latestMessages = new Map(
    latest.messages.flatMap((message) =>
      typeof message.id === 'string' ? [[message.id, message] as const] : [],
    ),
  );
  let changed = false;
  const messages = frozen.messages.map((message) => {
    const latestMessage =
      typeof message.id === 'string'
        ? latestMessages.get(message.id)
        : undefined;
    if (
      !latestMessage ||
      !Array.isArray(message.content) ||
      !Array.isArray(latestMessage.content)
    ) {
      return message;
    }
    const latestParts = new Map(
      latestMessage.content.flatMap((part) =>
        isComponentStepPart(part) ? [[part.id, part] as const] : [],
      ),
    );
    let messageChanged = false;
    const content = message.content.map((part) => {
      if (!isComponentStepPart(part) || readStepStatus(part) !== 'running') {
        return part;
      }
      const latestPart = latestParts.get(part.id);
      const latestStatus = latestPart ? readStepStatus(latestPart) : null;
      if (
        !latestPart ||
        !latestStatus ||
        !settledStepStatuses.has(latestStatus)
      ) {
        return part;
      }
      messageChanged = true;
      return latestPart;
    });
    if (!messageChanged) return message;
    changed = true;
    return { ...message, content };
  });
  return changed ? { messages } : frozen;
}

export function parsePausedDisplaySnapshot(snapshot: string): StateType {
  const envelope = z
    .object({ version: z.unknown(), messages: z.array(z.unknown()) })
    .parse(JSON.parse(snapshot));
  const messages = envelope.messages.filter(
    (message): message is { type: string } =>
      typeof message === 'object' &&
      message !== null &&
      'type' in message &&
      typeof message.type === 'string' &&
      isDisplayMessage(message),
  );
  const parsed = snapshotSchema.parse({
    version: envelope.version,
    messages,
  });
  return { messages: parsed.messages };
}
