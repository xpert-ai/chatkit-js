import type { CSSProperties, ReactNode, ComponentProps } from 'react';
import { cn } from '../../../lib/utils';

export function ComposerSurface({
  children,
  actions,
  footer,
  style,
  onFocusEditor,
  paddedBottom = !footer,
}: {
  children: ReactNode;
  actions: ReactNode;
  footer?: ReactNode;
  paddedBottom?: boolean;
  style?: CSSProperties;
  onFocusEditor?: () => void;
}) {
  return (
    <div
      data-slot="composer-input-shell"
      data-layout="stacked"
      style={style}
      className={cn(
        'relative isolate flex min-w-0 flex-1 flex-col overflow-visible',
        paddedBottom && 'pb-composer-inset',
      )}
    >
      <div
        data-slot="composer-editor-surface"
        className="relative z-10 flex min-w-0 flex-col bg-input-background shadow-composer-shell"
        onClick={(event) => {
          if (event.target === event.currentTarget) onFocusEditor?.();
        }}
      >
        {children}
        {actions}
      </div>
      {footer && <div data-slot="composer-context-surface">{footer}</div>}
    </div>
  );
}

export function ChatComposerFormFrame({
  onSubmit,
  children,
  ...surface
}: ComponentProps<typeof ComposerSurface> & {
  onSubmit: ComponentProps<'form'>['onSubmit'];
}) {
  return (
    <form className="flex items-end" onSubmit={onSubmit}>
      <ComposerSurface {...surface}>{children}</ComposerSurface>
    </form>
  );
}
