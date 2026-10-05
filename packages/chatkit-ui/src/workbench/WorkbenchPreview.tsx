import * as React from 'react';
import { ReviewFileContent } from './file-review/ReviewFileContent';
import { HtmlArtifactPreview } from './html-preview/HtmlArtifactPreview';
import { File, Globe, FileDiff } from 'lucide-react';
import { useChatkitTranslation } from '../i18n/useChatkitTranslation';
import { WorkbenchTab } from './WorkbenchTab';
import type { WorkbenchPreview } from './client-command-payload';
import { UrlPreviewContent } from './url-preview/UrlPreviewContent';

const FileChangeReview = React.lazy(() =>
  import('./file-review/FileChangeReview').then((module) => ({
    default: module.FileChangeReview,
  })),
);

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
      icon={
        preview.kind === 'review' ? (
          <FileDiff size={16} />
        ) : preview.kind === 'file' ? (
          <File size={16} />
        ) : (
          <Globe size={16} />
        )
      }
      close={{
        label: `${t('workbench.close')}: ${preview.title}`,
        onClick: () => onClose(preview.key),
      }}
    />
  ));
}

export function WorkbenchPreviewContent(props: {
  preview: WorkbenchPreview;
  toolbar?: React.ReactNode;
  reloadKey?: number;
}) {
  const { t } = useChatkitTranslation();
  if (props.preview.snapshot)
    return <ReviewFileContent {...props.preview.snapshot} />;
  if (props.preview.kind === 'review' && props.preview.review)
    return (
      <React.Suspense
        fallback={<p className="p-4 text-sm">{t('workbench.loading')}</p>}
      >
        <FileChangeReview options={props.preview.review} />
      </React.Suspense>
    );
  if (props.preview.kind === 'html' && props.preview.html)
    return (
      <HtmlArtifactPreview
        title={props.preview.title}
        load={props.preview.html.load}
        identity={props.preview.html.identity}
        onAnnotate={props.preview.html.onAnnotate}
      />
    );
  return <UrlPreviewContent {...props} />;
}
