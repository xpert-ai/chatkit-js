import type { ComponentProps } from 'react';
import { cn } from '../../../lib/utils';
import type { MessagePresentationMode } from '../../../lib/message-presentation';

/** Keep this shell mounted in both modes so interactive children retain state. */
export function MessageBubble({
  mode = 'transcript',
  kind = 'rich',
  className,
  children,
  ...props
}: ComponentProps<'div'> & {
  mode?: MessagePresentationMode;
  kind?: 'text' | 'media' | 'rich' | 'status';
}) {
  return (
    <div
      {...props}
      data-message-bubble={mode === 'bubbles' ? kind : undefined}
      className={cn(mode === 'bubbles' && 'chatkit-message-bubble', className)}
    >
      {children}
    </div>
  );
}
