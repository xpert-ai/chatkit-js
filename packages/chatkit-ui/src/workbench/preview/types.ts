import type { ChatKitQuoteReference } from '@xpert-ai/chatkit-types';
import type { WorkbenchOpenFile } from '@xpert-ai/xpert-sdk';
import type { FilePreviewSource } from '../../components/file-preview/types';
import type { FileChangeReviewOptions } from '../file-review/types';

type PreviewIdentity = { key: string; title: string };

export type UrlWorkbenchPreview = PreviewIdentity & {
  kind: 'file' | 'browser';
  url: string;
  file?: WorkbenchOpenFile;
};
export type ResourceFileWorkbenchPreview = PreviewIdentity & {
  kind: 'resource-file';
  source: FilePreviewSource;
};
export type SnapshotWorkbenchPreview = PreviewIdentity & {
  kind: 'snapshot';
  snapshot: { path: string; text: string };
};
export type ReviewWorkbenchPreview = PreviewIdentity & {
  kind: 'review';
  review: FileChangeReviewOptions;
};
export type HtmlWorkbenchPreview = PreviewIdentity & {
  kind: 'html';
  html: {
    load: (signal: AbortSignal) => Promise<{ blob: Blob; name: string }>;
    identity?: { artifactId: string; artifactVersionId: string };
    onAnnotate?: (reference: ChatKitQuoteReference) => Promise<void>;
  };
};

/** Each source selects exactly one renderer; no optional-field precedence. */
export type WorkbenchPreview =
  | UrlWorkbenchPreview
  | ResourceFileWorkbenchPreview
  | SnapshotWorkbenchPreview
  | ReviewWorkbenchPreview
  | HtmlWorkbenchPreview;
