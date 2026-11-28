import * as React from 'react';
import { useChatkitTranslation } from '../../i18n/useChatkitTranslation';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter,
} from '../../components/ui/dialog';

export function SideChatRenameDialog({
  title: initialTitle,
  onSave,
  onClose,
}: {
  title: string;
  onSave: (title: string) => Promise<void>;
  onClose: () => void;
}) {
  const { t } = useChatkitTranslation();
  const [title, setTitle] = React.useState(initialTitle);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState('');
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
        if (!open && !saving) onClose();
      }}
    >
      <DialogContent layout="sectioned" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>{t('workbench.tabMenu.rename')}</DialogTitle>
        </DialogHeader>
        <form
          className="flex min-h-0 flex-col"
          onSubmit={async (event) => {
            event.preventDefault();
            if (saving || !title.trim()) return;
            setSaving(true);
            setError('');
            try {
              await onSave(title.trim());
              if (mounted.current) onClose();
            } catch (cause) {
              if (mounted.current)
                setError(
                  cause instanceof Error
                    ? cause.message
                    : t('workbench.loadFailed'),
                );
            } finally {
              if (mounted.current) setSaving(false);
            }
          }}
        >
          <DialogBody className="space-y-[calc(0.5rem*var(--chat-density-scale,1))] pt-[max(4px,calc(0.25rem*var(--chat-density-scale,1)))]">
            <Input
              autoFocus
              aria-label={t('workbench.sideChat.name')}
              maxLength={200}
              value={title}
              disabled={saving}
              onChange={(event) => setTitle(event.target.value)}
            />
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
          </DialogBody>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              disabled={saving}
              onClick={onClose}
            >
              {t('workbench.sideChat.cancel')}
            </Button>
            <Button type="submit" disabled={saving || !title.trim()}>
              {t('workbench.sideChat.save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
