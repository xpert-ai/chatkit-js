import { contentTabKey } from '../content/tab-identity';
import { resolveContentEntry } from '../content/entry-navigation';
import type { ContentClient, ContentScope } from '@xpert-ai/xpert-sdk';
import type { EditorLifecycle } from '../editors/editor-lifecycle';
import * as React from 'react';
import type {
  XpertExtensionViewManifest,
  XpertViewQuery,
  XpertViewRuntimeScopeInput,
} from '@xpert-ai/xpert-sdk';
import { useChatkitTranslation } from '../../i18n/useChatkitTranslation';
import { parseNavigation } from '../client-command-payload';
import { useProjectCreationEntry } from '../useProjectCreationEntry';
import type { WorkbenchShellProps } from './types';

type EntryNavigationOptions = Pick<
  WorkbenchShellProps,
  'initialNavigation' | 'projectCreation'
> & {
  contentApi?: ContentClient;
  contentScope?: ContentScope;
  editors?: EditorLifecycle;
  ready: boolean;
  runtimeScopeReady: boolean;
  runtimeScope: XpertViewRuntimeScopeInput;
  views: XpertExtensionViewManifest[];
  setViewQueries: React.Dispatch<
    React.SetStateAction<Record<string, XpertViewQuery>>
  >;
  setViewResetKeys: React.Dispatch<
    React.SetStateAction<Record<string, number>>
  >;
  selectView: (key: string) => void;
  setOpen: (open: boolean) => void;
  setExpanded: (expanded: boolean) => void;
  setNotification: (notification: { level: 'error'; message: string }) => void;
};

/** Apply explicit navigation only after the destination scope's views have loaded. */
export function useWorkbenchEntryNavigation({
  editors,
  contentApi,
  contentScope,
  initialNavigation,
  projectCreation,
  ready,
  runtimeScopeReady,
  runtimeScope,
  views,
  setViewQueries,
  setViewResetKeys,
  selectView,
  setOpen,
  setExpanded,
  setNotification,
}: EntryNavigationOptions) {
  const { t } = useChatkitTranslation();
  React.useEffect(() => {
    if (!initialNavigation || !ready || !runtimeScopeReady) return;
    const navigation = parseNavigation(initialNavigation.payload);
    if (
      navigation.target === 'assistant.conversation' &&
      !navigation.preserveView
    ) {
      setExpanded(false);
      setOpen(false);
    }
    let cancelled = false;
    void (async () => {
      const resolved = contentApi && contentScope
        ? await resolveContentEntry(navigation, contentApi, contentScope) : navigation;
      if (cancelled) return;
      if (!resolved.viewKey || !views.some((view) => view.key === resolved.viewKey)) return;
      const viewKey = contentTabKey(resolved.viewKey, resolved.query);
      if (editors?.isDirty(viewKey) && !(await editors.prepare(viewKey))) {
        if (!cancelled) setNotification({ level: 'error', message: t('contentReview.Unsaved') });
        return;
      }
      if (cancelled) return;
      if (!resolved.preserveView || Object.keys(resolved.query).length > 0)
        setViewQueries((current) => ({ ...current, [viewKey]: resolved.query }));
      selectView(viewKey);
      setOpen(true);
    })().catch(() => {
      if (!cancelled) setNotification({ level: 'error', message: t('workbench.loadFailed') });
    });
    return () => { cancelled = true; };
  }, [
    editors,
    initialNavigation,
    contentApi,
    contentScope?.projectId,
    contentScope?.assistantId,
    ready,
    runtimeScopeReady,
    views,
    selectView,
    setOpen,
    setExpanded,
    setViewQueries,
  ]);

  useProjectCreationEntry({
    request: projectCreation,
    ready: ready && runtimeScopeReady,
    projectId: runtimeScope.projectId,
    conversationId: runtimeScope.conversationId,
    views,
    openView: (key, query) => {
      setViewQueries((current) => ({ ...current, [key]: query }));
      // A cached iframe may still own the previous project's form state.
      setViewResetKeys((current) => ({
        ...current,
        [key]: (current[key] ?? 0) + 1,
      }));
      selectView(key);
      setExpanded(false);
      setOpen(true);
    },
    onUnavailable: () =>
      setNotification({
        level: 'error',
        message: t('composer.projects.creationViewUnavailable'),
      }),
  });
}
