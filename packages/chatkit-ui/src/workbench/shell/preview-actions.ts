import { createFileChangeReview } from '../file-review/file-change-review';
import type { WorkbenchContextValue } from '../context';
import type { WorkbenchRuntime } from '../WorkbenchRuntime';
import type { WorkbenchPreview } from '../preview/types';

/** Compose native preview entry points; resource-specific authorization stays in their sources. */
export function workbenchPreviewActions({
  enabled,
  authenticated,
  stream,
  openPreview,
  removePreview,
  activeViewKey,
  setActiveViewKey,
  reviewTitle,
}: {
  enabled: boolean;
  authenticated: boolean;
  stream: WorkbenchRuntime;
  openPreview(preview: WorkbenchPreview): void;
  removePreview(key: string): void;
  activeViewKey: string | null;
  setActiveViewKey(key: string | null): void;
  reviewTitle: string;
}): Pick<
  WorkbenchContextValue,
  'openPresentation' | 'closePresentation' | 'openFileReview'
> {
  return {
    openPresentation: enabled && authenticated ? openPreview : undefined,
    closePresentation: (key) => {
      removePreview(key);
      if (activeViewKey === key) setActiveViewKey(null);
    },
    openFileReview: (resource) => {
      if (!enabled || !authenticated || !stream.conversationId) return false;
      openPreview(
        createFileChangeReview(
          stream.client,
          stream.conversationId,
          resource,
          reviewTitle,
          openPreview,
        ),
      );
      return true;
    },
  };
}
