import * as React from 'react';
import { RadioGroup as Primitive } from 'radix-ui';
import { cn } from '../../lib/utils';

export function RadioGroup({
  className,
  ...props
}: React.ComponentProps<typeof Primitive.Root>) {
  return (
    <Primitive.Root
      className={cn('grid gap-[var(--density-gap,0.5rem)]', className)}
      {...props}
    />
  );
}
export function RadioGroupItem({
  className,
  ...props
}: React.ComponentProps<typeof Primitive.Item>) {
  return (
    <Primitive.Item
      className={cn(
        'size-4 shrink-0 rounded-full border border-input text-primary ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50',
        className,
      )}
      {...props}
    >
      <Primitive.Indicator className="flex items-center justify-center">
        <span className="size-2 rounded-full bg-primary" />
      </Primitive.Indicator>
    </Primitive.Item>
  );
}
