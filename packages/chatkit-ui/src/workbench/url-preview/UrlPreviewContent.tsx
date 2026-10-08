import type * as React from 'react';
import { ExternalLink } from 'lucide-react';
import { useChatkitTranslation } from '../../i18n/useChatkitTranslation';
import type { UrlWorkbenchPreview } from '../preview/types';

export function UrlPreviewContent({
  preview,
  toolbar,
  reloadKey,
}: {
  preview: UrlWorkbenchPreview;
  toolbar?: React.ReactNode;
  reloadKey?: number;
}) {
  const { t } = useChatkitTranslation();
  const page = preview.file?.evidence?.locator?.page;
  const url = new URL(preview.url);
  if (page) url.hash = `page=${page}`;
  return (
    <section
      className="flex h-full min-h-0 flex-col"
      aria-label={preview.title}
    >
      {toolbar ?? (
        <div className="flex shrink-0 items-center gap-2 border-y px-3 py-2 text-xs text-muted-foreground">
          <span className="min-w-0 flex-1 truncate" title={preview.url}>
            {preview.title}
          </span>
          <a
            href={url.href}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 rounded-md px-2 py-1 hover:bg-muted"
          >
            <ExternalLink size={14} />
            {t('workbench.preview.openExternal')}
          </a>
        </div>
      )}
      {preview.file?.evidence && (
        <div className="max-h-32 shrink-0 overflow-auto border-b px-3 py-2 text-sm">
          <p className="text-xs font-medium text-muted-foreground">
            {t('workbench.preview.evidence')}
            {page ? ` · ${t('workbench.preview.page', { page })}` : ''}
          </p>
          <p className="whitespace-pre-wrap">
            {preview.file.evidence.text ?? preview.file.evidence.displayValue}
          </p>
        </div>
      )}
      {preview.file?.mimeType?.startsWith('image/') ? (
        <div className="min-h-0 flex-1 overflow-auto p-3">
          <img
            className="mx-auto max-w-full"
            src={url.href}
            alt={preview.title}
            referrerPolicy="no-referrer"
          />
        </div>
      ) : (
        <iframe
          key={reloadKey}
          title={preview.title}
          src={url.href}
          sandbox="allow-scripts allow-forms allow-downloads"
          referrerPolicy="no-referrer"
          className="min-h-0 w-full flex-1 border-0 bg-background"
        />
      )}
    </section>
  );
}
