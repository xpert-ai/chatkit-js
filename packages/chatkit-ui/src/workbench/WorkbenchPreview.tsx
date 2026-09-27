import { ExternalLink, File, Globe, X } from 'lucide-react';
import { useChatkitTranslation } from '../i18n/useChatkitTranslation';
import { cn } from '../lib/utils';
import type { WorkbenchPreview } from './client-command-payload';

export function PreviewTabs({
  previews,
  activeKey,
  onSelect,
  onClose,
}: {
  previews: WorkbenchPreview[];
  activeKey: string | null;
  onSelect: (key: string) => void;
  onClose: (key: string) => void;
}) {
  const { t } = useChatkitTranslation();
  return previews.map((preview) => (
    <div
      key={preview.key}
      className={cn(
        'flex h-10 max-w-64 shrink-0 items-center rounded-xl',
        activeKey === preview.key
          ? 'bg-muted text-foreground'
          : 'text-muted-foreground hover:bg-muted/60',
      )}
    >
      <button
        type="button"
        role="tab"
        aria-selected={activeKey === preview.key}
        onClick={() => onSelect(preview.key)}
        className="flex h-full min-w-0 items-center gap-2 px-3 text-sm font-medium"
        title={preview.title}
      >
        {preview.kind === 'file' ? (
          <File size={17} className="shrink-0" />
        ) : (
          <Globe size={17} className="shrink-0" />
        )}
        <span className="truncate">{preview.title}</span>
      </button>
      <button
        type="button"
        onClick={() => onClose(preview.key)}
        aria-label={`${t('workbench.close')}: ${preview.title}`}
        className="mr-1.5 rounded-md p-1 text-muted-foreground hover:bg-background/80"
      >
        <X size={15} />
      </button>
    </div>
  ));
}

export function WorkbenchPreviewContent({
  preview,
}: {
  preview: WorkbenchPreview;
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
