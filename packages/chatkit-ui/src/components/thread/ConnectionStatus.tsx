import type { ConnectionState } from '../../providers/stream/connection/read-recovery';
import { useChatkitTranslation } from '../../i18n/useChatkitTranslation';

export function ConnectionStatus({ state }: { state?: ConnectionState }) {
  const { t } = useChatkitTranslation();
  if (!state || state === 'connected') return null;
  return (
    <p
      role="status"
      aria-live="polite"
      className="py-1 text-xs text-muted-foreground"
    >
      {t(`connection.${state}`)}
    </p>
  );
}
