export const TOOL_OUTPUT_PRESENTATION_TYPE = 'xpert.tool-output' as const;
export const TOOL_OUTPUT_PRESENTATION_VERSION = 1 as const;

export type ToolOutputImageMimeType = 'image/png' | 'image/jpeg' | 'image/webp';

export type ToolOutputImageSource = 'knowledge-document' | 'sandbox';

/**
 * Stable evidence anchors that are safe to persist in chat history.
 *
 * Execution-scoped file paths, storage paths, signed URLs, and internal batch
 * references must not be included here.
 */
export type ToolOutputImageAnchors = {
  knowledgeDocumentId?: string;
  page?: number;
  chunkId?: string;
  sourceBlockIds?: string[];
  visualAssetId?: string;
};

/**
 * An immutable image that was prepared for a model vision step.
 *
 * Chat history stores only the private Artifact identity and presentation
 * metadata. The browser asks the trusted host to resolve a short-lived preview
 * URL when the image is rendered.
 */
export type ToolOutputImageAttachment = {
  type: 'image';
  artifactId: string;
  artifactVersionId: string;
  sha256: string;
  mimeType: ToolOutputImageMimeType;
  width?: number;
  height?: number;
  title?: string;
  alt?: string;
  source: ToolOutputImageSource;
  modelDetail: ImageDetail;
  anchors?: ToolOutputImageAnchors;
};

export type ToolOutputAttachment = ToolOutputImageAttachment;

/**
 * UI-only ToolMessage artifact. ToolMessage content remains the compact
 * model-facing result, while middleware metadata remains private to the model
 * execution path.
 */
export type ToolOutputPresentation = {
  type: typeof TOOL_OUTPUT_PRESENTATION_TYPE;
  version: typeof TOOL_OUTPUT_PRESENTATION_VERSION;
  attachments: ToolOutputAttachment[];
};

export type ToolOutputArtifactJsonValue =
  | string
  | number
  | boolean
  | null
  | ToolOutputArtifactJsonValue[]
  | { [key: string]: ToolOutputArtifactJsonValue };

/** JSON-safe artifact payloads supported by ToolMessage history. */
export type ToolMessageArtifact =
  | ToolOutputPresentation
  | ToolOutputArtifactJsonValue;

export type ToolOutputAttachmentPreviewRequest = {
  attachment: ToolOutputImageAttachment;
  toolCallId?: string;
  executionId?: string;
};

export type ToolOutputAttachmentPreview = {
  /** Short-lived, host-authorized URL. Never persist this value in a message. */
  previewUrl: string;
  expiresAt?: string;
};

/** Detail level requested for the model vision input. */
export type ImageDetail = 'auto' | 'low' | 'high';
