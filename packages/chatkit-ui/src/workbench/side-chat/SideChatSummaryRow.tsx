import * as React from 'react';
import { ContextMenu } from 'radix-ui';
import { useTheme as usePrimitiveTheme } from '@xpert-ai/chatkit-primitives';
import { menuItemHighlightClassName } from '../../components/ui/dropdown-menu';
import type { TabMenuAction } from '../WorkbenchTabMenu';
import {
  PanelRightClose,
  PanelRightOpen,
  ArchiveRestore,
  CircleAlert,
  CircleHelp,
  CirclePause,
  LoaderCircle,
  MessagesSquare,
  Pencil,
  Plus,
} from 'lucide-react';
import { useChatkitTranslation } from '../../i18n/useChatkitTranslation';
import { useTheme } from '../../providers/Theme';
import { getSurfaceThemeStyle } from '../../lib/theme-surfaces';
import { cn } from '../../lib/utils';
import type { SideChatSession } from './types';

type Props = {
  session: SideChatSession;
  active: boolean;
  creating: boolean;
  onOpen: () => void;
  onClose: () => void;
  onRename: () => void;
  onCreate: () => void;
  actions?: TabMenuAction[];
};

export function SideChatSummaryRow({
  session,
  active,
  creating,
  onOpen,
  onClose,
  onRename,
  onCreate,
  actions = [],
}: Props) {
  const { t } = useChatkitTranslation();
  const { theme } = useTheme();
  const primitiveTheme = usePrimitiveTheme();
  const buttonRef = React.useRef<HTMLButtonElement>(null);
  const pendingAction = React.useRef<(() => void) | null>(null);
  const status = session.status ?? 'idle';
  const statusLabel = t(`workbench.sideChat.${status}`);
  const closed = session.opened === false;
  const actionLabel = t(
    session.archived
      ? 'workbench.sideChat.restoreNamed'
      : closed
        ? 'workbench.sideChat.reopen'
        : 'workbench.sideChat.collapse',
    { title: session.title },
  );
  const ActionIcon = session.archived
    ? ArchiveRestore
    : closed
      ? PanelRightOpen
      : PanelRightClose;
  const StatusIcon =
    status === 'busy'
      ? LoaderCircle
      : status === 'error'
        ? CircleAlert
        : status === 'interrupted'
          ? CircleHelp
          : status === 'paused'
            ? CirclePause
            : null;
  const rename = () => {
    pendingAction.current = onRename;
  };
  const menuItemClass = cn(
    'flex cursor-default items-center gap-[calc(0.5rem*var(--chat-density-scale,1))] rounded-chat-item px-[calc(0.75rem*var(--chat-density-scale,1))] py-[calc(0.5rem*var(--chat-density-scale,1))] text-sm outline-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[variant=destructive]:text-destructive data-[variant=destructive]:focus:text-destructive',
    menuItemHighlightClassName,
  );

  return (
    <ContextMenu.Root>
      <ContextMenu.Trigger asChild>
        <div
          data-slot="side-chat-summary-row"
          className={cn(
            'flex min-w-0 items-center rounded-chat-item text-foreground transition-colors hover:bg-muted focus-within:bg-muted',
            active && !closed && 'bg-muted',
          )}
        >
          <button
            ref={buttonRef}
            type="button"
            className="flex min-w-0 flex-1 items-center gap-[calc(0.75rem*var(--chat-density-scale,1))] rounded-chat-item px-[calc(0.5rem*var(--chat-density-scale,1))] py-[calc(0.25rem*var(--chat-density-scale,1))] text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
            aria-current={active && !closed ? 'true' : undefined}
            aria-keyshortcuts="F2"
            title={session.title}
            onClick={onOpen}
            onKeyDown={(event) => {
              if (event.key === 'F2') {
                event.preventDefault();
                onRename();
              }
            }}
          >
            <MessagesSquare
              aria-hidden="true"
              strokeWidth={1.75}
              className="size-[max(14px,calc(1rem*var(--chat-density-scale,1)))] shrink-0"
            />
            <span className="min-w-0 flex-1 truncate text-sm font-medium leading-5">
              {session.title}
            </span>
            <span
              title={statusLabel}
              className={cn(
                'flex size-[max(12px,calc(0.875rem*var(--chat-density-scale,1)))] shrink-0 items-center justify-center text-muted-foreground',
                status === 'error' && 'text-destructive',
              )}
            >
              {StatusIcon && (
                <StatusIcon
                  aria-hidden="true"
                  strokeWidth={1.75}
                  className={cn(
                    'size-full',
                    status === 'busy' &&
                      'animate-spin motion-reduce:animate-none',
                  )}
                />
              )}
              <span className="sr-only">{statusLabel}</span>
            </span>
          </button>
          <button
            type="button"
            title={actionLabel}
            aria-label={actionLabel}
            className="mr-[calc(0.25rem*var(--chat-density-scale,1))] inline-flex size-[max(28px,calc(1.75rem*var(--chat-density-scale,1)))] shrink-0 items-center justify-center rounded-chat-item text-muted-foreground transition-colors hover:bg-background/70 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
            onClick={closed ? onOpen : onClose}
          >
            <ActionIcon
              aria-hidden="true"
              strokeWidth={1.75}
              className="size-[max(14px,calc(1rem*var(--chat-density-scale,1)))]"
            />
          </button>
        </div>
      </ContextMenu.Trigger>
      <ContextMenu.Portal container={primitiveTheme?.portalContainer}>
        <ContextMenu.Content
          aria-label={t('workbench.sideChat.actions', { title: session.title })}
          style={getSurfaceThemeStyle(theme)}
          className="z-50 min-w-40 max-w-[calc(100vw-2rem)] rounded-chat-panel border border-border/70 bg-popover p-[calc(0.25rem*var(--chat-density-scale,1))] text-popover-foreground shadow-lg"
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            // Wait for the menu focus trap to release before mounting the input.
            buttonRef.current?.focus();
            const action = pendingAction.current;
            pendingAction.current = null;
            action?.();
          }}
        >
          <ContextMenu.Item className={menuItemClass} onSelect={rename}>
            <Pencil size={16} aria-hidden="true" />
            {t('workbench.sideChat.rename', { title: session.title })}
          </ContextMenu.Item>
          {!session.archived && (
            <ContextMenu.Item
              className={menuItemClass}
              onSelect={closed ? onOpen : onClose}
            >
              <ActionIcon size={16} aria-hidden="true" />
              {actionLabel}
            </ContextMenu.Item>
          )}
          {actions.map((action) => (
            <ContextMenu.Item
              key={action.id}
              className={menuItemClass}
              data-variant={action.variant}
              disabled={action.disabled}
              onSelect={() => {
                pendingAction.current = action.run;
              }}
            >
              {action.icon}
              {action.label}
            </ContextMenu.Item>
          ))}
          <ContextMenu.Item
            className={menuItemClass}
            disabled={creating}
            onSelect={onCreate}
          >
            <Plus size={16} aria-hidden="true" />
            {t('workbench.sideChat.create')}
          </ContextMenu.Item>
        </ContextMenu.Content>
      </ContextMenu.Portal>
    </ContextMenu.Root>
  );
}
