import { useRef, useState } from 'react';
import type { ChatGroupResourceLink } from '@xpert-ai/xpert-sdk';
import { Box, Loader2, Share2 } from 'lucide-react';
import { useChatkitTranslation } from '../../../i18n/useChatkitTranslation';
import { Button } from '../../ui/button';
import { IconDefinitionRenderer } from '../../ui/icon-definition';
import { ResourceCardLayout } from '../../thread/messages/resource-cards/layout';

export type OpenGroupResource = (
  link: ChatGroupResourceLink,
) => void | Promise<void>;

function GroupResourceCard({
  link,
  onOpen,
}: {
  link: ChatGroupResourceLink;
  onOpen?: OpenGroupResource;
}) {
  const { t } = useChatkitTranslation();
  const pending = useRef(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const shared = link.resource.kind === 'group-reference';
  const open = async () => {
    if (!onOpen || pending.current) return;
    pending.current = true;
    setBusy(true);
    setFailed(false);
    try {
      await onOpen(link);
    } catch {
      setFailed(true);
    } finally {
      pending.current = false;
      setBusy(false);
    }
  };
  return (
    <ResourceCardLayout
      title={link.title}
      icon={
        <IconDefinitionRenderer
          icon={link.icon}
          size={24}
          fallback={
            shared ? (
              <Share2 className="size-5 text-muted-foreground" />
            ) : (
              <Box className="size-5 text-muted-foreground" />
            )
          }
        />
      }
      description={t(
        shared ? 'group.resourceCard.shared' : 'group.resourceCard.project',
      )}
      action={
        <Button
          variant="outline"
          onClick={() => void open()}
          disabled={!onOpen || busy}
          aria-busy={busy}
          aria-label={`${t('resourceCard.open')} ${link.title}`}
        >
          {busy && (
            <Loader2
              className="size-4 animate-spin motion-reduce:animate-none"
              aria-hidden="true"
            />
          )}
          {t('resourceCard.open')}
        </Button>
      }
    >
      {!onOpen && (
        <p className="mt-2 text-sm text-muted-foreground">
          {t('resourceCard.disabled')}
        </p>
      )}
      {failed && (
        <p role="alert" className="mt-2 text-sm text-destructive">
          {t('resourceCard.unavailable')}
        </p>
      )}
    </ResourceCardLayout>
  );
}

/** Persisted locators are opened through the current group's Workbench adapter, never a source card's action. */
export function GroupResourceCards({
  links,
  onOpen,
}: {
  links: ChatGroupResourceLink[];
  onOpen?: OpenGroupResource;
}) {
  return (
    <div
      className="w-full min-w-0 space-y-[var(--density-gap,0.5rem)]"
      data-testid="group-resource-cards"
    >
      {links.map((link) => (
        <GroupResourceCard
          key={`${link.resource.kind}:${link.resource.id}`}
          link={link}
          onOpen={onOpen}
        />
      ))}
    </div>
  );
}
