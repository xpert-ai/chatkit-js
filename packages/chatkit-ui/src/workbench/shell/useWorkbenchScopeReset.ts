import * as React from 'react';
import type {
  XpertExtensionViewManifest,
  XpertRemoteViewHostEventMessage,
  XpertViewQuery,
} from '@xpert-ai/xpert-sdk';
import type { WorkbenchAssistantContext } from './types';

/** Conversation revalidation invalidates execution context, not workspace navigation. */
export function useWorkbenchScopeReset({
  workspaceScope,
  runtimeScope,
  views,
  contexts,
  onRequestContextChange,
  setViewQueries,
  setNotification,
  setHostEvent,
  tabKeys,
  setActiveViewKey,
}: {
  workspaceScope: string;
  runtimeScope: string;
  tabKeys: string[];
  setActiveViewKey: React.Dispatch<React.SetStateAction<string | null>>;
  views: XpertExtensionViewManifest[];
  contexts: React.RefObject<Map<string, WorkbenchAssistantContext>>;
  onRequestContextChange: (context: Record<string, unknown>) => void;
  setViewQueries: React.Dispatch<
    React.SetStateAction<Record<string, XpertViewQuery>>
  >;
  setNotification: React.Dispatch<
    React.SetStateAction<{
      level: 'success' | 'error';
      message: string;
    } | null>
  >;
  setHostEvent: React.Dispatch<
    React.SetStateAction<XpertRemoteViewHostEventMessage | null>
  >;
}) {
  const previous = React.useRef({ workspaceScope, runtimeScope });
  React.useEffect(() => {
    const workspaceChanged = previous.current.workspaceScope !== workspaceScope;
    const runtimeChanged = previous.current.runtimeScope !== runtimeScope;
    previous.current = { workspaceScope, runtimeScope };
    if (!workspaceChanged && !runtimeChanged) return;

    setActiveViewKey((current) =>
      current && tabKeys.includes(current) ? current : null,
    );

    setViewQueries((current) => {
      if (workspaceChanged) return {};
      const conversationViews = new Set(
        views
          .filter((view) => {
            // Newer hosts expose contextScope before it is typed by every SDK version.
            const options = view.workbench;
            return (
              options &&
              'contextScope' in options &&
              options.contextScope === 'conversation'
            );
          })
          .map((view) => view.key),
      );
      const entries = Object.entries(current);
      const retained = entries.filter(([key]) => !conversationViews.has(key));
      return retained.length === entries.length
        ? current
        : Object.fromEntries(retained);
    });
    setNotification(null);
    setHostEvent(null);
    contexts.current.clear();
    onRequestContextChange({});
  }, [
    workspaceScope,
    runtimeScope,
    views,
    contexts,
    onRequestContextChange,
    setViewQueries,
    setNotification,
    setHostEvent,
    tabKeys,
    setActiveViewKey,
  ]);
}
