import { useRef, useState, type ReactNode, type Ref } from 'react';
import {
  ConversationShareDialog,
  type ConversationShareTarget,
} from '../../sharing/ConversationShareDialog';
import { Minus, MoreHorizontal, Share } from 'lucide-react';
import { ToolbarButton } from '../../ui/toolbar-button';
import { useChatkitTranslation } from '../../../i18n/useChatkitTranslation';
import { WorkbenchToggleButton } from '../../../workbench/context';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '../../ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '../../ui/tooltip';
import {
  ConversationMenu,
  type ConversationMenuProps,
} from '../../conversation/ConversationMenu';

/** Shared actions for both conversation runtimes; each supplies its supported commands. */
export function ChatHeaderActions({
  menu,
  share,
  summary,
  children,
  onMinimize,
  moreButtonRef,
  onMenuCloseAutoFocus,
  conversationMenu,
}: {
  conversationMenu?: Pick<ConversationMenuProps, 'context' | 'target'>;
  menu?: ReactNode;
  share?: ConversationShareTarget & { disabledReason?: string };
  summary?: ReactNode;
  children?: ReactNode;
  onMinimize?: () => void;
  moreButtonRef?: Ref<HTMLButtonElement>;
  onMenuCloseAutoFocus?: (event: Event) => void;
}) {
  const [shareOpen, setShareOpen] = useState(false);
  const shareButtonRef = useRef<HTMLButtonElement>(null);
  const { t } = useChatkitTranslation();
  return (
    <>
      {conversationMenu ? (
        <ConversationMenu
          {...conversationMenu}
          extraItems={menu}
          moreButtonRef={moreButtonRef}
          onMenuCloseAutoFocus={onMenuCloseAutoFocus}
        />
      ) : (
        menu && (
          <DropdownMenu>
            <Tooltip>
              <TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>
                  <ToolbarButton
                    ref={moreButtonRef}
                    type="button"
                    aria-label={t('chat.moreActions')}
                  >
                    <MoreHorizontal size={16} />
                  </ToolbarButton>
                </DropdownMenuTrigger>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                {t('chat.moreActions')}
              </TooltipContent>
            </Tooltip>
            <DropdownMenuContent
              align="end"
              className="min-w-52"
              onCloseAutoFocus={(event) => {
                onMenuCloseAutoFocus?.(event);
              }}
            >
              {menu}
            </DropdownMenuContent>
          </DropdownMenu>
        )
      )}
      {share && (
        <Tooltip>
          <TooltipTrigger asChild>
            <span
              className="inline-flex"
              tabIndex={share.disabledReason ? 0 : undefined}
              aria-label={share.disabledReason}
            >
              <ToolbarButton
                ref={shareButtonRef}
                iconOnly={false}
                disabled={share.disabled || Boolean(share.disabledReason)}
                onClick={() => setShareOpen(true)}
                aria-haspopup="dialog"
                aria-label={t('sharing.action')}
                className="@max-[24rem]/chat-header:w-[max(2rem,calc(2.25rem*var(--chat-density-scale,1)))] @max-[24rem]/chat-header:px-0"
              >
                <Share />
                <span className="@max-[24rem]/chat-header:hidden">
                  {t('sharing.action')}
                </span>
              </ToolbarButton>
            </span>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            {share.disabledReason ?? t('sharing.action')}
          </TooltipContent>
        </Tooltip>
      )}
      {share && !share.disabledReason && shareOpen && (
        <ConversationShareDialog
          key={`${share.conversationId}:${share.threadId}`}
          {...share}
          open={shareOpen}
          onOpenChange={setShareOpen}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            shareButtonRef.current?.focus();
          }}
        />
      )}
      {summary}
      {children}
      {onMinimize && (
        <Tooltip>
          <TooltipTrigger asChild>
            <ToolbarButton
              type="button"
              onClick={onMinimize}
              aria-label={t('chat.minimizeToPet')}
            >
              <Minus size={16} />
            </ToolbarButton>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            {t('chat.minimizeToPet')}
          </TooltipContent>
        </Tooltip>
      )}
      <WorkbenchToggleButton />
    </>
  );
}
