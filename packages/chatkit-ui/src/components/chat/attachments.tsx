import * as React from 'react';
import { FileText, Loader2, RefreshCw, X } from 'lucide-react';

import { cn, createMessageId } from '../../lib/utils';
import { useChatkitTranslation } from '../../i18n/useChatkitTranslation';
import type {
  AgentFile,
  AgentFileStatus,
  UploadingFile,
} from '../../lib/types';

const ACTIVE_PARSE_STATUSES = new Set<AgentFileStatus>([
  'uploaded',
  'scanning',
  'parsing',
]);
const TERMINAL_PARSE_STATUSES = new Set<AgentFileStatus>([
  'ready',
  'partial',
  'failed',
]);
const INITIAL_STATUS_POLL_DELAY_MS = 500;

export type ChatAttachmentFile = Partial<AgentFile> & {
  fileAssetId?: string;
  filePath?: string;
  originalName?: string;
  mimetype?: string;
};

// Parent Chat should only depend on stable FileAsset handles and coarse busy
// flags; upload queues, retry/remove UI, and parse-status polling stay here.
export type ChatAttachmentsState = {
  uploadedFiles: ChatAttachmentFile[];
  hasUploadingFiles: boolean;
  hasParsingFiles: boolean;
};

export type ChatAttachmentsHandle = {
  clear: () => void;
  clearWithRollback: () => () => void;
  openFilePicker: () => void;
  queueFiles: (files: ArrayLike<File>) => boolean;
};

export type AttachmentFileStatus = Partial<AgentFile> & {
  fileId?: string;
  status?: AgentFileStatus;
  parseStatus?: AgentFileStatus;
  error?: string;
  parsedAt?: Date | string;
  updatedAt?: Date | string;
};

type ChatAttachmentsProps = {
  accept?: string;
  maxCount?: number;
  maxSize?: number;
  retryUploadLabel: string;
  uploadFile: (file: File) => Promise<AgentFile>;
  deleteFile: (storageFileId: string) => Promise<void>;
  getFileStatus: (fileId: string) => Promise<AttachmentFileStatus | null>;
  onStateChange?: (state: ChatAttachmentsState) => void;
};

function readParseStatus(
  file?: Partial<AgentFile>,
): AgentFileStatus | undefined {
  return file?.parseStatus ?? file?.status;
}

function isActiveParseStatus(status?: AgentFileStatus) {
  return !!status && ACTIVE_PARSE_STATUSES.has(status);
}

function isTerminalParseStatus(status?: AgentFileStatus) {
  return !!status && TERMINAL_PARSE_STATUSES.has(status);
}

function isPollingTarget(item: UploadingFile) {
  return (
    item.status === 'success' &&
    !!item.uploadedFile &&
    isActiveParseStatus(readParseStatus(item.uploadedFile))
  );
}

function getStatusPollingDelay(elapsedMs: number) {
  if (elapsedMs < 10_000) {
    return 1_000;
  }
  if (elapsedMs < 60_000) {
    return 3_000;
  }
  return 8_000;
}

function toSubmittedFiles(attachments: UploadingFile[]): ChatAttachmentFile[] {
  return attachments
    .filter((item) => item.status === 'success' && item.uploadedFile)
    .map((item) => {
      const uploadedFile = item.uploadedFile as AgentFile;
      return {
        id: uploadedFile.id,
        fileId: uploadedFile.fileId,
        storageFileId: uploadedFile.storageFileId,
        objectKey: uploadedFile.objectKey,
        url: uploadedFile.url,
        fileUrl: uploadedFile.fileUrl,
        thumbUrl: uploadedFile.thumbUrl,
        originalName: uploadedFile.originalName ?? item.file.name,
        mimeType: uploadedFile.mimeType ?? item.file.type,
        size: uploadedFile.size ?? item.file.size,
        status: uploadedFile.status,
        parseStatus: uploadedFile.parseStatus,
        parseMode: uploadedFile.parseMode,
        purpose: uploadedFile.purpose,
        capabilities: uploadedFile.capabilities,
        summary: uploadedFile.summary,
        workspacePath: uploadedFile.workspacePath,
      };
    });
}

function mergeFileStatus(
  file: AgentFile,
  status: AttachmentFileStatus,
): AgentFile {
  const nextStatus = status.parseStatus ?? status.status;
  return {
    ...file,
    ...(status.id ? { id: status.id } : {}),
    ...(status.fileId ? { fileId: status.fileId } : {}),
    ...(status.storageFileId ? { storageFileId: status.storageFileId } : {}),
    ...(status.originalName ? { originalName: status.originalName } : {}),
    ...(status.mimeType ? { mimeType: status.mimeType } : {}),
    ...(typeof status.size === 'number' ? { size: status.size } : {}),
    ...(status.capabilities ? { capabilities: status.capabilities } : {}),
    ...(status.summary ? { summary: status.summary } : {}),
    ...(status.workspacePath ? { workspacePath: status.workspacePath } : {}),
    ...(nextStatus ? { status: nextStatus, parseStatus: nextStatus } : {}),
    ...(status.parseMode ? { parseMode: status.parseMode } : {}),
    ...(status.purpose ? { purpose: status.purpose } : {}),
  };
}

