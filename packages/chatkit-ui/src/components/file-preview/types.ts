import type { FileKind } from '../../lib/files/file-types';

export type FilePreviewContent = {
  fileName: string;
  kind: FileKind;
  url: string;
  text: string;
};

/** File access is supplied by the caller; preview components know no SDK or host. */
export type PreviewFile = { blob: Blob; fileName: string };
export type FilePreviewLoader = (signal: AbortSignal) => Promise<PreviewFile>;
export type FilePreviewSource = {
  load: FilePreviewLoader;
  /** May download an original that differs from the preview, such as DOCX/PDF. */
  download: () => Promise<void>;
};
