/**
 * Represents a file stored on the server.
 * Returned by the file upload API.
 */
export interface StorageFile {
  id: string;
  file: string;
  url?: string;
  fileUrl?: string;
  thumbUrl?: string;
  originalName?: string;
  size?: number;
  mimetype?: string;
}

/**
 * Represents a file being uploaded or already uploaded.
 */
export type UploadingFile = {
  /** Local unique ID for tracking */
  localId: string;
  /** Original File object */
  file: File;
  /** Upload status */
  status: 'uploading' | 'success' | 'error';
  /** Server-side file info after successful upload */
  storageFile?: StorageFile;
  /** Error message if upload failed */
  error?: string;
};
