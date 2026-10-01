import type { ChatKitImageReference } from '@xpert-ai/chatkit-types';
import type { XpertWorkspaceFile } from '@xpert-ai/xpert-sdk';
import type { AgentFile, StorageFile } from '../../../lib/types';
import { getWorkspaceFilePath } from '../../composer/WorkspaceFileMentionPalette';
import type { ChatAttachmentFile } from '../attachments';

export const LONG_TEXT_REFERENCE_THRESHOLD = 5000;

export function toReferencedWorkspaceFile(
  file: XpertWorkspaceFile,
): ChatAttachmentFile {
  const filePath = getWorkspaceFilePath(file);
  return {
    filePath,
    workspacePath: filePath,
    originalName: file.filePath,
    mimeType: file.mimeType,
    size: file.size,
    purpose: 'workspace',
  };
}

export function mergeSubmittedFiles(
  uploadedFiles: ChatAttachmentFile[],
  referencedFiles: ChatAttachmentFile[],
): ChatAttachmentFile[] {
  const filesById = new Map<string, ChatAttachmentFile>();
  [...uploadedFiles, ...referencedFiles].forEach((file) => {
    const id =
      file.fileAssetId ??
      file.fileId ??
      file.id ??
      file.storageFileId ??
      file.workspacePath;
    if (id) filesById.set(id, file);
  });
  return Array.from(filesById.values());
}

export async function readImageDimensions(file: File): Promise<{
  width?: number;
  height?: number;
}> {
  if (typeof window === 'undefined' || typeof URL === 'undefined') {
    return {};
  }

  return new Promise((resolve) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new window.Image();

    const cleanup = () => {
      URL.revokeObjectURL(objectUrl);
    };

    image.onload = () => {
      resolve({
        width: image.naturalWidth || undefined,
        height: image.naturalHeight || undefined,
      });
      cleanup();
    };
    image.onerror = () => {
      resolve({});
      cleanup();
    };
    image.src = objectUrl;
  });
}

export function getUploadedFileUrl(
  file: AgentFile | StorageFile,
): string | undefined {
  return file.url ?? file.fileUrl ?? file.thumbUrl;
}

export function buildPastedImageReference(
  file: File,
  uploadedFile: AgentFile,
  dimensions?: { width?: number; height?: number },
): ChatKitImageReference {
  const name =
    uploadedFile.originalName?.trim() || file.name.trim() || 'Pasted image';
  const mimeType =
    uploadedFile.mimeType?.trim() || file.type.trim() || 'image/*';
  const size = uploadedFile.size ?? file.size;
  const width = dimensions?.width;
  const height = dimensions?.height;
  const metaParts = [
    mimeType,
    width && height ? `${width}x${height}` : null,
    typeof size === 'number' ? `${size} bytes` : null,
  ].filter((part): part is string => Boolean(part));

  return {
    type: 'image',
    id: uploadedFile.id,
    fileId: uploadedFile.storageFileId,
    url: getUploadedFileUrl(uploadedFile),
    mimeType,
    name,
    ...(typeof size === 'number' ? { size } : {}),
    ...(width ? { width } : {}),
    ...(height ? { height } : {}),
    text: `Pasted image${metaParts.length ? ` (${metaParts.join(', ')})` : ''}: ${name}`,
  };
}
