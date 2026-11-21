import * as React from 'react';
import { Tabs as Primitive } from 'radix-ui';
import { cn } from '../../lib/utils';

export type TabsProps = React.ComponentProps<typeof Primitive.Root>;
export function Tabs({ className, ...props }: TabsProps) {
  return (
    <Primitive.Root className={cn('w-full min-w-0', className)} {...props} />
  );
}
export const TabsList = React.forwardRef<
  React.ComponentRef<typeof Primitive.List>,
  React.ComponentProps<typeof Primitive.List>
>(({ className, ...props }, ref) => (
  <Primitive.List
    ref={ref}
    className={cn(
      'ck-tabs-list inline-flex max-w-full flex-wrap items-center rounded-chat-item bg-muted text-muted-foreground',
      className,
    )}
    {...props}
  />
));
TabsList.displayName = 'TabsList';
export type TabsTriggerProps = React.ComponentProps<typeof Primitive.Trigger>;
export const TabsTrigger = React.forwardRef<
  React.ComponentRef<typeof Primitive.Trigger>,
  TabsTriggerProps
>(({ className, ...props }, ref) => (
  <Primitive.Trigger
    ref={ref}
    className={cn(
      'ck-tabs-trigger rounded-chat-item text-sm font-medium ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm',
      className,
    )}
    {...props}
  />
));
TabsTrigger.displayName = 'TabsTrigger';
export type TabsContentProps = React.ComponentProps<typeof Primitive.Content>;
export const TabsContent = React.forwardRef<
  React.ComponentRef<typeof Primitive.Content>,
  TabsContentProps
>(({ className, ...props }, ref) => (
  <Primitive.Content
    ref={ref}
    className={cn(
      'mt-[var(--density-gap,0.5rem)] min-w-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
      className,
    )}
    {...props}
  />
));
TabsContent.displayName = 'TabsContent';
