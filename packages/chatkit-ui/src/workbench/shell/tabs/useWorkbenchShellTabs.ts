import * as React from 'react';
import { createMessageId } from '../../../lib/utils';
import { EXTERNAL_ASSISTANTS_VIEW_KEY } from '../../external-assistant/external-assistant-runs';
import type { useNativeWorkbench } from '../../native/useNativeWorkbench';
import {
  NEW_TAB_PREFIX,
  type useWorkbenchPages,
} from '../../useWorkbenchPages';
import { useWorkbenchTabOrder } from '../../useWorkbenchTabOrder';
import type { useWorkbenchViews } from '../../useWorkbenchViews';
import type { useWorkbenchViewTabs } from '../../useWorkbenchViewTabs';
import { MAIN_CHAT_VIEW_KEY } from '../../WorkbenchPanel';
import {
  SIDE_CHAT_VIEW_KEY,
  type SideChatSession,
} from '../../side-chat/types';

type WorkbenchShellTabsOptions = {
  native: ReturnType<typeof useNativeWorkbench>;
  externalViewOpen: boolean;
  sideChat: SideChatSession | null;
  sideChatOpening: boolean;
  previews: ReturnType<typeof useWorkbenchPages>['previews'];
  scopedViews: ReturnType<typeof useWorkbenchViewTabs>['scopedViews'];
  newTabs: ReturnType<typeof useWorkbenchPages>['newTabs'];
  startPageScope: string;
  mainChatInWorkbench: boolean;
  activeViewKey: string | null;
  setActiveViewKey: React.Dispatch<React.SetStateAction<string | null>>;
  loading: ReturnType<typeof useWorkbenchViews>['loading'];
  views: ReturnType<typeof useWorkbenchViews>['views'];
  closeNewTab: ReturnType<typeof useWorkbenchPages>['closeNewTab'];
  addNewTab: ReturnType<typeof useWorkbenchPages>['addNewTab'];
  setOpen: (open: boolean) => void;
  fallbackReady: boolean;
};

export function useWorkbenchShellTabs({
  native,
  externalViewOpen,
  sideChat,
  sideChatOpening,
  previews,
  scopedViews,
  newTabs,
  startPageScope,
  mainChatInWorkbench,
  activeViewKey,
  setActiveViewKey,
  loading,
  views,
  closeNewTab,
  addNewTab,
  setOpen,
  fallbackReady,
}: WorkbenchShellTabsOptions) {
  const availableTabKeys = React.useMemo(
    () => [
      ...native.tabs.map((tab) => tab.key),
      ...(externalViewOpen ? [EXTERNAL_ASSISTANTS_VIEW_KEY] : []),
      ...(sideChat || sideChatOpening ? [SIDE_CHAT_VIEW_KEY] : []),
      ...previews.map((preview) => preview.key),
      ...scopedViews.map((view) => view.key),
      ...newTabs,
    ],
    [
      native.tabs,
      externalViewOpen,
      sideChat,
      sideChatOpening,
      previews,
      scopedViews,
      newTabs,
    ],
  );

  const {
    keys: viewTabKeys,
    replace: replaceTab,
    insertBefore: insertTabBefore,
  } = useWorkbenchTabOrder(startPageScope, availableTabKeys);

  const tabKeys = React.useMemo(
    () =>
      mainChatInWorkbench ? [MAIN_CHAT_VIEW_KEY, ...viewTabKeys] : viewTabKeys,
    [mainChatInWorkbench, viewTabKeys],
  );

  const createNewTab = React.useCallback(() => {
    const key = `${NEW_TAB_PREFIX}${createMessageId()}`;
    addNewTab(key);
    setActiveViewKey(key);
    setOpen(true);
  }, [addNewTab, setActiveViewKey, setOpen]);

  // Wait for scope restoration and manifests before choosing the empty-panel fallback.
  React.useEffect(() => {
    if (fallbackReady && tabKeys.length === 0) createNewTab();
  }, [fallbackReady, tabKeys.length, createNewTab]);

  const previousView = React.useRef<{ scope: string; key: string | null }>({
    scope: startPageScope,
    key: null,
  });

  React.useLayoutEffect(() => {
    if (activeViewKey !== MAIN_CHAT_VIEW_KEY) {
      previousView.current = { scope: startPageScope, key: activeViewKey };
    }
    if (!mainChatInWorkbench && activeViewKey === MAIN_CHAT_VIEW_KEY) {
      const previous = previousView.current;
      setActiveViewKey(
        previous.scope === startPageScope &&
          previous.key &&
          viewTabKeys.includes(previous.key)
          ? previous.key
          : (viewTabKeys[0] ?? null),
      );
    } else if (mainChatInWorkbench && !tabKeys.includes(activeViewKey ?? '')) {
      // Restored view tabs can arrive one render after their manifests.
      // Keep that selection instead of treating the pending list as empty.
      const next =
        viewTabKeys[0] ??
        (!loading && views.length === 0 ? MAIN_CHAT_VIEW_KEY : null);
      if (next) setActiveViewKey(next);
    }
  }, [
    mainChatInWorkbench,
    activeViewKey,
    startPageScope,
    viewTabKeys,
    tabKeys,
    loading,
    views.length,
  ]);

  const replaceNewTab = (from: string | undefined, to: string) => {
    if (!from) return;
    replaceTab(from, to);
    closeNewTab(from);
  };

  const adjacentTab = React.useCallback(
    (key: string) => {
      const index = tabKeys.indexOf(key);
      return tabKeys[index - 1] ?? tabKeys[index + 1] ?? null;
    },
    [tabKeys],
  );
  return { tabKeys, adjacentTab, replaceNewTab, insertTabBefore, createNewTab };
}
