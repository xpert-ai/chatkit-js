import { useState, type ReactNode, type Ref } from 'react';
import {
  ConversationShareDialog,
  type ConversationShareTarget,
} from '../../sharing/ConversationShareDialog';
import { Minus, MoreHorizontal, Share2 } from 'lucide-react';
import { useChatkitTranslation } from '../../../i18n/useChatkitTranslation';
import { WorkbenchToggleButton } from '../../../workbench/context';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../../ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '../../ui/tooltip';

/** Shared actions for both conversation runtimes; each supplies its supported commands. */
export function ChatHeaderActions({
  menu,
  share,
  summary,
  children,
  onMinimize,
  moreButtonRef,
  onMenuCloseAutoFocus,
}: {
  menu?: ReactNode;
  share?: ConversationShareTarget;
  summary?: ReactNode;
  children?: ReactNode;
  onMinimize?: () => void;
  moreButtonRef?: Ref<HTMLButtonElement>;
  onMenuCloseAutoFocus?: (event: Event) => void;
}) {
  const [shareOpen, setShareOpen] = useState(false);
  const { t } = useChatkitTranslation();
  const actionClass =
    'flex h-8 w-8 cursor-pointer items-center justify-center rounded-chat-item text-muted-foreground hover:text-foreground hover:bg-muted transition-colors duration-150';
  return (
    <>
      {(menu || share) && (
        <DropdownMenu>
          <Tooltip>
            <TooltipTrigger asChild>
              <DropdownMenuTrigger asChild>
                <button
                  ref={moreButtonRef}
                  type="button"
                  className={actionClass}
                  aria-label={t('chat.moreActions')}
                >
                  <MoreHorizontal size={16} />
                </button>
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
              if (shareOpen) event.preventDefault();
              onMenuCloseAutoFocus?.(event);
            }}
          >
            {menu}
            {share && (
              <DropdownMenuItem
                disabled={share.disabled}
                onSelect={() => setShareOpen(true)}
              >
                <Share2 size={16} />
                {t('sharing.action')}
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
      {share && shareOpen && (
        <ConversationShareDialog
          key={`${share.conversationId}:${share.threadId}`}
          {...share}
          open={shareOpen}
          onOpenChange={setShareOpen}
        />
      )}
      {summary}
      {children}
      {onMinimize && (
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              className={actionClass}
              onClick={onMinimize}
              aria-label={t('chat.minimizeToPet')}
            >
              <Minus size={16} />
            </button>
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
