import { useEffect, useState } from 'react';
import { useChatkitTranslation } from '../../../i18n/useChatkitTranslation';

/** Keep quick session switches quiet; slow initialization never covers the chat. */
export function WorkbenchLoadingIndicator({ pending }: { pending: boolean }) {
  const { t } = useChatkitTranslation();
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!pending) {
      setVisible(false);
      return;
    }
    const timer = setTimeout(() => setVisible(true), 400);
    return () => clearTimeout(timer);
  }, [pending]);

  if (!pending || !visible) return null;
  return (
    <div
      role="status"
      data-chatkit-loading-indicator=""
      className="pointer-events-none absolute inset-x-0 top-0 z-50 h-0.5"
    >
      <span className="sr-only">{t('message.loading')}</span>
      <div
        className="h-full animate-pulse bg-primary/50 motion-reduce:animate-none"
        aria-hidden="true"
      />
    </div>
  );
}
