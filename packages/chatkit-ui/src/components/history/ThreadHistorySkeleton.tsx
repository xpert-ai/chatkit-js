import { useChatkitTranslation } from '../../i18n/useChatkitTranslation';

export function ThreadHistorySkeleton() {
  const { t } = useChatkitTranslation();
  return (
    <div
      role="status"
      aria-label={t('chat.loadingThread')}
      aria-busy="true"
      data-slot="thread-history-skeleton"
      className="mb-4 space-y-10 px-3 py-6"
    >
      <span className="sr-only">{t('chat.loadingThread')}</span>
      <div aria-hidden="true" className="space-y-10 motion-safe:animate-pulse">
        <div className="space-y-6">
          <div className="ml-auto h-12 w-3/5 rounded-2xl bg-muted" />
          <div className="space-y-3 py-2">
            <div className="h-3 w-11/12 rounded bg-muted" />
            <div className="h-3 w-full rounded bg-muted" />
            <div className="h-3 w-4/5 rounded bg-muted" />
            <div className="h-3 w-1/2 rounded bg-muted" />
          </div>
        </div>
        <div className="space-y-6 opacity-60">
          <div className="ml-auto h-12 w-2/5 rounded-2xl bg-muted" />
          <div className="space-y-3 py-2">
            <div className="h-3 w-full rounded bg-muted" />
            <div className="h-3 w-5/6 rounded bg-muted" />
            <div className="h-3 w-2/3 rounded bg-muted" />
          </div>
        </div>
      </div>
    </div>
  );
}
