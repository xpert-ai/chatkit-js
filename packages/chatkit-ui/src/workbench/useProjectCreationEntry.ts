import * as React from 'react';
import type {
  XpertExtensionViewManifest,
  XpertViewQuery,
} from '@xpert-ai/xpert-sdk';
import type { ProjectCreationEntry } from '../components/chat/ProjectCreationChat';

export type ProjectCreationNavigation = {
  id: number;
  entry: ProjectCreationEntry;
};

/** Wait for the old conversation/project scope to clear before opening a new form. */
export function useProjectCreationEntry({
  request,
  ready,
  projectId,
  conversationId,
  views,
  openView,
  onUnavailable,
}: {
  request?: ProjectCreationNavigation;
  ready: boolean;
  projectId?: string | null;
  conversationId?: string | null;
  views: XpertExtensionViewManifest[];
  openView: (key: string, query: XpertViewQuery) => void;
  onUnavailable: () => void;
}) {
  const applied = React.useRef<ProjectCreationNavigation | null>(null);
  React.useEffect(() => {
    if (
      !request ||
      applied.current === request ||
      !ready ||
      projectId ||
      conversationId
    )
      return;
    applied.current = request;
    const { entry } = request;
    if (!views.some((view) => view.key === entry.viewKey)) {
      onUnavailable();
      return;
    }
    // Replace the old selection/query; never merge the previous project's state.
    openView(entry.viewKey, { selectionId: entry.selectionId });
  }, [
    request,
    ready,
    projectId,
    conversationId,
    views,
    openView,
    onUnavailable,
  ]);
}
