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
        'relative flex min-w-0 flex-1 flex-col overflow-visible bg-composer-shell px-composer-inset pt-composer-inset rounded-composer-shell shadow-composer-shell',
        paddedBottom && 'pb-composer-inset',
        'transition-[border-radius] duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)]',
      )}
    >
      <div
        data-slot="composer-editor-surface"
        className="relative flex min-h-[6.5rem] min-w-0 flex-col rounded-composer-editor bg-input-background px-2 pt-2 pb-14"
        onClick={(event) => {
          if (event.target === event.currentTarget) onFocusEditor?.();
        }}
      >
        {children}
        {actions}
      </div>
      {footer}
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
