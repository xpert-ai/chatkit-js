import { FilePreviewBody } from '../../../components/file-preview/FilePreviewBody';
import { useFilePreviewContent } from '../../../components/file-preview/useFilePreviewContent';
import * as React from 'react';
import type {
  Client,
  WorkspaceFileScope,
  XpertWorkspaceFile,
} from '@xpert-ai/xpert-sdk';
import { File, Folders, Loader2 } from 'lucide-react';
import { useChatkitTranslation } from '../../../i18n/useChatkitTranslation';
import { fileName, previewKind } from './workspace-file-utils';

export type WorkspaceFileTextContent = { filePath: string; text: string };

export function WorkspaceFilePreview({
  client,
  scope,
  file,
  source,
  revision,
  onTextContent,
}: {
  client: Client;
  scope: WorkspaceFileScope;
  file: XpertWorkspaceFile | null;
  source: boolean;
  revision: number;
  onTextContent?: (content: WorkspaceFileTextContent | null) => void;
}) {
  const { t } = useChatkitTranslation();
  const kind = file ? previewKind(file) : 'unsupported';
  const textFile = ['text', 'markdown', 'html'].includes(kind);
  const scopeKey = JSON.stringify(scope);
  const load = React.useCallback(
    async (signal: AbortSignal) => {
      if (!file) throw new Error('No file selected');
      const max = (textFile ? 5 : 50) * 1024 * 1024;
      if ((file.size ?? 0) > max) throw new Error(t('workbench.files.large'));
      const blob = await client.workbench.downloadFile(scope, file.filePath, {
        signal,
      });
      signal.throwIfAborted();
      if (blob.size > max) throw new Error(t('workbench.files.large'));
      return {
        blob: new Blob([blob], { type: file.mimeType || blob.type }),
        fileName: file.filePath,
      };
    },
    [client, scopeKey, file?.filePath, file?.size, file?.mimeType, textFile, t],
  );
  const { content, error, retry } = useFilePreviewContent(
    file && kind !== 'unsupported' ? load : null,
    revision,
  );
  React.useEffect(() => {
    onTextContent?.(
      content && textFile
        ? { filePath: content.fileName, text: content.text }
        : null,
    );
    return () => onTextContent?.(null);
  }, [content, textFile, onTextContent]);
  if (!file)
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
        <Folders
          size={32}
          strokeWidth={1.5}
          className="mb-1 text-muted-foreground"
        />
        <h2 className="text-lg font-medium">{t('workbench.files.openFile')}</h2>
        <p className="text-sm text-muted-foreground">
          {t('workbench.files.selectHint')}
        </p>
      </div>
    );
  if (error)
    return (
      <div
        role="alert"
        className="flex h-full flex-col items-center justify-center gap-3 p-6 text-sm"
      >
        <p className="text-destructive">
          {error.message === 'workbench.files.binary'
            ? t('workbench.files.binary')
            : error.message}
        </p>
        <button
          className="rounded-[var(--chat-item-radius,var(--radius))] border px-3 py-1.5 hover:bg-muted"
          onClick={retry}
        >
          {t('workbench.files.retry')}
        </button>
      </div>
    );
  if (kind === 'unsupported')
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center text-sm text-muted-foreground">
        <File size={32} />
        <p>{t('workbench.files.unsupported')}</p>
      </div>
    );
  if (!content)
    return (
      <div
        role="status"
        className="flex h-full items-center justify-center gap-2 text-sm text-muted-foreground"
      >
        <Loader2 size={16} className="animate-spin" />
        {t('workbench.files.loading')}
      </div>
    );
  return (
    <FilePreviewBody
      content={content}
      title={fileName(file.filePath)}
      source={source}
    />
  );
}
