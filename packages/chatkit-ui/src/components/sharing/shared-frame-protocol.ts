import { z } from 'zod';

// The renderer receives a bounded export, never a share token, identity or API credential.
export const sharedFrameSchema = z
  .object({
    type: z.literal('chatkit:shared-transcript'),
    channelId: z.string().uuid(),
    snapshot: z
      .object({
        messages: z
          .array(
            z
              .object({ role: z.enum(['human', 'ai']), text: z.string() })
              .strict(),
          )
          .max(1000),
        expiresAt: z.string().datetime(),
      })
      .strict(),
    locale: z.string().max(30),
    theme: z
      .object({
        colorScheme: z.enum(['light', 'dark']),
        radius: z.enum(['pill', 'round', 'soft', 'sharp']).optional(),
        density: z.enum(['compact', 'normal', 'spacious']).optional(),
        typography: z
          .object({
            baseSize: z.union([
              z.literal(14),
              z.literal(15),
              z.literal(16),
              z.literal(17),
              z.literal(18),
            ]),
          })
          .optional(),
        color: z
          .object({
            surface: z.object({
              background: z.string().max(200),
              foreground: z.string().max(200),
            }),
          })
          .optional(),
      })
      .strict(),
  })
  .strict();

export function readSharedFrameEvent(
  event: MessageEvent,
  parent: Window,
  origin: string,
  channelId: string,
) {
  if (event.source !== parent || event.origin !== origin) return null;
  const parsed = sharedFrameSchema.safeParse(event.data);
  if (!parsed.success || parsed.data.channelId !== channelId) return null;
  if (
    new TextEncoder().encode(
      JSON.stringify({ messages: parsed.data.snapshot.messages }),
    ).byteLength >
    1024 * 1024
  )
    return null;
  return parsed.data;
}

export type SharedFrameData = z.infer<typeof sharedFrameSchema>;
