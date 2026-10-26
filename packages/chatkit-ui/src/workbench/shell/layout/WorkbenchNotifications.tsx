import { useEffect, useId, useRef } from 'react';
import { toast } from 'sonner';
import { Toaster } from '../../../components/ui/sonner';
import { useChatkitTranslation } from '../../../i18n/useChatkitTranslation';

type Notification = { level: 'success' | 'error'; message: string };

/** One scoped toast outlet handles host and Remote View feedback, without reflowing editors. */
export function WorkbenchNotifications({
  notification,
  onClear,
}: {
  notification?: Notification | null;
  onClear?: () => void;
}) {
  const { t } = useChatkitTranslation();
  const id = useId();
  const current = useRef(notification);
  const clear = useRef(onClear);
  current.current = notification;
  clear.current = onClear;

  useEffect(() => {
    if (!notification) return;
    // A delayed dismissal of an older toast must not clear a newer notification.
    const dismissed = () => {
      if (current.current === notification) clear.current?.();
    };
    const toastId = toast[notification.level](notification.message, {
      toasterId: id,
      duration: notification.level === 'error' ? 6000 : 4000,
      onDismiss: dismissed,
      onAutoClose: dismissed,
    });
    // Sonner queues dismissal until the next frame; never reuse that toast's ID.
    return () => {
      toast.dismiss(toastId);
    };
  }, [id, notification]);

  return (
    <Toaster
      id={id}
      position="top-right"
      closeButton
      containerAriaLabel={t('workbench.notifications')}
      toastOptions={{
        closeButtonAriaLabel: t('workbench.dismissNotification'),
      }}
    />
  );
}
