/**
 * @deprecated Chat attachments should use `AgentFile`. This shape is kept only
 * for old upload responses that returned raw StorageFile records.
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

export type AgentFileStatus =
  | 'uploaded'
  | 'scanning'
  | 'parsing'
  | 'ready'
  | 'partial'
  | 'failed';

/**
 * Agent-facing uploaded file handle. `id`/`fileId` point to FileAsset, while
 * `storageFileId` keeps the object-storage bridge available for deletion and
 * backward compatibility.
 */
export interface AgentFile {
  id: string;
  fileId: string;
  storageFileId: string;
  objectKey?: string;
  url?: string;
  fileUrl?: string;
  thumbUrl?: string;
  originalName?: string;
  size?: number;
  mimeType?: string;
  status: AgentFileStatus;
  parseStatus: AgentFileStatus;
  parseMode?: 'auto' | 'fast' | 'deep' | 'none';
  purpose?: 'chat_attachment' | 'workspace' | 'knowledge';
  capabilities?: string[];
  summary?: string;
  workspacePath?: string;
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
  /** Server-side FileAsset handle after successful upload */
  uploadedFile?: AgentFile;
  /** Error message if upload failed */
  error?: string;
};
