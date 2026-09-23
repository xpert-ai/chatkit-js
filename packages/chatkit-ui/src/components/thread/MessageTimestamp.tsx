import type { ChatkitMessage } from '@xpert-ai/chatkit-types';
import { useChatkitTranslation } from '../../i18n/useChatkitTranslation';
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip';

function formatCompactTime(date: Date, language: string, now = new Date()) {
  const time = new Intl.DateTimeFormat(language, {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(date);
  // Compare local calendar dates, not elapsed 24-hour periods (including DST).
  const calendarDay = (value: Date) =>
    Date.UTC(value.getFullYear(), value.getMonth(), value.getDate());
  const daysAgo = (calendarDay(now) - calendarDay(date)) / 86_400_000;
  if (daysAgo === 0) return time;

  const day =
    daysAgo > 0 && daysAgo < 7
      ? new Intl.RelativeTimeFormat(language, { numeric: 'auto' }).format(
          -daysAgo,
          'day',
        )
      : new Intl.DateTimeFormat(language, {
          ...(date.getFullYear() !== now.getFullYear()
            ? { year: 'numeric' as const }
            : {}),
          month: 'short',
          day: 'numeric',
        }).format(date);
  return `${day} ${time}`;
}

export function MessageTimestamp({
  updatedAt,
}: Pick<ChatkitMessage, 'updatedAt'>) {
  const { t, i18n } = useChatkitTranslation();
  if (!updatedAt) return null;
  const date = new Date(updatedAt);
  if (!Number.isFinite(date.getTime())) return null;
  const label = t('message.updatedAt', {
    time: new Intl.DateTimeFormat(i18n.language, {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
      timeZoneName: 'short',
    }).format(date),
  });
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <time
          dateTime={date.toISOString()}
          aria-label={label}
          tabIndex={0}
          className="inline-block shrink-0 rounded-sm px-1 text-xs tabular-nums text-muted-foreground opacity-0 transition-opacity group-hover/message:opacity-100 group-focus-within/message:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {formatCompactTime(date, i18n.language)}
        </time>
      </TooltipTrigger>
      <TooltipContent side="bottom">{label}</TooltipContent>
    </Tooltip>
  );
}
