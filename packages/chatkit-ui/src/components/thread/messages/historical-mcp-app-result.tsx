import type { TMessageComponentMcpAppData } from '@xpert-ai/chatkit-types';
import { useChatkitTranslation } from '../../../i18n/useChatkitTranslation';

/** A copied result must not reconnect to the source run's app instance. */
export function HistoricalMcpAppResult({
  data,
}: {
  data: TMessageComponentMcpAppData;
}) {
  const { t } = useChatkitTranslation();
  return (
    <details className="rounded-lg border p-3" open>
      <summary className="cursor-pointer text-sm font-medium">
        {t('message.historicalAppResult')}
      </summary>
      <pre className="mt-2 max-h-96 overflow-auto whitespace-pre-wrap break-words text-xs">
        {data.toolResult
          ? JSON.stringify(data.toolResult, null, 2)
          : t('message.historicalAppResultUnavailable')}
      </pre>
    </details>
  );
}
