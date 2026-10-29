import { useContext, type ReactNode, type Ref } from 'react';
import { HostedWebUpdateContext } from '../../../web-update/context';
import { Info, Minus, MoreHorizontal } from 'lucide-react';
import { useChatkitTranslation } from '../../../i18n/useChatkitTranslation';
import { WorkbenchToggleButton } from '../../../workbench/context';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../../ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '../../ui/tooltip';

/** Shared actions for both conversation runtimes; each supplies its supported commands. */
export function ChatHeaderActions({
  menu,
  summary,
  children,
  onMinimize,
  moreButtonRef,
  onMenuCloseAutoFocus,
}: {
  menu?: ReactNode;
  summary?: ReactNode;
  children?: ReactNode;
  onMinimize?: () => void;
  moreButtonRef?: Ref<HTMLButtonElement>;
  onMenuCloseAutoFocus?: (event: Event) => void;
}) {
  const { t } = useChatkitTranslation();
  const webUpdate = useContext(HostedWebUpdateContext);
  const actionClass =
    'flex h-8 w-8 cursor-pointer items-center justify-center rounded-chat-item text-muted-foreground hover:text-foreground hover:bg-muted transition-colors duration-150';
  return (
    <>
      {(menu || webUpdate) && (
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
            onCloseAutoFocus={onMenuCloseAutoFocus}
          >
            {menu}
            {webUpdate && (
              <>
                {menu && <DropdownMenuSeparator />}
                <DropdownMenuItem onSelect={webUpdate.openAbout}>
                  <Info className="size-4" />
                  {t('webUpdate.about')}
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
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
