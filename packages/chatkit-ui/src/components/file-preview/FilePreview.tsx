import * as React from 'react';
import { Download, Loader2 } from 'lucide-react';
import { useChatkitTranslation } from '../../i18n/useChatkitTranslation';
import type { FilePreviewSource } from './types';
import { FilePreviewBody } from './FilePreviewBody';
import { useFilePreviewContent } from './useFilePreviewContent';

/** Scoped provider bytes stay local to this tab; downloading always uses the original file. */
export function FilePreview({
  file,
  title,
}: {
  file: FilePreviewSource;
  title: string;
}) {
  const { t } = useChatkitTranslation();
  const { content, error, retry, fail } = useFilePreviewContent(file.load);
  const [downloading, setDownloading] = React.useState(false);
  const [downloadError, setDownloadError] = React.useState(false);
  const pending = React.useRef(false);
  const download = async () => {
    if (pending.current) return;
    pending.current = true;
    setDownloading(true);
    setDownloadError(false);
    try {
      await file.download();
    } catch {
      setDownloadError(true);
    } finally {
      pending.current = false;
      setDownloading(false);
    }
  };
  return (
    <section className="flex h-full min-h-0 flex-col" aria-label={title}>
      <div className="flex shrink-0 items-center gap-2 border-b p-3">
        <span className="min-w-0 flex-1 truncate text-sm">{title}</span>
        <button
          type="button"
          onClick={() => void download()}
          disabled={downloading}
          className="flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm hover:bg-muted disabled:opacity-50"
        >
          {downloading ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Download className="size-4" />
          )}
          {t('workbench.files.download')}
        </button>
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
          <button
            type="button"
            onClick={retry}
            className="rounded-md border px-3 py-1.5 hover:bg-muted"
          >
            {t('workbench.files.retry')}
          </button>
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
