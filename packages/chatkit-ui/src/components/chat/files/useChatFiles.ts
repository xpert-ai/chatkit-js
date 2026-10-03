import type { ChatKitReference } from '@xpert-ai/chatkit-types';
import type { XpertWorkspaceFile } from '@xpert-ai/xpert-sdk';
import * as React from 'react';
import { getComposerThreadReferences } from '../../../lib/composer-parts';
import { mergeReferences } from '../../../lib/references';
import type { AgentFile } from '../../../lib/types';
import { getWorkspaceFilePath } from '../../composer/WorkspaceFileMentionPalette';
import type {
  AttachmentFileStatus,
  ChatAttachmentFile,
  ChatAttachmentsHandle,
  ChatAttachmentsState,
} from '../attachments';
import type { useChatDraft } from '../composer/useChatDraft';
import type { useChatEnvironment } from '../session/useChatEnvironment';
import type { ChatReferenceRequest } from '../types';
import { toReferencedWorkspaceFile } from './file-utils';

type ChatFilesOptions = Pick<
  ReturnType<typeof useChatDraft>,
  'composerParts' | 'composerInputRef' | 'setThreadMention'
> &
  Pick<
    ReturnType<typeof useChatEnvironment>,
    'stream' | 'activeProjectId' | 'composer'
  > & {
    referenceRequest: ChatReferenceRequest | null | undefined;
  };

export function useChatFiles({
  composerParts,
  referenceRequest,
  composerInputRef,
  stream,
  setThreadMention,
  activeProjectId,
  composer,
}: ChatFilesOptions) {
  const [attachmentState, setAttachmentState] =
    React.useState<ChatAttachmentsState>({
      uploadedFiles: [],
      hasUploadingFiles: false,
      hasParsingFiles: false,
    });

  const [references, setReferences] = React.useState<ChatKitReference[]>([]);
  const [referencedWorkspaceFiles, setReferencedWorkspaceFiles] =
    React.useState<ChatAttachmentFile[]>([]);

  const [isUploadingReferenceImages, setIsUploadingReferenceImages] =
    React.useState(false);

  const attachmentsRef = React.useRef<ChatAttachmentsHandle>(null);
  const appliedReferenceRequestRef = React.useRef<string | null>(null);
  const hasReferences =
    references.length > 0 ||
    getComposerThreadReferences(composerParts).length > 0 ||
    referencedWorkspaceFiles.length > 0;

  const referencedWorkspaceFilePaths = React.useMemo(
    () =>
      new Set(
        referencedWorkspaceFiles.flatMap((file) => {
          const filePath = file.workspacePath ?? file.filePath;
          return filePath ? [filePath] : [];
        }),
      ),
    [referencedWorkspaceFiles],
  );

  React.useEffect(() => {
    if (
      !referenceRequest ||
      appliedReferenceRequestRef.current === referenceRequest.id
    ) {
      return;
    }
    appliedReferenceRequestRef.current = referenceRequest.id;
    setReferences((previous) =>
      mergeReferences(previous, [referenceRequest.reference]),
    );
    requestAnimationFrame(() => composerInputRef.current?.focus());
  }, [referenceRequest]);

  const queueAttachmentFiles = React.useCallback((files: ArrayLike<File>) => {
    return attachmentsRef.current?.queueFiles(files) ?? false;
  }, []);

  // Submit only FileAsset handles. Parsed summaries/content stay server-side and
  // are fetched later by built-in file-understanding tools.
  const uploadedFiles = attachmentState.uploadedFiles;
  const handleAttachmentClick = () => {
    attachmentsRef.current?.openFilePicker();
  };

  const uploadContextFile = React.useCallback(
    (file: File) => {
      const formData = new FormData();
      formData.append('file', file, file.name || 'upload');
      // The backend creates a StorageFile for object storage, then returns an
      // AgentFile/FileAsset handle for chat runtime and file tools.
      formData.append('purpose', 'chat_attachment');
      formData.append('parseMode', 'auto');
      if (stream.assistantId) {
        formData.append('xpertId', stream.assistantId);
      }
      if (stream.threadId) {
        formData.append('threadId', stream.threadId);
      }
      return (
        stream.client.contexts as unknown as {
          fetch<TResponse>(
            path: string,
            options: RequestInit,
          ): Promise<TResponse>;
        }
      ).fetch<AgentFile>('/contexts/file', {
        method: 'POST',
        body: formData,
      });
    },
    [stream.assistantId, stream.client, stream.threadId],
  );

  const getContextFileStatus = React.useCallback(
    (fileId: string) =>
      (
        stream.client.contexts as unknown as {
          fetch<TResponse>(
            path: string,
            options?: RequestInit,
          ): Promise<TResponse>;
        }
      ).fetch<AttachmentFileStatus>(`/files/${fileId}/status`, {
        method: 'GET',
      }),
    [stream.client],
  );

  const deleteContextFile = React.useCallback(
    (storageFileId: string) => stream.client.contexts.deleteFile(storageFileId),
    [stream.client],
  );

  const addWorkspaceFileReference = React.useCallback(
    (file: XpertWorkspaceFile) => {
      const filePath = getWorkspaceFilePath(file);
      setReferencedWorkspaceFiles((current) =>
        current.some(
          (item) => (item.workspacePath ?? item.filePath) === filePath,
        )
          ? current
          : [...current, toReferencedWorkspaceFile(file)],
      );
    },
    [],
  );

  React.useEffect(() => {
    setReferencedWorkspaceFiles([]);
    setThreadMention(null);
  }, [activeProjectId, stream.assistantId]);

  // Build accept string for file input
  const acceptMimes = composer?.attachments?.accept
    ? Object.entries(composer.attachments.accept)
        .map(([mime, exts]) => [mime, ...exts.map((e) => `.${e}`)].join(','))
        .join(',')
    : undefined;
  return {
    attachmentsRef,
    setReferences,
    setReferencedWorkspaceFiles,
    attachmentState,
    isUploadingReferenceImages,
    hasReferences,
    uploadedFiles,
    referencedWorkspaceFiles,
    references,
    queueAttachmentFiles,
    setIsUploadingReferenceImages,
    uploadContextFile,
    acceptMimes,
    deleteContextFile,
    getContextFileStatus,
    setAttachmentState,
    handleAttachmentClick,
    referencedWorkspaceFilePaths,
    addWorkspaceFileReference,
  };
}
