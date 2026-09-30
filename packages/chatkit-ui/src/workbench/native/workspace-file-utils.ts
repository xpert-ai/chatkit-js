import type { XpertWorkspaceFile } from '@xpert-ai/xpert-sdk';
import { fileKind } from './file-types';

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export const fileName = (path: string) =>
  path.split('/').filter(Boolean).pop() ?? path;
export const isFolder = (file: XpertWorkspaceFile) =>
  file.hasChildren === true || file.fileType === 'directory';
export const validRelativePath = (path: string) =>
  !!path &&
  !path.startsWith('/') &&
  !path.includes('\\') &&
  !path.includes('\0') &&
  path.split('/').every((part) => !!part && part !== '..' && part !== '.');

export function previewKind(file: XpertWorkspaceFile) {
  return /\.(csv|tsv)$/i.test(file.filePath)
    ? 'text'
    : fileKind(file.filePath, file.mimeType);
}
export function isOfficeFile(file: XpertWorkspaceFile) {
  return (
    ['docx', 'spreadsheet', 'pptx'].includes(previewKind(file)) ||
    /\.(doc|ppt)$/i.test(file.filePath)
  );
}
