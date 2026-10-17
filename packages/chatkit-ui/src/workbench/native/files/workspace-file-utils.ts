import type { XpertWorkspaceFile } from '@xpert-ai/xpert-sdk';
import { previewFileKind } from '../../../lib/files/file-types';

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

/** Resolve user-entered paths without allowing traversal outside the workspace. */
export function resolveWorkspacePath(
  value: string,
  basePath: string,
): string | null {
  const input = value.trim();
  if (!input || input.startsWith('/') || /[\\\0]/.test(input)) return null;
  const parts = basePath.split('/').filter(Boolean);
  for (const part of input.split('/')) {
    if (!part || part === '.') continue;
    if (part === '..') {
      if (!parts.length) return null;
      parts.pop();
    } else parts.push(part);
  }
  return parts.join('/');
}

/** Use workspace-relative paths internally; the API's filePath is an entry name. */
export function normalizeWorkspaceFiles(
  files: XpertWorkspaceFile[],
  directory: string,
): XpertWorkspaceFile[] {
  return files.map((file) => ({
    ...file,
    filePath:
      file.fullPath ||
      // Also accept providers that already return a workspace-relative filePath.
      (file.filePath.includes('/')
        ? file.filePath
        : [directory, file.filePath].filter(Boolean).join('/')),
  }));
}

export function previewKind(file: XpertWorkspaceFile) {
  return previewFileKind(file.filePath, file.mimeType);
}
export function isOfficeFile(file: XpertWorkspaceFile) {
  return (
    ['docx', 'spreadsheet', 'pptx'].includes(previewKind(file)) ||
    /\.(doc|ppt)$/i.test(file.filePath)
  );
}
