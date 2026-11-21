import * as React from 'react';
import { Command as CommandPrimitive } from 'cmdk';
import { Search } from 'lucide-react';
import { cn } from '../../lib/utils';

export function Command({
  className,
  ...props
}: React.ComponentProps<typeof CommandPrimitive>) {
  return (
    <CommandPrimitive
      data-slot="command"
      className={cn(
        'flex size-full flex-col overflow-hidden rounded-md bg-popover text-popover-foreground',
        className,
      )}
      {...props}
    />
  );
}
export function CommandInput({
  className,
  ...props
}: React.ComponentProps<typeof CommandPrimitive.Input>) {
  return (
    <div
      className="flex items-center gap-2 border-b px-3"
      cmdk-input-wrapper=""
    >
      <Search className="size-4 shrink-0 opacity-50" />
      <CommandPrimitive.Input
        className={cn(
          'flex h-10 w-full bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:opacity-50',
          className,
        )}
        {...props}
      />
    </div>
  );
}
export function CommandList({
  className,
  ...props
}: React.ComponentProps<typeof CommandPrimitive.List>) {
  return (
    <CommandPrimitive.List
      className={cn(
        'max-h-60 overflow-y-auto overflow-x-hidden p-1',
        className,
      )}
      {...props}
    />
  );
}
export function CommandEmpty(
  props: React.ComponentProps<typeof CommandPrimitive.Empty>,
) {
  return (
    <CommandPrimitive.Empty
      className="py-6 text-center text-sm text-muted-foreground"
      {...props}
    />
  );
}
export function CommandItem({
  className,
  ...props
}: React.ComponentProps<typeof CommandPrimitive.Item>) {
  return (
    <CommandPrimitive.Item
      className={cn(
        'relative flex cursor-default select-none items-center gap-2 rounded-sm px-2 py-2 text-sm outline-none data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-50 data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground',
        className,
      )}
      {...props}
    />
  );
}
