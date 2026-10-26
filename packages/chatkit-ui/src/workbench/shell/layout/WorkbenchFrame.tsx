import type * as React from 'react';
import { createPortal } from 'react-dom';
import { WorkbenchLoadingIndicator } from './WorkbenchLoadingIndicator';
import { WorkbenchNotifications } from './WorkbenchNotifications';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from '../../../components/ui/sheet';
import { useChatkitTranslation } from '../../../i18n/useChatkitTranslation';
import { cn } from '../../../lib/utils';
import type { useWorkbenchLayout } from '../../useWorkbenchLayout';
import type { useWorkbenchPanelHost } from '../../useWorkbenchPanelHost';
import type { useWorkbenchResize } from '../../useWorkbenchResize';
import { WorkbenchDivider } from '../../WorkbenchDivider';
import { useWorkbenchChat } from '../../floating-chat/context';

export const WORKBENCH_NARROW_BREAKPOINT = 960;

type WorkbenchFrameProps = Pick<
  ReturnType<typeof useWorkbenchLayout>,
  | 'workbenchSide'
  | 'expanded'
  | 'resolvedPanelWidth'
  | 'setPanelWidth'
  | 'setExpanded'
  | 'swapSides'
  | 'setOpen'
> &
  Pick<ReturnType<typeof useWorkbenchResize>, 'resizing' | 'startResize'> & {
    rootRef: React.RefObject<HTMLDivElement | null>;
    isNarrow: boolean;
    containerWidth: number;
    open: boolean;
    mainChatInWorkbench: boolean;
    chatHost: ReturnType<typeof useWorkbenchPanelHost>;
    panelHost: ReturnType<typeof useWorkbenchPanelHost>;
    chat: React.ReactNode;
    panel: React.ReactNode;
    closeWorkbench: () => void;
    keepPanelMounted?: boolean;
    initialLoading?: boolean;
    notification?: { level: 'success' | 'error'; message: string } | null;
    setNotification?: (value: null) => void;
    children?: React.ReactNode;
  };

/** Shared desktop split, mobile drawer and stable portal hosts for every Chat. */
export function WorkbenchFrame({
  rootRef,
  isNarrow,
  containerWidth,
  workbenchSide,
  open,
  expanded,
  resolvedPanelWidth,
  setPanelWidth,
  setExpanded,
  swapSides,
  setOpen,
  resizing,
  startResize,
  mainChatInWorkbench,
  chatHost,
  panelHost,
  chat,
  panel,
  closeWorkbench,
  keepPanelMounted = false,
  initialLoading = false,
  notification,
  setNotification,
  children,
}: WorkbenchFrameProps) {
  const { t } = useChatkitTranslation();
  const floatingChat = useWorkbenchChat();
  return (
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
      <WorkbenchLoadingIndicator pending={initialLoading} />
      <WorkbenchNotifications notification={notification} onClear={() => setNotification?.(null)} />
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

      {(open || keepPanelMounted) && !isNarrow && (
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
          onEscapeKeyDown={(event) => {
            if (
              event.target instanceof Element &&
              event.target.closest('.chatkit-floating-chat-layer')
            ) {
              event.preventDefault();
              if (floatingChat?.mode !== 'minimized')
                floatingChat?.setMode(
                  floatingChat.mode === 'expanded' ? 'compact' : 'minimized',
                );
            }
          }}
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
        (open || keepPanelMounted) &&
        createPortal(panel, panelHost.container)}
      {chatHost.container && createPortal(chat, chatHost.container)}
      {children}
    </div>
  );
}
