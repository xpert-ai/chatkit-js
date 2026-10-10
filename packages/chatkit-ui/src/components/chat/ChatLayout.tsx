import type { ComponentProps, CSSProperties, ReactNode, Ref } from 'react';
import { cn } from '../../lib/utils';
import { UploadDroppedFiles } from './upload-dropped-files';

type ChatLayoutProps = ComponentProps<typeof UploadDroppedFiles> & {
  viewportRef?: Ref<HTMLDivElement>;
  taskSummaryDocked?: boolean;
  overlay?: ReactNode;
  conversationKind?: 'group';
};

/** One chat viewport for both conversation transports; credentials stay in their adapters. */
export function ChatLayout({
  viewportRef,
  taskSummaryDocked,
  overlay,
  conversationKind,
  className,
  children,
  ...dropProps
}: ChatLayoutProps) {
  return (
    <div
      className="relative flex h-full w-full min-w-0 bg-background"
      data-task-summary-layout={taskSummaryDocked ? 'docked' : 'popover'}
      data-conversation-kind={conversationKind}
    >
      <UploadDroppedFiles
        {...dropProps}
        ref={viewportRef}
        data-chatkit-root=""
        className={cn(
          'relative flex h-full w-full min-w-0 flex-col flex-1 overflow-x-hidden overflow-y-auto bg-background shadow-sm transition-[box-shadow] duration-150',
          className,
        )}
      >
        {children}
      </UploadDroppedFiles>
      {overlay}
    </div>
  );
}

export function ChatComposerDock({
  initial = false,
  style,
  children,
}: {
  initial?: boolean;
  style?: CSSProperties;
  children: ReactNode;
}) {
  return (
    <div
      data-slot="chatkit-chat-composer"
      data-position={initial ? 'centered' : 'bottom'}
      className={cn(
        'mx-auto w-full max-w-2xl px-4 pb-4 pt-2 z-10 bg-background',
        initial ? 'mb-auto' : 'sticky bottom-0',
      )}
      style={style}
    >
      {children}
    </div>
  );
}
