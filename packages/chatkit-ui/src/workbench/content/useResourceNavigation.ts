import * as React from 'react';
import type {
  XpertExtensionViewManifest,
  XpertViewQuery,
} from '@xpert-ai/xpert-sdk';
import { useResourceCardNavigation } from '../resource-cards/useResourceCardNavigation';
import type { EditorLifecycle } from '../editors/editor-lifecycle';

/** History restoration obeys the same editor leave gate as explicit navigation. */
export function useResourceNavigation({
  scope,
  conversationId,
  views,
  enabled,
  ready,
  editors,
  setQueries,
  select,
  setOpen,
  onBlocked,
}: {
  scope: string;
  conversationId?: string | null;
  views: XpertExtensionViewManifest[];
  enabled: boolean;
  ready: boolean;
  editors: EditorLifecycle;
  setQueries: React.Dispatch<
    React.SetStateAction<Record<string, XpertViewQuery>>
  >;
  select: (key: string) => void;
  setOpen: (open: boolean) => void;
  onBlocked: () => void;
}) {
  const current = React.useRef(scope);
  current.current = scope;
  return useResourceCardNavigation({
    scope,
    conversationId,
    enabled,
    ready,
    isConversationScoped: (key) => {
      const options = views.find((view) => view.key === key)?.workbench;
      return Boolean(
        options &&
        'contextScope' in options &&
        options.contextScope === 'conversation',
      );
    },
    restore: (target) => {
      if (
        target.target !== 'workbench.view' ||
        !views.some((view) => view.key === target.viewKey)
      )
        return false;
      const restore = (canLeave: boolean) => {
        if (current.current !== scope) return;
        if (!canLeave) {
          onBlocked();
          return;
        }
        setQueries((value) => ({
          ...value,
          [target.viewKey]: {
            selectionId: target.selectionId,
            parameters: target.parameters,
          },
        }));
        select(target.viewKey);
        setOpen(true);
      };
      if (editors.isDirty(target.viewKey))
        void editors.prepare(target.viewKey).then(restore);
      else restore(true);
      return true;
    },
    close: () => setOpen(false),
  });
}
