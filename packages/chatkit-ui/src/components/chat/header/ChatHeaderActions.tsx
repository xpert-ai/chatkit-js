import type { ReactNode, Ref } from 'react';
import { Minus, MoreHorizontal } from 'lucide-react';
import { useChatkitTranslation } from '../../../i18n/useChatkitTranslation';
import { WorkbenchToggleButton } from '../../../workbench/context';
import {
  DropdownMenu,
  DropdownMenuContent,
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
  const actionClass =
    'flex h-8 w-8 cursor-pointer items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors duration-150';
  return (
    <>
      {menu && (
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
