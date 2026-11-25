import * as React from 'react';
import {
  ArrowUpRight,
  ChevronDown,
  ChevronUp,
  Folder,
  Minus,
  Plus,
} from 'lucide-react';
import { useChatkitTranslation } from '../../i18n/useChatkitTranslation';
import {
  ConversationMenu,
  type ConversationMenuProps,
} from '../../components/conversation/ConversationMenu';
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
  expanded,
  dragProps,
  conversationMenu,
  onToggle,
  onMinimize,
  onOpenChat,
  onNewSideChat,
}: {
  title: string;
  status: React.ReactNode;
  expanded: boolean;
  conversationMenu?: Pick<ConversationMenuProps, 'context' | 'target'>;
  dragProps: ReturnType<typeof useFloatingChatPosition>['handleProps'];
  onToggle: () => void;
  onMinimize: () => void;
  onOpenChat: () => void;
  onNewSideChat?: () => void;
}) {
  const { t } = useChatkitTranslation();
  const isControl = (event: React.SyntheticEvent<HTMLElement>) =>
    event.target instanceof Element &&
    (!event.currentTarget.contains(event.target) ||
      !!event.target.closest('[data-header-control]'));
  const toggleLabel = t(
    `workbench.floatingChat.${expanded ? 'collapse' : 'expand'}`,
  );
  const ToggleIcon = expanded ? ChevronDown : ChevronUp;
  const extraItems = (
    <>
      <DropdownMenuItem onSelect={onOpenChat}>
        <ArrowUpRight />
        {t('workbench.floatingChat.openChat')}
      </DropdownMenuItem>
      <DropdownMenuItem onSelect={onToggle}>
        <ToggleIcon />
        {toggleLabel}
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem disabled={!onNewSideChat} onSelect={onNewSideChat}>
        <Plus />
        {t('workbench.floatingChat.newSideChat')}
      </DropdownMenuItem>
    </>
  );
  return (
    <div
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
      {conversationMenu ? (
        <ConversationMenu
          {...conversationMenu}
          placement="floating"
          triggerTitle={title}
          extraItems={extraItems}
        />
      ) : (
        <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild>
            <button
              data-header-control
              type="button"
              className="chatkit-floating-chat-title"
              aria-label={`${t('workbench.floatingChat.conversations')}: ${title}`}
              title={title}
            >
              <Folder className="shrink-0" aria-hidden="true" />
              <span className="truncate">{title}</span>
              <ChevronDown className="shrink-0" aria-hidden="true" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            data-floating-chat-menu
            className="chatkit-floating-chat-menu"
            align="start"
            side="top"
            sideOffset={8}
          >
            {extraItems}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
      <div className="flex-1 self-stretch" />
      <button
        type="button"
        aria-label={toggleLabel}
        aria-expanded={expanded}
        title={`${toggleLabel} · ${t('workbench.floatingChat.move')}`}
      >
        {status || <ToggleIcon aria-hidden="true" />}
      </button>
      <button
        data-header-control
        type="button"
        onClick={onMinimize}
        aria-label={t('workbench.floatingChat.minimize')}
        title={t('workbench.floatingChat.minimize')}
      >
        <Minus aria-hidden="true" />
      </button>
    </div>
  );
}
