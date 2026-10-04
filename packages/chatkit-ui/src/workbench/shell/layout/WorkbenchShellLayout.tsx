import { Loader2 } from 'lucide-react';
import type * as React from 'react';
import { createPortal } from 'react-dom';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from '../../../components/ui/sheet';
import type { useChatkitTranslation } from '../../../i18n/useChatkitTranslation';
import { cn } from '../../../lib/utils';
import { WorkbenchContext, type WorkbenchContextValue } from '../../context';
import { NativeCloseDialog } from '../../native/NativeCloseDialog';
import type { useNativeWorkbench } from '../../native/useNativeWorkbench';
import { SideChatCloseDialog } from '../../side-chat/SideChatCloseDialog';
import type { useInitialLoading } from '../../useInitialLoading';
import type { useWorkbenchLayout } from '../../useWorkbenchLayout';
import type { useWorkbenchPanelHost } from '../../useWorkbenchPanelHost';
import type { useWorkbenchResize } from '../../useWorkbenchResize';
import { WorkbenchDivider } from '../../WorkbenchDivider';
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
      <div
        ref={rootRef}
        className={cn(
          'relative flex h-full min-h-0 w-full overflow-hidden bg-background',
          !isNarrow && workbenchSide === 'left' && 'flex-row-reverse',
        )}
        data-workbench-side={workbenchSide}
        data-chatkit-workbench-root=""
        aria-busy={initialLoading}
      >
        {initialLoading && (
          <div
            role="status"
            className="absolute inset-0 z-50 flex items-center justify-center gap-2 bg-background text-sm text-muted-foreground"
          >
            <Loader2 size={16} className="animate-spin" />
            {t('message.loading')}
          </div>
        )}
        {notification && !open && (
          <div
            role="alert"
            className="absolute inset-x-4 bottom-4 z-50 flex items-center gap-3 rounded-lg border bg-background p-3 text-sm shadow-lg"
          >
            <span className="flex-1">{notification.message}</span>
            <button
              type="button"
              aria-label={t('workbench.close')}
              className="rounded px-2 hover:bg-muted"
              onClick={() => setNotification(null)}
            >
              ×
            </button>
          </div>
        )}
        {resizing && (
          <div
            aria-hidden="true"
            className="fixed inset-0 z-[100] cursor-col-resize select-none"
          />
        )}
        <div
          ref={mainChatInWorkbench ? undefined : chatHost.attach}
          hidden={mainChatInWorkbench}
          className={cn('flex min-w-0 flex-1', mainChatInWorkbench && 'hidden')}
        >
          {!chatHost.container && chat}
        </div>

        {(open || Boolean(sideChat) || externalViewOpen) && !isNarrow && (
          <>
            {open && !expanded && (
              <WorkbenchDivider
                containerWidth={containerWidth}
                panelWidth={resolvedPanelWidth}
                workbenchSide={workbenchSide}
                resizing={resizing}
                onResizeStart={startResize}
                onPanelWidthChange={setPanelWidth}
                onExpand={() => setExpanded(true)}
                onSwap={swapSides}
              />
            )}
            <aside
              hidden={!open}
              className={cn(
                'h-full min-h-0 border-l-0 bg-background',
                !open && 'hidden',
                expanded ? 'min-w-0 flex-1' : 'shrink-0',
              )}
              style={expanded ? undefined : { width: resolvedPanelWidth }}
              aria-label={t('workbench.title')}
            >
              <div ref={panelHost.attach} className="contents" />
            </aside>
          </>
        )}

        <Sheet
          open={open && isNarrow}
          onOpenChange={(nextOpen) => {
            if (nextOpen) {
              setOpen(true);
            } else {
              closeWorkbench();
            }
          }}
        >
          <SheetContent
            side="right"
            showCloseButton={false}
            className={cn(
              'flex h-full max-w-none flex-col gap-0 p-0',
              expanded
                ? 'inset-0 w-full max-w-none border-0 shadow-none sm:max-w-none'
                : 'w-[min(92vw,720px)]',
            )}
          >
            <SheetTitle className="sr-only">{t('workbench.title')}</SheetTitle>
            <SheetDescription className="sr-only">
              {t('workbench.description')}
            </SheetDescription>
            <div ref={panelHost.attach} className="contents" />
          </SheetContent>
        </Sheet>
        {panelHost.container &&
          (open || Boolean(sideChat) || externalViewOpen) &&
          createPortal(panel, panelHost.container)}
        {chatHost.container && createPortal(chat, chatHost.container)}
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
      </div>
    </WorkbenchContext.Provider>
  );
}
