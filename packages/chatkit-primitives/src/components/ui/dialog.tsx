import * as React from 'react';
import { Dialog as DialogPrimitive } from 'radix-ui';
import { X } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Button } from './button';
import { useTheme } from '../../theme';
import { usePrimitiveLabels } from '../../theme';

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;
export function DialogContent({
  className,
  children,
  style,
  layout = 'default',
  closeLabel,
  overlayClassName,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & {
  layout?: 'default' | 'sectioned';
  closeLabel?: string;
  overlayClassName?: string;
}) {
  const context = useTheme({ optional: true });
  const labels = usePrimitiveLabels();
  return (
    <DialogPrimitive.Portal container={context?.portalContainer}>
      <DialogPrimitive.Overlay
        data-slot="dialog-overlay"
        className={cn(
          'fixed inset-0 isolate z-50 bg-foreground/10 duration-100 supports-backdrop-filter:backdrop-blur-xs data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0',
          overlayClassName,
        )}
      />
      <DialogPrimitive.Content
        data-slot="dialog-content"
        style={{
          ...context?.style,
          ...style,
        }}
        data-layout={layout}
        className={cn(
          'fixed left-1/2 top-1/2 z-50 grid max-h-[85dvh] w-[32rem] max-w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 gap-4 overflow-y-auto bg-popover p-(--dialog-padding) text-sm text-popover-foreground ring-1 ring-foreground/10 outline-none rounded-chat-panel [--dialog-padding:calc(1rem*var(--chat-density-scale,1))] duration-100 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95',
          layout === 'sectioned' &&
            'flex flex-col gap-0 overflow-hidden p-0 [&>[data-slot=dialog-header]]:shrink-0 [&>[data-slot=dialog-header]]:p-(--dialog-padding) [&>[data-slot=dialog-header]]:pr-14',
          className,
        )}
        {...props}
      >
        {children}
        <DialogPrimitive.Close asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="absolute right-2 top-2"
            aria-label={closeLabel ?? labels.close}
          >
            <X className="size-4" />
          </Button>
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}
export function DialogHeader({
  className,
  ...props
}: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="dialog-header"
      className={cn('flex flex-col gap-2 pr-6', className)}
      {...props}
    />
  );
}
export function DialogTitle({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      className={cn('text-base font-medium leading-none', className)}
      {...props}
    />
  );
}
export function DialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      className={cn('text-sm text-muted-foreground', className)}
      {...props}
    />
  );
}

export function DialogBody({
  className,
  ...props
}: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="dialog-body"
      className={cn(
        'min-h-0 flex-1 overflow-y-auto px-(--dialog-padding) pb-(--dialog-padding)',
        className,
      )}
      {...props}
    />
  );
}

export function DialogFooter({
  className,
  ...props
}: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn(
        'flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-border bg-muted/50 px-(--dialog-padding) py-2.5',
        className,
      )}
      {...props}
    />
  );
}
