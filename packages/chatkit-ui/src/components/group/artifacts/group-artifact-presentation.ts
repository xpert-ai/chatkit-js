import type { Client, GroupArtifactReference } from '@xpert-ai/xpert-sdk';
import type { PresentationSource } from '../../../workbench/presentation/source';

export const groupArtifactTabKey = (groupId: string, referenceId: string) =>
  `chatkit.preview.presentation:${JSON.stringify([groupId, referenceId])}`;

/** Group authorization stays here; never resolve the source project through the content catalog. */
export function groupArtifactSource(
  client: Client,
  groupId: string,
  referenceId: string,
): PresentationSource {
  return {
    async read(signal) {
      const view = await client.groups.artifacts.read(groupId, referenceId, {
        signal,
      });
      if (
        view.reference.groupId !== groupId ||
        view.reference.id !== referenceId
      )
        throw new Error('Reference changed');
      return view.content.presentation;
    },
    query: (request, signal) =>
      client.groups.artifacts.query(groupId, referenceId, request, { signal }),
  };
}
export function groupArtifactPreview(
  client: Client,
  groupId: string,
  reference: GroupArtifactReference,
) {
  return {
    kind: 'presentation' as const,
    key: groupArtifactTabKey(groupId, reference.id),
    title: reference.title,
    source: groupArtifactSource(client, groupId, reference.id),
  };
}
