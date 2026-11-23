import type { ConnectionState } from '../../providers/stream/connection/read-recovery';
import { useChatkitTranslation } from '../../i18n/useChatkitTranslation';
import { Button } from '../ui/button';

export function ConnectionStatus({
  state,
  onReconnect,
}: {
  state?: ConnectionState;
  onReconnect?: () => void;
}) {
  const { t } = useChatkitTranslation();
  if (!state || state === 'connected') return null;
  return (
    <p
      role="status"
      aria-live="polite"
      className="flex flex-wrap items-center gap-2 py-1 text-xs text-muted-foreground"
    >
      {t(`connection.${state}`)}
      {state === 'unavailable' && onReconnect && (
        <Button type="button" variant="ghost" size="sm" onClick={onReconnect}>
          {t('connection.retry')}
        </Button>
      )}
    </p>
  );
}
