import type { MessagePresentationMode } from '../../../../lib/message-presentation';
import * as React from 'react';
import { Box, Loader2 } from 'lucide-react';
import {
  parseResourceCardContent,
  upsertResourceCardContent,
  type ChatkitMessage,
  type TMessageContentResourceCard,
} from '@xpert-ai/chatkit-types';
import { useResourceCardActions } from '../../../../resource-cards/context';
import { useChatkitTranslation } from '../../../../i18n/useChatkitTranslation';
import { IconDefinitionRenderer } from '../../../ui/icon-definition';
import { ResourceCardBlocks } from './content';
import { ResourceCardLayout } from './layout';

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
  disabledReason,
  openLabel: customOpenLabel,
}: {
  card: TMessageContentResourceCard;
  messageId: string;
  disabledReason?: string;
  openLabel?: string;
}) {
  const actions = useResourceCardActions();
  const { t } = useChatkitTranslation();
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const available = !!actions.openResourceCard;
  const openLabel = customOpenLabel ?? t('resourceCard.open');
  const open = async () => {
    if (!available || busy) return;
    setBusy(true);
    setError(null);
    try {
      const result = await actions.openResourceCard!(card, messageId);
      if (!result.success) {
        const code = result.code;
        setError(
          result.message ??
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
    <ResourceCardLayout
      title={card.data.title}
      description={card.data.description}
      icon={
        <IconDefinitionRenderer
          icon={card.data.icon}
          size={22}
          fallback={<Box className="h-5 w-5 shrink-0 text-muted-foreground" />}
        />
      }
      action={
        <button
          type="button"
          onClick={open}
          disabled={!available || busy}
          aria-label={`${openLabel} ${card.data.title}`}
          className="inline-flex shrink-0 items-center gap-1 rounded-chat-item border border-border px-3 py-1.5 text-sm hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
        >
          {busy && (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          )}
          {openLabel}
        </button>
      }
    >
      {!!card.data.content?.length && (
        <ResourceCardBlocks
          content={card.data.content}
          title={card.data.title}
        />
      )}
      {!available && (
        <p className="mt-2 text-sm text-muted-foreground">
          {disabledReason ?? t('resourceCard.disabled')}
        </p>
      )}
      {error && (
        <p role="alert" className="mt-2 text-sm text-destructive">
          {error}
        </p>
      )}
    </ResourceCardLayout>
  );
}

export function MessageResourceCards({
  message,
  disabledReason,
  openLabel,
}: {
  message: ChatkitMessage;
  /** Context-specific explanation when this card has no opening action. */
  disabledReason?: string;
  /** Describes the actual destination, e.g. a group's authorized published version. */
  openLabel?: string;
  mode?: MessagePresentationMode;
  isStreaming?: boolean;
}) {
  const cards = messageResourceCards(message);
  if (!cards.length) return null;
  return (
    <div className="space-y-2">
      {cards.map((card) => (
        <ResourceCard
          key={card.id}
          disabledReason={disabledReason}
          openLabel={openLabel}
          card={card}
          messageId={card.messageId ?? message.id}
        />
      ))}
    </div>
  );
}
