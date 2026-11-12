import { A2UIProvider } from '@xpert-ai/a2ui-react';
import {
  ResourceCardContext,
  unavailableResourceCardActions,
} from '../../resource-cards/context';
import { useChatkitTranslation } from '../../i18n/useChatkitTranslation';
import { WidgetMessage } from '../thread/messages/widget';
import { HistoricalMcpAppResult } from '../thread/messages/historical-mcp-app-result';
import { MessageResourceCards } from '../thread/messages/resource-cards';
import type { GroupDisplay } from './group-display';
import type { ResourceCardActions } from '../../resource-cards/types';
import { Info } from 'lucide-react';

/** Snapshots never inherit source authority. Resource navigation must use the receiving group's explicit resolver. */
export function GroupMessageDisplay({
  messageId,
  blocks,
  onOpenResourceCard,
}: {
  messageId: string;
  blocks: GroupDisplay[];
  onOpenResourceCard?: ResourceCardActions['openResourceCard'];
}) {
  const { t } = useChatkitTranslation();
  if (!blocks.length) return null;
  return (
    <div
      className="w-full space-y-3 text-sm text-foreground"
      data-testid="group-display"
    >
      <ResourceCardContext.Provider value={unavailableResourceCardActions}>
        <A2UIProvider>
          {blocks.map((block) =>
            block.kind === 'resource' ? (
              <ResourceCardContext.Provider
                key={block.id}
                value={
                  block.card.data.resource.artifactId && onOpenResourceCard
                    ? { openResourceCard: onOpenResourceCard }
                    : unavailableResourceCardActions
                }
              >
                <MessageResourceCards
                  disabledReason={t('group.snapshotResource.disabled')}
                  openLabel={t('group.snapshotResource.open')}
                  message={{
                    id: messageId,
                    type: 'assistant',
                    content: [block.card],
                  }}
                />
              </ResourceCardContext.Provider>
            ) : block.kind === 'mcp' ? (
              <HistoricalMcpAppResult key={block.id} data={block.data} />
            ) : (
              <section
                key={block.id}
                aria-label={t('group.resultSnapshotLabel')}
                className="min-w-0 rounded-chat-panel border border-border bg-background text-foreground p-[var(--density-padding,1rem)]"
              >
                <details className="mb-[var(--density-gap,0.5rem)] text-xs text-muted-foreground">
                  <summary className="flex w-fit cursor-pointer list-none items-center gap-1.5 rounded-chat-item py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
                    {t('group.resultSnapshotLabel')}
                    <Info className="size-3.5" aria-hidden="true" />
                  </summary>
                  <p className="py-2 leading-relaxed">
                    {t('group.resultSnapshot')}
                  </p>
                </details>
                <WidgetMessage
                  messageId={`${messageId}-${block.id}`}
                  data={block.data}
                  readOnly
                />
              </section>
            ),
          )}
        </A2UIProvider>
      </ResourceCardContext.Provider>
    </div>
  );
}
