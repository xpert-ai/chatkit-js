import {
  parseToolOutputAttachmentPreview,
  parseToolOutputPresentation,
} from './tool-output-attachments';
import { describe, expect, it } from 'vitest';

const sha256 = 'a'.repeat(64);

describe('tool output attachments', () => {
  it('accepts immutable image artifact descriptors without persisted URLs', () => {
    expect(
      parseToolOutputPresentation({
        type: 'xpert.tool-output',
        version: 1,
        attachments: [
          {
            type: 'image',
            artifactId: 'artifact-1',
            artifactVersionId: 'version-1',
            sha256,
            mimeType: 'image/png',
            width: 1280,
            height: 720,
            title: 'Drawing on page 75',
            source: 'knowledge-document',
            modelDetail: 'high',
            anchors: {
              knowledgeDocumentId: 'document-1',
              page: 75,
              visualAssetId: 'asset-1',
            },
          },
        ],
      }),
    ).toMatchObject({
      type: 'xpert.tool-output',
      attachments: [{ artifactVersionId: 'version-1', sha256 }],
    });
  });

  it('rejects embedded URLs, base64 data, SVG, and invalid hashes', () => {
    const baseAttachment = {
      type: 'image',
      artifactId: 'artifact-1',
      artifactVersionId: 'version-1',
      sha256,
      mimeType: 'image/png',
      source: 'sandbox',
      modelDetail: 'low',
    };

    expect(
      parseToolOutputPresentation({
        type: 'xpert.tool-output',
        version: 1,
        attachments: [
          { ...baseAttachment, previewUrl: 'data:image/png;base64,AAAA' },
        ],
      }),
    ).toBeNull();
    expect(
      parseToolOutputPresentation({
        type: 'xpert.tool-output',
        version: 1,
        attachments: [{ ...baseAttachment, mimeType: 'image/svg+xml' }],
      }),
    ).toBeNull();
    expect(
      parseToolOutputPresentation({
        type: 'xpert.tool-output',
        version: 1,
        attachments: [{ ...baseAttachment, sha256: 'not-a-hash' }],
      }),
    ).toBeNull();
  });

  it('only accepts host-resolved HTTP(S) preview URLs', () => {
    expect(
      parseToolOutputAttachmentPreview({
        previewUrl: 'https://assets.example/tool-image.png?token=short-lived',
        expiresAt: '2026-08-17T10:00:00.000Z',
      }),
    ).not.toBeNull();
    expect(
      parseToolOutputAttachmentPreview({
        previewUrl: 'data:image/png;base64,AAAA',
      }),
    ).toBeNull();
    expect(
      parseToolOutputAttachmentPreview({
        previewUrl: 'javascript:alert(1)',
      }),
    ).toBeNull();
  });
});
