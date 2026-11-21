import type { WidgetAgentAction } from '@xpert-ai/chatkit-types';
import { useChatkitTranslation } from '../../../i18n/useChatkitTranslation';

export function WidgetActionReceipt({ action }: { action: WidgetAgentAction }) {
  const { t } = useChatkitTranslation();
  return (
    <div className="space-y-1 text-sm">
      <p>{t('widget.actionSent')}</p>
      <dl className="space-y-1">
        {Object.entries(action.context).map(([key, value]) => (
          <div key={key} className="flex flex-wrap gap-x-2">
            <dt className="opacity-70">{key}</dt>
            <dd className="min-w-0 break-words">
              {typeof value === 'string' ? value : JSON.stringify(value)}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
