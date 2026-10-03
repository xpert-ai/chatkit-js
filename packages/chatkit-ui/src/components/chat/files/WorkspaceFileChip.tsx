import { FileText, X } from 'lucide-react';
import type { ChatAttachmentFile } from '../attachments';

export function WorkspaceFileChip({
  file,
  onRemove,
  removeLabel,
}: {
  file: ChatAttachmentFile;
  onRemove: () => void;
  removeLabel: string;
}) {
  const label =
    file.originalName ??
    file.workspacePath ??
    file.id ??
    file.fileAssetId ??
    'File';
  const meta = file.workspacePath ?? file.mimeType;

  return (
    <div
      data-slot="workspace-file-reference"
      className="flex min-w-0 items-start gap-2 rounded-md bg-muted px-2 py-1 text-foreground"
      title={label}
    >
      <FileText className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm">{label}</div>
        {meta ? (
          <div className="truncate text-xs text-muted-foreground">{meta}</div>
        ) : null}
      </div>
      <button
        type="button"
        onClick={onRemove}
        className="ml-1 rounded-full p-0.5 hover:bg-muted-foreground/20"
        title={removeLabel}
        aria-label={removeLabel}
      >
        <X size={12} />
      </button>
    </div>
  );
}
