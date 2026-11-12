import { useCallback, useEffect, useRef } from 'react';
import type { Client, GroupArtifactReference } from '@xpert-ai/xpert-sdk';
import type {
  ResourceCardActions,
  ResourceCardOpenResult,
} from '../../../resource-cards/types';
import { useWorkbench } from '../../../workbench/context';
import { useChatkitTranslation } from '../../../i18n/useChatkitTranslation';
import { groupArtifactPreview } from './group-artifact-presentation';

/**
 * Snapshot identity is only a lookup hint. Resolve a live, accepted group reference on every click.
 * Never execute the source card's navigation parameters or borrow its authoring/file/App authority.
 */
export function useGroupResourceCardActions(
  client: Client,
  groupId: string,
): ResourceCardActions['openResourceCard'] {
  const { openPresentation } = useWorkbench();
  const { t } = useChatkitTranslation();
  const active = useRef({ client, groupId });
  active.current = { client, groupId };
  const pending = useRef<AbortController | null>(null);
  useEffect(() => () => pending.current?.abort(), [client, groupId]);
  const open = useCallback<
    NonNullable<ResourceCardActions['openResourceCard']>
  >(
    async (card) => {
      const artifactId = card.data.resource.artifactId;
      const failure = (
        code: 'unavailable' | 'ambiguous' | 'failed',
      ): ResourceCardOpenResult => ({
        success: false,
        code,
        message: t(`group.snapshotResource.${code}`),
      });
      if (
        !openPresentation ||
        !artifactId ||
        active.current.client !== client ||
        active.current.groupId !== groupId
      )
        return failure('unavailable');
      pending.current?.abort();
      const controller = new AbortController();
      pending.current = controller;
      const current = () =>
        !controller.signal.aborted &&
        active.current.client === client &&
        active.current.groupId === groupId;
      try {
        let offset: number | null = 0;
        let match: GroupArtifactReference | undefined;
        while (offset !== null) {
          const page = await client.groups.artifacts.list(
            groupId,
            { offset, limit: 100 },
            { signal: controller.signal },
          );
          if (!current()) return failure('unavailable');
          for (const reference of page.items) {
            if (
              reference.groupId !== groupId ||
              reference.artifactId !== artifactId
            )
              continue;
            if (match && match.id !== reference.id) return failure('ambiguous');
            match = reference;
          }
          if (
            page.nextOffset !== null &&
            (page.nextOffset <= offset || page.nextOffset > 100_000)
          )
            return failure('failed');
          offset = page.nextOffset;
        }
        if (!match) return failure('unavailable');
        // Listing is not an enduring grant: recheck membership, revocation, version and Project before navigation.
        const view = await client.groups.artifacts.read(groupId, match.id, {
          signal: controller.signal,
        });
        if (!current()) return failure('unavailable');
        if (
          view.reference.groupId !== groupId ||
          view.reference.id !== match.id ||
          view.reference.artifactId !== artifactId ||
          view.reference.versionId !== match.versionId ||
          view.reference.runtimeProjectId !== match.runtimeProjectId
        )
          return failure('unavailable');
        openPresentation(groupArtifactPreview(client, groupId, view.reference));
        return { success: true, status: 'opened' };
      } catch {
        return failure('failed');
      }
    },
    [client, groupId, openPresentation, t],
  );
  return openPresentation ? open : undefined;
}
