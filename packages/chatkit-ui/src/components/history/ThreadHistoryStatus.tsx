import type { ThreadHistoryState } from '../../providers/useThreadHistory';
import { useChatkitTranslation } from '../../i18n/useChatkitTranslation';
import { Button } from '../ui/button';

export function ThreadHistoryStatus({
  state,
  isEmpty,
  onRetry,
}: {
  state: ThreadHistoryState | undefined;
  isEmpty: boolean;
  onRetry: () => void;
}) {
  const { t } = useChatkitTranslation();
  if (state?.status === 'loading') {
    return (
      <div
        role="status"
        className="mb-4 px-3 py-2 text-sm text-muted-foreground"
      >
        {t('chat.loadingThread')}
      </div>
    );
  }
  if (state?.status === 'error') {
    return (
      <div
        role="alert"
        className="mb-4 flex items-center justify-between gap-3 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
      >
        <span>{t('chat.errors.loadMessages')}</span>
        <Button type="button" variant="outline" size="sm" onClick={onRetry}>
          {t('chat.retryHistory')}
        </Button>
      </div>
    );
  }
  if (state?.status === 'loaded' && isEmpty) {
    return (
      <div
        role="status"
        className="px-3 py-6 text-center text-sm text-muted-foreground"
      >
        {t('chat.emptyHistory')}
      </div>
    );
  }
  return null;
}
