import * as React from 'react';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
} from '../../components/ui/alert-dialog';
import { Button } from '../../components/ui/button';
import { useChatkitTranslation } from '../../i18n/useChatkitTranslation';

export function NativeCloseDialog({
  open,
  onCancel,
  onDiscard,
  onSave,
}: {
  open: boolean;
  onCancel: () => void;
  onDiscard: () => void;
  onSave: () => Promise<void>;
}) {
  const { t } = useChatkitTranslation();
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState('');
  React.useEffect(() => {
    if (open) setError('');
  }, [open]);
  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (!next && !saving) onCancel();
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('workbench.files.unsaved')}</AlertDialogTitle>
          <AlertDialogDescription>
            {t('workbench.files.unsavedDescription')}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={saving}>
            {t('workbench.files.cancel')}
          </AlertDialogCancel>
          <Button variant="outline" disabled={saving} onClick={onDiscard}>
            {t('workbench.files.discard')}
          </Button>
          <Button
            disabled={saving}
            onClick={async () => {
              setSaving(true);
              setError('');
              try {
                await onSave();
              } catch (error) {
                setError(
                  error instanceof Error
                    ? error.message
                    : t('workbench.files.failed'),
                );
              } finally {
                setSaving(false);
              }
            }}
          >
            {t(saving ? 'workbench.files.saving' : 'workbench.files.saveClose')}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
