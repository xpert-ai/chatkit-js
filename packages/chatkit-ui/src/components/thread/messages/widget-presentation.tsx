import type { TWidgetPresentation } from '@xpert-ai/chatkit-types';
import { ChevronDown } from 'lucide-react';
import { useChatkitTranslation } from '../../../i18n/useChatkitTranslation';

/** Passive, viewer-local formatting. Opening details never dispatches an A2UI action. */
export function WidgetPresentation({ value }: { value?: TWidgetPresentation }) {
  const { t, i18n } = useChatkitTranslation();
  if (!value) return null;
  const timestamp = value.timestamp ? new Date(value.timestamp) : null;
  const validTime = timestamp && !Number.isNaN(timestamp.getTime());
  return (
    <footer className="mt-[var(--density-padding,1rem)] border-t border-border pt-[var(--density-gap,0.5rem)] text-xs text-muted-foreground">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        {value.summary && <span>{value.summary}</span>}
        {validTime && (
          <span>
            {value.timestampLabel && `${value.timestampLabel} · `}
            <time dateTime={value.timestamp} title={value.timestamp}>
              {timestamp.toLocaleString(i18n.language, {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                hour12: false,
              })}
            </time>
          </span>
        )}
      </div>
      {!!value.details?.length && (
        <details className="group/widget-details mt-[var(--density-gap,0.5rem)]">
          <summary className="flex w-fit cursor-pointer list-none items-center gap-1 rounded-chat-item py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
            {t('chat.widgetDetails')}
            <ChevronDown
              className="size-3.5 group-open/widget-details:rotate-180"
              aria-hidden="true"
            />
          </summary>
          <dl className="grid gap-2 py-2">
            {value.details.map((detail, index) => (
              <div key={index} className="flex flex-wrap gap-x-3 gap-y-1">
                <dt>{detail.label}</dt>
                <dd className="min-w-0 break-words text-foreground">
                  {detail.value}
                </dd>
              </div>
            ))}
          </dl>
        </details>
      )}
    </footer>
  );
}
