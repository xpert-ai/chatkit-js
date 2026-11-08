import type { ChatKitQuoteReference } from '@xpert-ai/chatkit-types';
import type { WorkbenchOpenFile } from '@xpert-ai/xpert-sdk';
import type { FilePreviewSource } from '../../components/file-preview/types';
import type { FileChangeReviewOptions } from '../file-review/types';

import type { PresentationSource } from '../presentation/source';

/** A resource presentation rendered through its authorized source in a Workbench tab. */
export type PresentationWorkbenchPreview = {
  /** Selects the generic presentation renderer; it conveys no resource permissions. */
  kind: 'presentation';
  /** Stable tab identity including its authorization scope, not just a resource ID. */
  key: string;
  /** Display label only; never used to resolve a resource or infer its type. */
  title: string;
  /** Owns credential binding and permission checks for every read and query. */
  source: PresentationSource;
};

type PreviewIdentity = { key: string; title: string; edit?: () => void };

export type UrlWorkbenchPreview = PreviewIdentity & {
  kind: 'file' | 'browser';
  url: string;
  file?: WorkbenchOpenFile;
};
export type ResourceFileWorkbenchPreview = PreviewIdentity & {
  kind: 'resource-file';
  savedVersion?: boolean;
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
  | PresentationWorkbenchPreview
  | UrlWorkbenchPreview
  | ResourceFileWorkbenchPreview
  | SnapshotWorkbenchPreview
  | ReviewWorkbenchPreview
  | HtmlWorkbenchPreview;
