import type { ConversationShareSnapshot } from './share-client';
import { useChatkitTranslation } from '../../i18n/useChatkitTranslation';

/** Presentation excerpts never replace the complete snapshot or its digest. */
export function ConversationSharePreview({
  snapshot,
}: {
  snapshot: ConversationShareSnapshot;
}) {
  const { t } = useChatkitTranslation();
  return (
    <section
      aria-label={t('sharing.preview')}
      className="min-w-0 space-y-3 rounded-chat-item border border-border p-4"
    >
      <h3 className="line-clamp-2 break-words text-sm font-semibold">
        {snapshot.title}
      </h3>
      <ol className="space-y-3">
        {snapshot.messages.slice(0, 2).map((message, index) => (
          <li key={index} className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground">
              {t(`sharing.${message.role}`)}
            </p>
            <p className="line-clamp-3 whitespace-pre-wrap break-words text-sm [overflow-wrap:anywhere]">
              {message.text.length > 400
                ? `${message.text.slice(0, 400)}…`
                : message.text}
            </p>
          </li>
        ))}
      </ol>
      <p className="text-xs text-muted-foreground">
        {t('sharing.previewSummary', { total: snapshot.messages.length })}
      </p>
    </section>
  );
}
