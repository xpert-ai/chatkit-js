import { getReferenceKey } from '../../../lib/references';
import { ChatAttachments } from '../attachments';
import { ReferenceChip } from '../ReferenceChip';
import type { useChatEnvironment } from '../session/useChatEnvironment';
import type { useChatFiles } from './useChatFiles';
import { WorkspaceFileChip } from './WorkspaceFileChip';

type ChatComposerAttachmentsProps = Pick<
  ReturnType<typeof useChatFiles>,
  | 'attachmentsRef'
  | 'acceptMimes'
  | 'uploadContextFile'
  | 'deleteContextFile'
  | 'getContextFileStatus'
  | 'setAttachmentState'
  | 'references'
  | 'setReferences'
  | 'referencedWorkspaceFiles'
  | 'setReferencedWorkspaceFiles'
> &
  Pick<ReturnType<typeof useChatEnvironment>, 'composer' | 't'>;

export function ChatComposerAttachments({
  attachmentsRef,
  acceptMimes,
  composer,
  t,
  uploadContextFile,
  deleteContextFile,
  getContextFileStatus,
  setAttachmentState,
  references,
  setReferences,
  referencedWorkspaceFiles,
  setReferencedWorkspaceFiles,
}: ChatComposerAttachmentsProps) {
  return (
    <>
      <ChatAttachments
        ref={attachmentsRef}
        accept={acceptMimes}
        maxCount={composer?.attachments?.maxCount ?? 10}
        maxSize={composer?.attachments?.maxSize ?? 100 * 1024 * 1024}
        retryUploadLabel={t('chat.retryUpload')}
        uploadFile={uploadContextFile}
        deleteFile={deleteContextFile}
        getFileStatus={getContextFileStatus}
        onStateChange={setAttachmentState}
      />
      {references.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-2">
          {references.map((reference) => (
            <ReferenceChip
              key={getReferenceKey(reference)}
              reference={reference}
              variant="composer"
              onRemove={() =>
                setReferences((previous) =>
                  previous.filter(
                    (item) =>
                      getReferenceKey(item) !== getReferenceKey(reference),
                  ),
                )
              }
              removeLabel={t('composer.removeReference')}
            />
          ))}
        </div>
      )}
      {referencedWorkspaceFiles.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-2">
          {referencedWorkspaceFiles.map((file) => {
            const id =
              file.workspacePath ??
              file.filePath ??
              file.fileAssetId ??
              file.fileId ??
              file.id;
            return (
              <WorkspaceFileChip
                key={id}
                file={file}
                onRemove={() =>
                  setReferencedWorkspaceFiles((current) =>
                    current.filter(
                      (item) =>
                        (item.workspacePath ??
                          item.filePath ??
                          item.fileAssetId ??
                          item.fileId ??
                          item.id) !== id,
                    ),
                  )
                }
                removeLabel={t('composer.fileMentions.remove')}
              />
            );
          })}
        </div>
      )}
    </>
  );
}
