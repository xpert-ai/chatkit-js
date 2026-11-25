import * as React from 'react';
import { MessagesSquare } from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '../../components/ui/popover';
import { ToolbarButton } from '../../components/ui/toolbar-button';
import { useChatkitTranslation } from '../../i18n/useChatkitTranslation';
import { useTheme } from '../../providers/Theme';
import { getSurfaceThemeStyle } from '../../lib/theme-surfaces';
import { SideChatMenuList } from './SideChatMenuList';
import type { useWorkbenchSideChat } from '../shell/side-chat/useWorkbenchSideChat';
export function SideChatMenuButton({
  chats,
}: {
  chats: ReturnType<typeof useWorkbenchSideChat>;
}) {
  const [open, setOpen] = React.useState(false);
  const { t } = useChatkitTranslation();
  const { theme } = useTheme();
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <ToolbarButton
          aria-label={t('workbench.sideChat.list')}
          title={t('workbench.sideChat.list')}
        >
          <MessagesSquare size={16} />
        </ToolbarButton>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-96 max-w-[calc(100vw-2rem)] rounded-chat-panel p-2"
        style={getSurfaceThemeStyle(theme)}
      >
        <SideChatMenuList chats={chats} onOpened={() => setOpen(false)} />
      </PopoverContent>
    </Popover>
  );
}
