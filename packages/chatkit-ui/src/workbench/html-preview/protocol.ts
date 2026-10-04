import { z } from 'zod';

export const PREVIEW_CHANNEL = 'chatkit:html-preview';
const shortText = z.string().max(2400);
export const elementSchema = z.object({
  selector: shortText,
  tag: z.string().max(80),
  text: shortText,
  html: z.string().max(4000),
  styles: z
    .array(z.object({ name: z.string().max(80), value: shortText }))
    .max(30),
});
export type PreviewElement = z.infer<typeof elementSchema>;
export type ConsoleEntry = {
  level: 'log' | 'info' | 'warn' | 'error' | 'debug';
  text: string;
};
const eventSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('ready') }),
  z.object({ type: z.literal('escape') }),
  z.object({ type: z.literal('selected'), element: elementSchema }),
  z.object({
    type: z.literal('console'),
    level: z.enum(['log', 'info', 'warn', 'error', 'debug']),
    text: z.string().max(4000),
  }),
]);
export type PreviewEvent = z.infer<typeof eventSchema>;
export type PreviewCommand =
  | { type: 'connect' }
  | { type: 'inspect'; active: boolean }
  | { type: 'parent' }
  | { type: 'clear' };

/** An opaque-origin frame must match both its Window and this document's session. */
export function parsePreviewEvent(
  data: unknown,
  session: string,
): PreviewEvent | null {
  const envelope = z
    .object({
      channel: z.literal(PREVIEW_CHANNEL),
      session: z.literal(session),
      event: eventSchema,
    })
    .safeParse(data);
  return envelope.success ? envelope.data.event : null;
}
