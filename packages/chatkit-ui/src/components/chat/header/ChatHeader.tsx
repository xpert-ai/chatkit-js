import type { CSSProperties, ReactNode, Ref } from 'react';
import { cn } from '../../../lib/utils';

export type ChatHeaderProps = {
  visible?: boolean;
  columnRef?: Ref<HTMLDivElement>;
  style?: CSSProperties;
  characterPresentation?: boolean;
  avatar: ReactNode;
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
};

export function ChatHeader({
  visible = true,
  columnRef,
  style,
  characterPresentation = false,
  avatar,
  title,
  subtitle,
  actions,
}: ChatHeaderProps) {
  return (
    visible && (
      <div
        data-slot="chatkit-chat-header-container"
        className={cn(
          'sticky top-0 z-10 w-full min-w-0 shrink-0 bg-background',
          characterPresentation && 'col-start-1 row-start-1 self-start',
        )}
      >
        <div
          ref={columnRef}
          data-slot="chatkit-chat-header"
          className={cn(
            'mx-auto flex w-full items-center justify-between p-2',
            !characterPresentation && 'border-b',
          )}
          style={style}
        >
          <div
            className={cn(
              'flex min-w-0 flex-1 items-center gap-3 overflow-hidden',
              characterPresentation && 'invisible',
            )}
            aria-hidden={characterPresentation || undefined}
            inert={characterPresentation || undefined}
          >
            {avatar}
            <div className="min-w-0 flex-1">
              <h2 className="text-lg font-semibold truncate" title={title}>
                {title}
              </h2>
              {subtitle}
            </div>
          </div>
          <div className="pointer-events-auto flex shrink-0 items-center gap-1">
            {actions}
          </div>
        </div>
      </div>
    )
  );
}
