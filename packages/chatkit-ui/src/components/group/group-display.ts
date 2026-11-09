import {
  parseResourceCardContent,
  type TMessageComponentWidgetData,
  type TMessageContentResourceCard,
} from '@xpert-ai/chatkit-types';
import { z } from 'zod';

const object = z.record(z.string(), z.unknown());
const surface = z.object({ surfaceId: z.string() });
const a2ui = z
  .object({
    beginRendering: surface.extend({ root: z.string() }).optional(),
    surfaceUpdate: surface
      .extend({
        components: z
          .array(z.object({ id: z.string(), component: object }))
          .max(500),
      })
      .optional(),
    dataModelUpdate: surface
      .extend({
        path: z.string().optional(),
        contents: z.array(object).max(2000),
      })
      .optional(),
    deleteSurface: surface.optional(),
  })
  .refine((value) => Object.keys(value).length === 1);
const widget = z.object({
  id: z.string(),
  type: z.literal('component'),
  data: z.object({
    type: z.literal('Widget'),
    widgets: z
      .array(
        z.object({
          name: z.string(),
          presentation: z
            .object({
              summary: z.string().max(500).optional(),
              timestamp: z.string().datetime({ offset: true }).optional(),
              timestampLabel: z.string().max(100).optional(),
              details: z
                .array(
                  z.object({
                    label: z.string().max(100),
                    value: z.string().max(2000),
                  }),
                )
                .max(16)
                .optional(),
            })
            .optional(),
          messages: z.array(a2ui).min(1).max(500),
        }),
      )
      .min(1)
      .max(16),
  }),
});
const mcp = z.object({
  id: z.string(),
  type: z.literal('component'),
  data: z.object({
    type: z.literal('McpApp'),
    toolResult: z.object({
      content: z
        .array(z.object({ type: z.literal('text'), text: z.string() }))
        .max(100),
      structuredContent: object.optional(),
      isError: z.boolean().optional(),
    }),
  }),
});
export type GroupDisplay =
  | { kind: 'widget'; id: string; data: TMessageComponentWidgetData }
  | { kind: 'resource'; id: string; card: TMessageContentResourceCard }
  | { kind: 'mcp'; id: string; data: z.infer<typeof mcp>['data'] };

/** Additive SDK wire field; tolerate older SDK/server versions and validate before choosing a renderer. */
export function groupDisplays(message: object): GroupDisplay[] {
  if (!('display' in message) || !Array.isArray(message.display)) return [];
  const result = new Map<string, GroupDisplay>();
  for (const value of message.display.slice(0, 32)) {
    const card = parseResourceCardContent(value);
    if (card) {
      const { icon: _icon, ...data } = card.data;
      result.set(card.id, {
        kind: 'resource',
        id: card.id,
        card: { type: 'resource_card', id: card.id, data },
      });
      continue;
    }
    const w = widget.safeParse(value);
    if (w.success) {
      // Flat A2UI envelope and component boundaries are checked above; the shared renderer handles catalogue properties.
      result.set(w.data.id, {
        kind: 'widget',
        id: w.data.id,
        data: w.data.data as TMessageComponentWidgetData,
      });
      continue;
    }
    const app = mcp.safeParse(value);
    if (app.success)
      result.set(app.data.id, {
        kind: 'mcp',
        id: app.data.id,
        data: app.data.data,
      });
  }
  return [...result.values()];
}
