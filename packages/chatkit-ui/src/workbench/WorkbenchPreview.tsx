import * as React from 'react';
import { ExternalLink, File, Globe } from 'lucide-react';
import { useChatkitTranslation } from '../i18n/useChatkitTranslation';
import { WorkbenchTab } from './WorkbenchTab';
import type { WorkbenchPreview } from './client-command-payload';
import {
  WorkbenchAddressBar,
  type BrowserNavigation,
} from './WorkbenchAddressBar';
import type { RecentWorkbenchPreview } from './useWorkbenchPages';

export function WorkbenchBrowserPreview({
  preview,
  recent,
  navigation,
  apiUrl,
  onNavigate,
}: {
  preview: WorkbenchPreview;
  recent: RecentWorkbenchPreview[];
  navigation: BrowserNavigation;
  apiUrl: string;
  onNavigate: (preview: WorkbenchPreview) => void;
}) {
  const [value, setValue] = React.useState(preview.url);
  const [revision, reload] = React.useReducer((version) => version + 1, 0);
  React.useEffect(() => setValue(preview.url), [preview.url]);
  const navigate = (next: WorkbenchPreview) => {
    setValue(next.url);
    if (next.url === preview.url) reload();
    else onNavigate(next);
  };
  return (
    <WorkbenchPreviewContent
      preview={preview}
      reloadKey={revision}
      toolbar={
        <WorkbenchAddressBar
          value={value}
          onChange={setValue}
          currentUrl={preview.url}
          apiUrl={apiUrl}
          navigation={navigation}
          onReload={reload}
          onOpen={navigate}
          suggestions={recent
            .filter(({ preview }) => preview.kind === 'browser')
            .map(({ preview }) => ({
              key: preview.key,
              title: preview.title,
              detail: preview.url,
              history: true,
              onSelect: () => navigate(preview),
            }))}
        />
      }
    />
  );
}

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
    <WorkbenchTab
      key={preview.key}
      label={preview.title}
      selected={activeKey === preview.key}
      onSelect={() => onSelect(preview.key)}
      icon={preview.kind === 'file' ? <File size={16} /> : <Globe size={16} />}
      close={{
        label: `${t('workbench.close')}: ${preview.title}`,
        onClick: () => onClose(preview.key),
      }}
    />
  ));
}

export function WorkbenchPreviewContent({
  preview,
  toolbar,
  reloadKey,
}: {
  preview: WorkbenchPreview;
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
