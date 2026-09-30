import * as React from 'react';
import { Box, Loader2 } from 'lucide-react';
import {
  parseResourceCardContent,
  upsertResourceCardContent,
  type ChatkitMessage,
  type TMessageContentResourceCard,
} from '@xpert-ai/chatkit-types';
import { useWorkbench } from '../../../workbench/context';
import { useChatkitTranslation } from '../../../i18n/useChatkitTranslation';
import { IconDefinitionRenderer } from '../../ui/icon-definition';

export function messageResourceCards(
  message: Pick<ChatkitMessage, 'content'>,
): TMessageContentResourceCard[] {
  if (!Array.isArray(message.content)) return [];
  return message.content.reduce<TMessageContentResourceCard[]>(
    (cards, part) => {
      const card = parseResourceCardContent(part);
      return card ? upsertResourceCardContent(cards, card) : cards;
    },
    [],
  );
}

function ResourceCard({
  card,
  messageId,
}: {
  card: TMessageContentResourceCard;
  messageId: string;
}) {
  const workbench = useWorkbench();
  const { t } = useChatkitTranslation();
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const available = workbench.enabled && !!workbench.openResourceCard;
  const open = async () => {
    if (!available || busy) return;
    setBusy(true);
    setError(null);
    try {
      const result = await workbench.openResourceCard!(card, messageId);
      if (
        !result ||
        typeof result !== 'object' ||
        !('success' in result) ||
        result.success !== true
      ) {
        const code =
          result && typeof result === 'object' && 'code' in result
            ? result.code
            : null;
        setError(
          t(
            code === 'forbidden'
              ? 'resourceCard.forbidden'
              : 'resourceCard.unavailable',
          ),
        );
      }
    } catch {
      setError(t('resourceCard.unavailable'));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div
      className="rounded-xl border border-border bg-card px-4 py-3"
      data-testid="resource-card"
    >
      <div className="flex items-center gap-3">
        <IconDefinitionRenderer
          icon={card.data.icon}
          size={22}
          fallback={<Box className="h-5 w-5 shrink-0 text-muted-foreground" />}
        />
        <div className="min-w-0 flex-1">
          <div className="break-words font-medium text-foreground">
            {card.data.title}
          </div>
          {card.data.description && (
            <div className="mt-1 whitespace-pre-line break-words text-sm text-muted-foreground">
              {card.data.description}
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={open}
          disabled={!available || workbench.loading || busy}
          aria-label={`${t('resourceCard.open')} ${card.data.title}`}
          className="inline-flex shrink-0 items-center gap-1 rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
        >
          {busy && (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          )}
          {t('resourceCard.open')}
        </button>
      </div>
      {!available && (
        <p className="mt-2 text-sm text-muted-foreground">
          {t('resourceCard.disabled')}
        </p>
      )}
      {error && (
        <p role="alert" className="mt-2 text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

export function MessageResourceCards({ message }: { message: ChatkitMessage }) {
  return (
    <div className="space-y-2">
      {messageResourceCards(message).map((card) => (
        <ResourceCard key={card.id} card={card} messageId={message.id} />
      ))}
    </div>
  );
}
