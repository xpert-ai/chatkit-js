# ChatKit Types

This package is the type-definition library for ChatKit, providing unified, reusable API types for the ChatKit project.

## Role in the ChatKit project

- Exposes the interface signatures and event types of `XpertAIChatKit`, ensuring consistency between integrators and internal implementation.
- Aggregates core chat-related types (such as `ChatKitOptions`, messages, attachments, widgets, interrupts) for reuse by the UI package and business side.
- Serves as a standalone types package so that the ChatKit Web Component and the XpertAI platform can obtain type hints and validation without bringing in implementation code.

## Tool output image attachments

Tools that prepare images for a model vision step can expose the same immutable
images in the tool-call output with a `ToolOutputPresentation` artifact. Persist
only Artifact identity and display metadata in message history—never a signed
URL, storage path, or base64 payload.

```ts
const artifact: ToolOutputPresentation = {
  type: 'xpert.tool-output',
  version: 1,
  attachments: [
    {
      type: 'image',
      artifactId: 'artifact-id',
      artifactVersionId: 'immutable-version-id',
      sha256: 'a'.repeat(64),
      mimeType: 'image/png',
      title: 'Picture 1 on page 75',
      source: 'knowledge-document',
      modelDetail: 'high',
      anchors: { knowledgeDocumentId: 'document-id', page: 75 },
    },
  ],
};
```

The embedding host authorizes preview access and resolves a short-lived URL at
render time:

```ts
const options: Partial<ChatKitOptions> = {
  toolOutputAttachments: {
    onRequestPreview: async ({ attachment }) => {
      const preview = await authorizedArtifactPreviewResolver({
        artifactId: attachment.artifactId,
        artifactVersionId: attachment.artifactVersionId,
        sha256: attachment.sha256,
      });

      return {
        previewUrl: preview.url,
        expiresAt: preview.expiresAt,
      };
    },
  },
};
```

The resolver must authorize the current user and requested Artifact version.
ChatKit validates the descriptor, accepts only PNG/JPEG/WebP previews over
HTTP(S), does not persist the resolved URL, and resolves it again after expiry
or page reload.
