import type { MessagePresentationMode } from '../../../../lib/message-presentation';
import * as React from 'react';
import { Box, Download, ExternalLink, Loader2 } from 'lucide-react';
import {
  parseResourceCardContent,
  upsertResourceCardContent,
  type ChatkitMessage,
  type TMessageContentResourceCard,
} from '@xpert-ai/chatkit-types';
import { useResourceCardActions } from '../../../../resource-cards/context';
import { useChatkitTranslation } from '../../../../i18n/useChatkitTranslation';
import { IconDefinitionRenderer } from '../../../ui/icon-definition';
import { Button } from '../../../ui/button';
import { ResourceCardBlocks } from './content';
import { ResourceCardLayout } from './layout';
import { ResourceCardCover } from './cover';
import { ResourceCardFileIcon } from './file-icon';

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
  const [downloading, setDownloading] = React.useState(false);
  const pendingDownload = React.useRef(false);
  // This is a layout decision on the declared content kind and cardinality.
  // Do not infer file formats or plugin capabilities from titles or resource types.
  const blocks = card.data.content;
  const cover =
    blocks?.length === 2 &&
    blocks[0].kind === 'image-gallery' &&
    !blocks[0].title &&
    blocks[0].images.length === 1 &&
    blocks[1].kind === 'file-list' &&
    !blocks[1].title &&
    blocks[1].files.length === 1
      ? blocks[0].images[0]
      : undefined;
  const fileBlock = cover
    ? blocks?.[1]
    : blocks?.length === 1
      ? blocks[0]
      : undefined;
  const target = card.data.open;
  const file =
    fileBlock?.kind === 'file-list' &&
    !fileBlock.title &&
    fileBlock.files.length === 1
      ? fileBlock.files[0]
      : !blocks?.length && target.target === 'workbench.file'
        ? {
            id: card.data.resource.id,
            title: card.data.title,
            file: {
              viewKey: target.viewKey,
              fileKey: target.fileKey,
              targetId: target.targetId,
            },
          }
        : undefined;
  const available = !!actions.openResourceCard;
  const openLabel = customOpenLabel ?? t('resourceCard.open');
  const download = async () => {
    if (!file || !actions.downloadResourceCardFile || pendingDownload.current)
      return;
    pendingDownload.current = true;
    setDownloading(true);
    setError(null);
    try {
      await actions.downloadResourceCardFile(file);
    } catch {
      setError(t('resourceCard.unavailable'));
    } finally {
      pendingDownload.current = false;
      setDownloading(false);
    }
  };
  const open = async () => {
    const openResourceCard = actions.openResourceCard;
    if (!openResourceCard || busy) return;
    setBusy(true);
    setError(null);
    try {
      const result = await openResourceCard(card, messageId);
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
      description={
        card.data.description || file ? (
          <>
            {card.data.description}
            {file && file.title !== card.data.title && <div>{file.title}</div>}
            {file?.description && <div>{file.description}</div>}
          </>
        ) : undefined
      }
      compact={!!file}
      preview={
        cover ? (
          <ResourceCardCover
            image={cover}
            onOpen={() => void open()}
            disabled={!available || busy}
            openLabel={`${openLabel} ${card.data.title}`}
            fallback={file ? <ResourceCardFileIcon file={file} /> : undefined}
          />
        ) : undefined
      }
      icon={
        file ? (
          <ResourceCardFileIcon file={file} />
        ) : (
          <IconDefinitionRenderer
            icon={card.data.icon}
            size={22}
            fallback={
              <Box className="h-5 w-5 shrink-0 text-muted-foreground" />
            }
          />
        )
      }
      action={
        <div className="ml-auto flex shrink-0 items-center gap-[var(--density-gap,0.5rem)]">
          <Button
            variant="outline"
            type="button"
            onClick={open}
            disabled={!available || busy}
            aria-label={`${openLabel} ${card.data.title}`}
            title={openLabel}
            className={
              file
                ? 'size-[max(2.25rem,calc(2.25rem*var(--density-spacing,1)))] p-0'
                : 'h-[max(2.25rem,calc(2.25rem*var(--density-spacing,1)))] px-[max(0.625rem,var(--density-padding,1rem))]'
            }
          >
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : file ? (
              <ExternalLink className="size-4" aria-hidden="true" />
            ) : null}
            {!file && openLabel}
          </Button>
          {file && (
            <Button
              variant="outline"
              type="button"
              onClick={() => void download()}
              disabled={!actions.downloadResourceCardFile || downloading}
              aria-label={`${t('workbench.files.download')} ${file.title}`}
              title={t('workbench.files.download')}
              aria-busy={downloading}
              className="h-[max(2.25rem,calc(2.25rem*var(--density-spacing,1)))] px-[max(0.625rem,var(--density-padding,1rem))] @max-[28rem]/resource-card:w-[max(2.25rem,calc(2.25rem*var(--density-spacing,1)))] @max-[28rem]/resource-card:p-0"
            >
              {downloading ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <Download className="size-4" aria-hidden="true" />
              )}
              <span className="@max-[28rem]/resource-card:sr-only">
                {t('workbench.files.download')}
              </span>
            </Button>
          )}
        </div>
      }
    >
      {!file && !!card.data.content?.length && (
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
