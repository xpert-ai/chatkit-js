import type { ChatKitReference } from '@xpert-ai/chatkit-types';
import { describe, expect, it } from 'vitest';

import type { ChatAttachmentFile } from './attachments';
import { getVisibleHumanAttachments } from './message-files';

describe('getVisibleHumanAttachments', () => {
  it('hides file representations already shown as an image reference', () => {
    const references: ChatKitReference[] = [
      {
        type: 'image',
        id: 'image-reference-1',
        fileId: 'storage-image-1',
        url: 'https://files.example/image.png',
        text: 'Pasted image: image.png',
      },
    ];
    const attachments: ChatAttachmentFile[] = [
      {
        id: 'image-asset-1',
        fileId: 'image-asset-1',
        storageFileId: 'storage-image-1',
        originalName: 'image.png',
      },
      {
        id: 'storage-image-1',
        originalName: 'image.png',
      },
      {
        id: 'document-asset-1',
        originalName: 'brief.pdf',
      },
    ];

    expect(getVisibleHumanAttachments(attachments, references)).toEqual([
      expect.objectContaining({ id: 'document-asset-1' }),
    ]);
  });

  it('deduplicates FileAsset and legacy attachment representations', () => {
    const attachments: ChatAttachmentFile[] = [
      {
        id: 'asset-1',
        storageFileId: 'storage-1',
        originalName: 'brief.pdf',
      },
      {
        id: 'storage-1',
        originalName: 'brief.pdf',
      },
    ];

    expect(getVisibleHumanAttachments(attachments, [])).toEqual([
      expect.objectContaining({ id: 'asset-1' }),
    ]);
  });
});
