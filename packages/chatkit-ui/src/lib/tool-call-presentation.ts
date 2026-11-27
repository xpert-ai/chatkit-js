import {
  isToolActivity,
  type ToolCallPresentation,
} from '@xpert-ai/chatkit-types';
import { z } from 'zod';

const detail = z
  .object({
    conversationId: z.uuid(),
    executionId: z.uuid(),
    toolCallId: z.string().min(1).max(256),
    phase: z.enum(['input', 'output', 'error']),
    id: z.uuid(),
    sha256: z.string().regex(/^[a-f0-9]{64}$/),
  })
  .strict();
const value = z
  .object({
    state: z.enum(['available', 'not-public', 'unavailable']),
    format: z.enum(['text', 'json']).optional(),
    summary: z
      .union([
        z.string().max(500),
        z.record(z.string().max(30), z.string().max(500)),
      ])
      .optional(),
    byteLength: z.number().int().nonnegative().optional(),
    lineCount: z.number().int().nonnegative().optional(),
    itemCount: z.number().int().nonnegative().optional(),
    truncated: z.boolean(),
    mode: z.enum(['preview', 'summary']).optional(),
    detail: detail.optional(),
  })
  .strict();
const presentation = z
  .object({
    version: z.literal(1),
    activity: z.unknown().optional(),
    target: z.string().max(160).optional(),
    input: value.optional(),
    output: value.optional(),
    error: value.optional(),
  })
  .strict();

export function parseToolCallPresentation(
  raw: unknown,
): ToolCallPresentation | undefined {
  const parsed = presentation.safeParse(raw);
  if (!parsed.success) return;
  const { activity, ...rest } = parsed.data;
  return { ...rest, ...(isToolActivity(activity) ? { activity } : {}) };
}
