import * as React from 'react';
import { Loader2 } from 'lucide-react';
import { useChatkitTranslation } from '../../i18n/useChatkitTranslation';
import { Button } from '../../components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogBody,
  DialogFooter,
} from '../../components/ui/dialog';

export function SideChatDeleteDialog({
  title,
  onDelete,
  onClose,
}: {
  title: string;
  onDelete: () => Promise<void>;
  onClose: () => void;
}) {
  const { t } = useChatkitTranslation();
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState('');
  const pending = React.useRef(false);
  const mounted = React.useRef(true);
  React.useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !pending.current) onClose();
      }}
    >
      <DialogContent
        onEscapeKeyDown={(event) => {
          if (pending.current) event.preventDefault();
        }}
      >
        <DialogHeader>
          <DialogTitle>{t('workbench.sideChat.deleteTitle')}</DialogTitle>
          <DialogDescription>
            {t('workbench.sideChat.deleteDescription', { title })}
          </DialogDescription>
        </DialogHeader>
        {error && (
          <DialogBody>
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          </DialogBody>
        )}
        <DialogFooter>
          <Button autoFocus variant="ghost" disabled={busy} onClick={onClose}>
            {t('workbench.sideChat.cancel')}
          </Button>
          <Button
            variant="destructive"
            disabled={busy}
            onClick={async () => {
              if (pending.current) return;
              pending.current = true;
              setBusy(true);
              setError('');
              try {
                await onDelete();
                if (mounted.current) onClose();
              } catch (cause) {
                if (mounted.current)
                  setError(
                    cause instanceof Error
                      ? cause.message
                      : t('workbench.loadFailed'),
                  );
              } finally {
                pending.current = false;
                if (mounted.current) setBusy(false);
              }
            }}
          >
            {busy && <Loader2 size={16} className="animate-spin" />}
            {t('workbench.sideChat.deleteConfirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
