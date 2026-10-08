import * as React from 'react';
import { ReviewFileContent } from '../file-review/ReviewFileContent';
import { HtmlArtifactPreview } from '../html-preview/HtmlArtifactPreview';
import { File, Globe, FileDiff } from 'lucide-react';
import { useChatkitTranslation } from '../../i18n/useChatkitTranslation';
import { WorkbenchTab } from '../WorkbenchTab';
import type { WorkbenchPreview } from './types';
import { UrlPreviewContent } from '../url-preview/UrlPreviewContent';
import { FilePreview } from '../../components/file-preview/FilePreview';

const FileChangeReview = React.lazy(() =>
  import('../file-review/FileChangeReview').then((module) => ({
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
        ) : ['file', 'resource-file', 'snapshot'].includes(preview.kind) ? (
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
  if (props.preview.kind === 'resource-file')
    return (
      <FilePreview
        key={props.preview.key}
        file={props.preview.source}
        title={props.preview.title}
      />
    );
  if (props.preview.kind === 'snapshot')
    return <ReviewFileContent {...props.preview.snapshot} />;
  if (props.preview.kind === 'review')
    return (
      <React.Suspense
        fallback={<p className="p-4 text-sm">{t('workbench.loading')}</p>}
      >
        <FileChangeReview options={props.preview.review} />
      </React.Suspense>
    );
  if (props.preview.kind === 'html')
    return (
      <HtmlArtifactPreview
        title={props.preview.title}
        load={props.preview.html.load}
        identity={props.preview.html.identity}
        onAnnotate={props.preview.html.onAnnotate}
      />
    );
  return (
    <UrlPreviewContent
      preview={props.preview}
      toolbar={props.toolbar}
      reloadKey={props.reloadKey}
    />
  );
}
