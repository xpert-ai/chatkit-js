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
    if (!initialNavigation || !ready) return;
    const navigation = parseNavigation(initialNavigation.payload);
    if (
      navigation.target === 'assistant.conversation' &&
      !navigation.preserveView
    ) {
      setExpanded(false);
      setOpen(false);
    }
    const viewKey = navigation.viewKey;
    if (viewKey && views.some((view) => view.key === viewKey)) {
      // Scope changes clear old queries; restore an explicitly requested resource.
      if (!navigation.preserveView || Object.keys(navigation.query).length > 0)
        setViewQueries((current) => ({
          ...current,
          [viewKey]: navigation.query,
        }));
      selectView(viewKey);
      setOpen(true);
    }
  }, [
    initialNavigation,
    ready,
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
