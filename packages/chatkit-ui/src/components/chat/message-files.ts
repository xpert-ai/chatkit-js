import type { ChatKitReference } from '@xpert-ai/chatkit-types';

import type { ChatAttachmentFile } from './attachments';

function addIdentity(identities: Set<string>, value?: string) {
  const identity = value?.trim();
  if (identity) {
    identities.add(identity);
  }
}

function getAttachmentIdentities(file: ChatAttachmentFile) {
  const identities = new Set<string>();
  addIdentity(identities, file.id);
  addIdentity(identities, file.fileId);
  addIdentity(identities, file.storageFileId);
  addIdentity(identities, file.url);
  addIdentity(identities, file.fileUrl);
  addIdentity(identities, file.thumbUrl);
  return identities;
}

function getImageReferenceIdentities(references: ChatKitReference[]) {
  const identities = new Set<string>();

  references.forEach((reference) => {
    if (reference.type !== 'image') {
      return;
    }
    addIdentity(identities, reference.id);
    addIdentity(identities, reference.fileId);
    addIdentity(identities, reference.url);
  });

  return identities;
}

export function getVisibleHumanAttachments(
  attachments: ChatAttachmentFile[],
  references: ChatKitReference[],
) {
  const imageReferenceIdentities = getImageReferenceIdentities(references);
  const visibleAttachmentIdentities = new Set<string>();

  return attachments.filter((attachment) => {
    const identities = getAttachmentIdentities(attachment);
    const isImageReference = [...identities].some((identity) =>
      imageReferenceIdentities.has(identity),
    );
    if (isImageReference) {
      return false;
    }

    const isDuplicate = [...identities].some((identity) =>
      visibleAttachmentIdentities.has(identity),
    );
    if (isDuplicate) {
      return false;
    }

    identities.forEach((identity) =>
      visibleAttachmentIdentities.add(identity),
    );
    return true;
  });
}
