import * as React from 'react';
import {
  ArrowUpRight,
  ChevronDown,
  GripVertical,
  MessageSquare,
  Minus,
  Plus,
} from 'lucide-react';
import { useChatkitTranslation } from '../../i18n/useChatkitTranslation';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../../components/ui/dropdown-menu';
import type { useFloatingChatPosition } from './useFloatingChatPosition';

export function FloatingChatHeader({
  title,
  status,
  visible,
  expanded,
  dragProps,
  onToggle,
  onMinimize,
  onOpenChat,
  onNewSideChat,
  onMenuOpenChange,
  onFocusInput,
}: {
  title: string;
  status: React.ReactNode;
  visible: boolean;
  expanded: boolean;
  dragProps: ReturnType<typeof useFloatingChatPosition>['handleProps'];
  onToggle: () => void;
  onMinimize: () => void;
  onOpenChat: () => void;
  onNewSideChat?: () => void;
  onMenuOpenChange: (open: boolean) => void;
  onFocusInput: () => void;
}) {
  const { t } = useChatkitTranslation();
  const selected = React.useRef(false);
  const interactedOutside = React.useRef(false);
  const isControl = (event: React.SyntheticEvent<HTMLElement>) =>
    event.target instanceof Element &&
    (!event.currentTarget.contains(event.target) ||
      !!event.target.closest('[data-header-control]'));
  const toggleLabel = t(
    `workbench.floatingChat.${expanded ? 'collapse' : 'expand'}`,
  );
  return (
    <div
      hidden={!visible}
      tabIndex={-1}
      className="chatkit-floating-chat-header border-b"
      {...dragProps}
      onPointerDown={(event) => {
        if (!isControl(event)) dragProps.onPointerDown(event);
      }}
      onKeyDown={(event) => {
        if (!isControl(event)) dragProps.onKeyDown(event);
      }}
      onClick={(event) => {
        if (!isControl(event)) onToggle();
      }}
    >
      <button
        data-header-control
        type="button"
        onClick={onMinimize}
        aria-label={t('workbench.floatingChat.minimize')}
        title={t('workbench.floatingChat.minimize')}
      >
        <Minus />
      </button>
      {status}
      <DropdownMenu
        modal={false}
        onOpenChange={(open) => {
          if (open) {
            selected.current = false;
            interactedOutside.current = false;
            onMenuOpenChange(true);
          }
        }}
      >
        <DropdownMenuTrigger asChild>
          <button
            data-header-control
            type="button"
            className="chatkit-floating-chat-title"
            aria-label={`${t('workbench.floatingChat.conversations')}: ${title}`}
            title={title}
          >
            <span className="truncate">{title}</span>
            <ChevronDown className="shrink-0" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          data-floating-chat-menu
          className="chatkit-floating-chat-menu"
          align="start"
          onInteractOutside={() => {
            interactedOutside.current = true;
          }}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            // The compact header may disappear on blur. Restore focus to the
            // always-present editor before releasing the menu's visibility hold.
            if (!selected.current && !interactedOutside.current) onFocusInput();
            onMenuOpenChange(false);
          }}
        >
          <DropdownMenuItem
            onSelect={() => {
              selected.current = true;
              onOpenChat();
            }}
          >
            <MessageSquare />
            <span className="truncate flex-1">{title}</span>
            <ArrowUpRight />
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            disabled={!onNewSideChat}
            onSelect={() => {
              selected.current = true;
              onNewSideChat?.();
            }}
          >
            <Plus />
            {t('workbench.floatingChat.newSideChat')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <div className="flex-1 self-stretch" />
      <button
        data-header-control
        type="button"
        onClick={onOpenChat}
        aria-label={t('workbench.floatingChat.openChat')}
        title={t('workbench.floatingChat.openChat')}
      >
        <ArrowUpRight />
      </button>
      <button
        type="button"
        aria-label={toggleLabel}
        title={`${toggleLabel} · ${t('workbench.floatingChat.move')}`}
      >
        <GripVertical />
      </button>
    </div>
  );
}
