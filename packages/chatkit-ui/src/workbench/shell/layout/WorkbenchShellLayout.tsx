import type * as React from 'react';
import type { useChatkitTranslation } from '../../../i18n/useChatkitTranslation';
import { WorkbenchContext, type WorkbenchContextValue } from '../../context';
import { NativeCloseDialog } from '../../native/NativeCloseDialog';
import type { useNativeWorkbench } from '../../native/useNativeWorkbench';
import { SideChatCloseDialog } from '../../side-chat/SideChatCloseDialog';
import type { useInitialLoading } from '../../useInitialLoading';
import type { useWorkbenchLayout } from '../../useWorkbenchLayout';
import type { useWorkbenchPanelHost } from '../../useWorkbenchPanelHost';
import type { useWorkbenchResize } from '../../useWorkbenchResize';
import { WorkbenchFrame } from './WorkbenchFrame';
import type { SideChatSession } from '../../side-chat/types';
import type { useWorkbenchSideChat } from '../side-chat/useWorkbenchSideChat';
import type { useWorkbenchShellTabs } from '../tabs/useWorkbenchShellTabs';

type WorkbenchShellLayoutProps = Pick<
  ReturnType<typeof useWorkbenchShellTabs>,
  'adjacentTab'
> &
  Pick<ReturnType<typeof useWorkbenchSideChat>, 'confirmCloseSideChat'> & {
    contextValue: WorkbenchContextValue;
    rootRef: React.RefObject<HTMLDivElement | null>;
    isNarrow: boolean;
    workbenchSide: ReturnType<typeof useWorkbenchLayout>['workbenchSide'];
    initialLoading: ReturnType<typeof useInitialLoading>;
    t: ReturnType<typeof useChatkitTranslation>['t'];
    notification: { level: 'success' | 'error'; message: string } | null;
    open: boolean;
    setNotification: React.Dispatch<
      React.SetStateAction<{
        level: 'success' | 'error';
        message: string;
      } | null>
    >;
    resizing: ReturnType<typeof useWorkbenchResize>['resizing'];
    mainChatInWorkbench: boolean;
    chatHost: ReturnType<typeof useWorkbenchPanelHost>;
    chat: React.ReactNode;
    sideChat: SideChatSession | null;
    externalViewOpen: boolean;
    expanded: ReturnType<typeof useWorkbenchLayout>['expanded'];
    containerWidth: number;
    resolvedPanelWidth: ReturnType<
      typeof useWorkbenchLayout
    >['resolvedPanelWidth'];
    startResize: ReturnType<typeof useWorkbenchResize>['startResize'];
    setPanelWidth: ReturnType<typeof useWorkbenchLayout>['setPanelWidth'];
    setExpanded: ReturnType<typeof useWorkbenchLayout>['setExpanded'];
    swapSides: ReturnType<typeof useWorkbenchLayout>['swapSides'];
    panelHost: ReturnType<typeof useWorkbenchPanelHost>;
    setOpen: ReturnType<typeof useWorkbenchLayout>['setOpen'];
    closeWorkbench: () => void;
    panel: React.ReactNode;
    native: ReturnType<typeof useNativeWorkbench>;
    activeViewKey: string | null;
    setActiveViewKey: React.Dispatch<React.SetStateAction<string | null>>;
    sideChatCloseDialogOpen: boolean;
    setSideChatCloseDialogOpen: React.Dispatch<React.SetStateAction<boolean>>;
  };

export function WorkbenchShellLayout({
  contextValue,
  rootRef,
  isNarrow,
  workbenchSide,
  initialLoading,
  t,
  notification,
  open,
  setNotification,
  resizing,
  mainChatInWorkbench,
  chatHost,
  chat,
  sideChat,
  externalViewOpen,
  expanded,
  containerWidth,
  resolvedPanelWidth,
  startResize,
  setPanelWidth,
  setExpanded,
  swapSides,
  panelHost,
  setOpen,
  closeWorkbench,
  panel,
  native,
  activeViewKey,
  adjacentTab,
  setActiveViewKey,
  sideChatCloseDialogOpen,
  setSideChatCloseDialogOpen,
  confirmCloseSideChat,
}: WorkbenchShellLayoutProps) {
  return (
    <WorkbenchContext.Provider value={contextValue}>
      <WorkbenchFrame
        rootRef={rootRef}
        isNarrow={isNarrow}
        containerWidth={containerWidth}
        workbenchSide={workbenchSide}
        initialLoading={initialLoading}
        notification={notification}
        setNotification={setNotification}
        open={open}
        resizing={resizing}
        mainChatInWorkbench={mainChatInWorkbench}
        chatHost={chatHost}
        chat={chat}
        keepPanelMounted={Boolean(sideChat) || externalViewOpen}
        expanded={expanded}
        resolvedPanelWidth={resolvedPanelWidth}
        startResize={startResize}
        setPanelWidth={setPanelWidth}
        setExpanded={setExpanded}
        swapSides={swapSides}
        panelHost={panelHost}
        setOpen={setOpen}
        closeWorkbench={closeWorkbench}
        panel={panel}
      >
        <NativeCloseDialog
          open={Boolean(native.pending)}
          onCancel={() => native.setPending(null)}
          onDiscard={() => {
            const key = native.pending;
            if (!key) return;
            native.discard(key);
            if (activeViewKey === key) {
              const next = adjacentTab(key);
              setActiveViewKey(next);
              if (!next) closeWorkbench();
            }
          }}
          onSave={async () => {
            const key = native.pending;
            if (!key) return;
            if (await native.saveAndClose(key)) {
              if (activeViewKey === key) {
                const next = adjacentTab(key);
                setActiveViewKey(next);
                if (!next) closeWorkbench();
              }
            }
          }}
        />
        <SideChatCloseDialog
          open={sideChatCloseDialogOpen}
          onOpenChange={setSideChatCloseDialogOpen}
          onConfirm={confirmCloseSideChat}
        />
      </WorkbenchFrame>
    </WorkbenchContext.Provider>
  );
}
