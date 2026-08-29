import * as React from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../components/ui/alert-dialog';
import { Checkbox } from '../components/ui/checkbox';
import { useChatkitTranslation } from '../i18n/useChatkitTranslation';

export const SIDE_CHAT_CLOSE_CONFIRMATION_STORAGE_KEY =
  'chatkit:workbench:side-chat-close-confirmation-disabled';

export function isSideChatCloseConfirmationDisabled(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return (
      window.localStorage.getItem(SIDE_CHAT_CLOSE_CONFIRMATION_STORAGE_KEY) ===
      'true'
    );
  } catch {
    return false;
  }
}

export function persistSideChatCloseConfirmationDisabled(
  disabled: boolean,
): void {
  if (typeof window === 'undefined') return;
  try {
    if (disabled) {
      window.localStorage.setItem(
        SIDE_CHAT_CLOSE_CONFIRMATION_STORAGE_KEY,
        'true',
      );
    } else {
      window.localStorage.removeItem(SIDE_CHAT_CLOSE_CONFIRMATION_STORAGE_KEY);
    }
  } catch {
    // Storage can be unavailable in private or restricted browser contexts.
  }
}

type SideChatCloseDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (dontAskAgain: boolean) => void;
};

export function SideChatCloseDialog({
  open,
  onOpenChange,
  onConfirm,
}: SideChatCloseDialogProps) {
  const { t } = useChatkitTranslation();
  const [dontAskAgain, setDontAskAgain] = React.useState(false);

  React.useEffect(() => {
    if (open) setDontAskAgain(false);
  }, [open]);

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {t('workbench.sideChat.closeDialog.title')}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {t('workbench.sideChat.closeDialog.description')}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="flex items-center gap-2">
          <Checkbox
            id="side-chat-close-dont-ask-again"
            checked={dontAskAgain}
            onCheckedChange={(checked) => setDontAskAgain(checked === true)}
          />
          <label
            htmlFor="side-chat-close-dont-ask-again"
            className="cursor-pointer text-sm font-medium leading-none"
          >
            {t('workbench.sideChat.closeDialog.dontAskAgain')}
          </label>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel>
            {t('workbench.sideChat.closeDialog.cancel')}
          </AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            onClick={() => onConfirm(dontAskAgain)}
          >
            {t('workbench.sideChat.closeDialog.confirm')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
