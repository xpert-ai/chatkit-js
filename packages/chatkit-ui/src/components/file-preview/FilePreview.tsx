import * as React from 'react';
import { Download, Loader2, Pencil } from 'lucide-react';
import { useChatkitTranslation } from '../../i18n/useChatkitTranslation';
import type { FilePreviewSource } from './types';
import { FilePreviewBody } from './FilePreviewBody';
import { useFilePreviewContent } from './useFilePreviewContent';
import { Button } from '../ui/button';

/** Scoped provider bytes stay local to this tab; downloading always uses the original file. */
export function FilePreview({
  file,
  title,
  onEdit,
  savedVersion,
}: {
  file: FilePreviewSource;
  title: string;
  onEdit?: () => void;
  savedVersion?: boolean;
}) {
  const { t } = useChatkitTranslation();
  const { content, error, retry, fail } = useFilePreviewContent(file.load);
  const [downloading, setDownloading] = React.useState(false);
  const [downloadError, setDownloadError] = React.useState(false);
  const pending = React.useRef(false);
  const controller = React.useRef<AbortController | null>(null);
  React.useEffect(() => () => controller.current?.abort(), [file]);
  const download = async () => {
    if (pending.current) return;
    pending.current = true;
    setDownloading(true);
    setDownloadError(false);
    const abort = new AbortController();
    controller.current = abort;
    try {
      await file.download(abort.signal);
    } catch {
      if (!abort.signal.aborted) setDownloadError(true);
    } finally {
      pending.current = false;
      if (!abort.signal.aborted) setDownloading(false);
    }
  };
  return (
    <section className="flex h-full min-h-0 flex-col" aria-label={title}>
      <div className="file-preview-toolbar flex shrink-0 flex-wrap items-center gap-2 border-b p-3">
        <span className="min-w-0 flex-1 truncate text-sm">{title}</span>
        {savedVersion && (
          <span className="text-xs text-muted-foreground">
            {t('fileActivity.savedVersion')}
          </span>
        )}
        {onEdit && (
          <Button
            size="sm"
            variant="outline"
            className="rounded-chat-item"
            onClick={onEdit}
          >
            <Pencil className="size-4" />
            {t('workbench.files.editWorkspace')}
          </Button>
        )}
        <Button
          size="sm"
          variant="outline"
          className="rounded-chat-item"
          type="button"
          onClick={() => void download()}
          disabled={downloading}
        >
          {downloading ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Download className="size-4" />
          )}
          {t('workbench.files.download')}
        </Button>
      </div>
      {downloadError && (
        <p role="alert" className="p-3 text-sm text-destructive">
          {t('workbench.files.failed')}
        </p>
      )}
      {error ? (
        <div
          role="alert"
          className="flex flex-1 flex-col items-center justify-center gap-3 p-4 text-sm"
        >
          <p>{t('workbench.files.failed')}</p>
          <Button size="sm" variant="outline" type="button" onClick={retry}>
            {t('workbench.files.retry')}
          </Button>
        </div>
      ) : !content ? (
        <div role="status" className="grid flex-1 place-items-center">
          <Loader2
            className="size-5 animate-spin"
            aria-label={t('workbench.loading')}
          />
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-auto">
          <FilePreviewBody content={content} title={title} onError={fail} />
        </div>
      )}
    </section>
  );
}