export const ChatAttachments = React.forwardRef<
  ChatAttachmentsHandle,
  ChatAttachmentsProps
>(function ChatAttachments(
  {
    accept,
    maxCount = 10,
    maxSize = 100 * 1024 * 1024,
    retryUploadLabel,
    uploadFile,
    deleteFile,
    getFileStatus,
    onStateChange,
  },
  ref,
) {
  const { t } = useChatkitTranslation();
  const [attachments, setAttachments] = React.useState<UploadingFile[]>([]);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const attachmentsRef = React.useRef(attachments);
  attachmentsRef.current = attachments;

  const uploadAttachment = React.useCallback(
    async (localId: string, file: File) => {
      try {
        const result = await uploadFile(file);
        setAttachments((prev) =>
          prev.map((item) =>
            item.localId === localId
              ? { ...item, status: 'success' as const, uploadedFile: result }
              : item,
          ),
        );
      } catch (error) {
        setAttachments((prev) =>
          prev.map((item) =>
            item.localId === localId
              ? {
                  ...item,
                  status: 'error' as const,
                  error:
                    error instanceof Error ? error.message : 'Upload failed',
                }
              : item,
          ),
        );
      }
    },
    [uploadFile],
  );

  const queueFiles = React.useCallback(
    (files: ArrayLike<File>) => {
      const availableSlots = Math.max(
        maxCount - attachmentsRef.current.length,
        0,
      );
      if (availableSlots === 0) {
        return false;
      }

      const newAttachments: UploadingFile[] = [];
      for (const file of Array.from(files)) {
        if (newAttachments.length >= availableSlots) {
          break;
        }
        if (file.size > maxSize) {
          console.warn(
            `File ${file.name} exceeds max size of ${maxSize} bytes`,
          );
          continue;
        }
        newAttachments.push({
          localId: createMessageId(),
          file,
          status: 'uploading',
        });
      }

      if (!newAttachments.length) {
        return false;
      }

      setAttachments((prev) => [...prev, ...newAttachments].slice(0, maxCount));
      newAttachments.forEach((item) => {
        void uploadAttachment(item.localId, item.file);
      });
      return true;
    },
    [maxCount, maxSize, uploadAttachment],
  );

  const retryUpload = React.useCallback(
    (localId: string) => {
      const attachment = attachmentsRef.current.find(
        (item) => item.localId === localId,
      );
      if (!attachment || attachment.status !== 'error') {
        return;
      }

      setAttachments((prev) =>
        prev.map((item) =>
          item.localId === localId
            ? { ...item, status: 'uploading' as const, error: undefined }
            : item,
        ),
      );
      void uploadAttachment(localId, attachment.file);
    },
    [uploadAttachment],
  );

  const removeAttachment = React.useCallback(
    async (localId: string) => {
      const attachment = attachmentsRef.current.find(
        (item) => item.localId === localId,
      );
      if (!attachment) {
        return;
      }

      if (
        attachment.status === 'success' &&
        attachment.uploadedFile?.storageFileId
      ) {
        try {
          await deleteFile(attachment.uploadedFile.storageFileId);
        } catch {
          // Still remove from local state even if server delete fails.
        }
      }

      setAttachments((prev) => prev.filter((item) => item.localId !== localId));
    },
    [deleteFile],
  );

  const handleFileChange = React.useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const files = event.target.files;
      if (files?.length) {
        queueFiles(files);
      }
      event.target.value = '';
    },
    [queueFiles],
  );

  React.useImperativeHandle(
    ref,
    () => ({
      clear: () => setAttachments([]),
      clearWithRollback: () => {
        const clearedAttachments = [...attachmentsRef.current];
        let restored = false;
        setAttachments([]);

        return () => {
          if (restored) return;
          restored = true;
          setAttachments((current) => {
            const currentIds = new Set(
              current.map((attachment) => attachment.localId),
            );
            return [
              ...clearedAttachments.filter(
                (attachment) => !currentIds.has(attachment.localId),
              ),
              ...current,
            ];
          });
        };
      },
      openFilePicker: () => inputRef.current?.click(),
      queueFiles,
    }),
    [queueFiles],
  );

  React.useEffect(() => {
    onStateChange?.({
      uploadedFiles: toSubmittedFiles(attachments),
      hasUploadingFiles: attachments.some(
        (item) => item.status === 'uploading',
      ),
      hasParsingFiles: attachments.some((item) => isPollingTarget(item)),
    });
  }, [attachments, onStateChange]);

  const hasPollingTargets = attachments.some(isPollingTarget);
  React.useEffect(() => {
    if (!hasPollingTargets) {
      return;
    }

    let cancelled = false;
    let timer: number | undefined;
    const startedAt = Date.now();

    const schedule = (delay: number) => {
      timer = window.setTimeout(tick, delay);
    };

    const tick = async () => {
      const targets = attachmentsRef.current.filter(isPollingTarget);
      if (!targets.length) {
        return;
      }

      if (
        typeof document !== 'undefined' &&
        document.visibilityState === 'hidden'
      ) {
        schedule(15_000);
        return;
      }

      await Promise.all(
        targets.map(async (item) => {
          const uploadedFile = item.uploadedFile;
          const fileId = uploadedFile?.fileId ?? uploadedFile?.id;
          if (!uploadedFile || !fileId) {
            return;
          }

          try {
            const status = await getFileStatus(fileId);
            if (!status || cancelled) {
              return;
            }
            setAttachments((prev) =>
              prev.map((current) => {
                if (current.localId !== item.localId || !current.uploadedFile) {
                  return current;
                }
                const nextFile = mergeFileStatus(current.uploadedFile, status);
                return {
                  ...current,
                  uploadedFile: nextFile,
                  error:
                    readParseStatus(nextFile) === 'failed'
                      ? (status.error ?? current.error)
                      : current.error,
                };
              }),
            );
          } catch {
            // Keep polling; transient status errors should not strand the chip.
          }
        }),
      );

      if (
        !cancelled &&
        attachmentsRef.current.some((item) => {
          const status = readParseStatus(item.uploadedFile);
          return isActiveParseStatus(status) && !isTerminalParseStatus(status);
        })
      ) {
        schedule(getStatusPollingDelay(Date.now() - startedAt));
      }
    };

    // `/contexts/file` may return while parsing is still async. Poll the compact
    // status endpoint until the file reaches ready/partial/failed, then stop.
    schedule(INITIAL_STATUS_POLL_DELAY_MS);
    return () => {
      cancelled = true;
      if (timer != null) {
        window.clearTimeout(timer);
      }
    };
  }, [getFileStatus, hasPollingTargets]);

  if (!attachments.length) {
    return (
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={accept}
        onChange={handleFileChange}
        className="hidden"
      />
    );
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={accept}
        onChange={handleFileChange}
        className="hidden"
      />
      <div className="mb-3 flex flex-wrap gap-2">
        {attachments.map((item) => {
          const parseStatus = readParseStatus(item.uploadedFile);
          const isParsing =
            item.status === 'success' && isActiveParseStatus(parseStatus);
          const parseFailed =
            item.status === 'success' && parseStatus === 'failed';

          return (
            <div
              key={item.localId}
              className={cn(
                'flex items-center gap-2 rounded-md px-2 py-1 text-sm',
                item.status === 'error' || parseFailed
                  ? 'bg-destructive/10 border border-destructive/30'
                  : 'bg-muted',
              )}
            >
              {(item.status === 'uploading' || isParsing) && (
                <Loader2
                  size={14}
                  className="animate-spin text-muted-foreground"
                />
              )}
              {item.status === 'success' && !isParsing && !parseFailed && (
                <FileText size={14} className="text-muted-foreground" />
              )}
              {(item.status === 'error' || parseFailed) && (
                <FileText size={14} className="text-destructive" />
              )}

              <span
                className={cn(
                  'max-w-30 truncate',
                  (item.status === 'error' || parseFailed) &&
                    'text-destructive',
                )}
              >
                {item.file.name}
              </span>
              {item.status === 'success' && parseStatus && (
                <span className="text-xs text-muted-foreground">
                  {t(`chat.attachmentStatus.${parseStatus}`)}
                </span>
              )}

              {item.status === 'error' && (
                <button
                  type="button"
                  onClick={() => retryUpload(item.localId)}
                  className="ml-1 rounded-full p-0.5 text-destructive hover:bg-destructive/20"
                  title={retryUploadLabel}
                >
                  <RefreshCw size={12} />
                </button>
              )}

              <button
                type="button"
                onClick={() => removeAttachment(item.localId)}
                className={cn(
                  'ml-1 rounded-full p-0.5',
                  item.status === 'error'
                    ? 'text-destructive hover:bg-destructive/20'
                    : 'hover:bg-muted-foreground/20',
                )}
              >
                <X size={12} />
              </button>
            </div>
          );
        })}
      </div>
    </>
  );
});
