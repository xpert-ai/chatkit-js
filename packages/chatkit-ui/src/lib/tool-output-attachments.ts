import {
  TOOL_OUTPUT_PRESENTATION_TYPE,
  TOOL_OUTPUT_PRESENTATION_VERSION,
  type ToolOutputAttachmentPreview,
  type ToolOutputImageAttachment,
  type ToolOutputPresentation,
} from '@xpert-ai/chatkit-types';
import { z } from 'zod';

const boundedId = z.string().trim().min(1).max(256);
const boundedLabel = z.string().trim().min(1).max(500);

const toolOutputImageAnchorsSchema = z
  .object({
    knowledgeDocumentId: boundedId.optional(),
    page: z.number().int().positive().max(1_000_000).optional(),
    chunkId: boundedId.optional(),
    sourceBlockIds: z.array(boundedId).max(100).optional(),
    visualAssetId: boundedId.optional(),
  })
  .strict();

const toolOutputImageAttachmentSchema = z
  .object({
    type: z.literal('image'),
    artifactId: boundedId,
    artifactVersionId: boundedId,
    sha256: z.string().regex(/^[a-f0-9]{64}$/i),
    mimeType: z.enum(['image/png', 'image/jpeg', 'image/webp']),
    width: z.number().int().positive().max(100_000).optional(),
    height: z.number().int().positive().max(100_000).optional(),
    title: boundedLabel.optional(),
    alt: boundedLabel.optional(),
    source: z.enum(['knowledge-document', 'sandbox']),
    modelDetail: z.enum(['auto', 'low', 'high']),
    anchors: toolOutputImageAnchorsSchema.optional(),
  })
  .strict();

const toolOutputPresentationSchema = z
  .object({
    type: z.literal(TOOL_OUTPUT_PRESENTATION_TYPE),
    version: z.literal(TOOL_OUTPUT_PRESENTATION_VERSION),
    attachments: z.array(toolOutputImageAttachmentSchema).min(1).max(20),
  })
  .strict();

const toolOutputAttachmentPreviewSchema = z
  .object({
    previewUrl: z.string().url(),
    expiresAt: z.string().optional(),
  })
  .strict()
  .superRefine((preview, context) => {
    const protocol = new URL(preview.previewUrl).protocol;
    if (protocol !== 'https:' && protocol !== 'http:') {
      context.addIssue({
        code: 'custom',
        message: 'Tool-output previews must use an HTTP(S) URL.',
        path: ['previewUrl'],
      });
    }

    if (preview.expiresAt && Number.isNaN(Date.parse(preview.expiresAt))) {
      context.addIssue({
        code: 'custom',
        message: 'Tool-output preview expiry must be an ISO date string.',
        path: ['expiresAt'],
      });
    }
  });

export function parseToolOutputPresentation(
  value: unknown,
): ToolOutputPresentation | null {
  const result = toolOutputPresentationSchema.safeParse(value);
  return result.success ? result.data : null;
}

export function parseToolOutputAttachmentPreview(
  value: unknown,
): ToolOutputAttachmentPreview | null {
  const result = toolOutputAttachmentPreviewSchema.safeParse(value);
  return result.success ? result.data : null;
}

export function toolOutputAttachmentKey(attachment: ToolOutputImageAttachment) {
  return `${attachment.artifactId}:${attachment.artifactVersionId}:${attachment.sha256}`;
}
