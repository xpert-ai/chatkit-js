import { useMemo } from 'react';
import type { Client } from '@xpert-ai/xpert-sdk';
import { ArtifactPresentationView } from '../../../workbench/presentation/ArtifactPresentationView';
import { groupArtifactSource } from './group-artifact-presentation';

export function GroupArtifactViewer({
  client,
  groupId,
  referenceId,
}: {
  client: Client;
  groupId: string;
  referenceId: string;
}) {
  const source = useMemo(
    () => groupArtifactSource(client, groupId, referenceId),
    [client, groupId, referenceId],
  );
  return <ArtifactPresentationView source={source} />;
}
