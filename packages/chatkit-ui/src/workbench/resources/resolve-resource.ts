import { z } from 'zod';
import type { Client } from '@xpert-ai/xpert-sdk';
import { groupArtifactPreview } from '../../components/group/artifacts/group-artifact-presentation';

const targetSchema = z.discriminatedUnion('kind', [
  z
    .object({ kind: z.literal('project-content'), id: z.string().uuid() })
    .strict(),
  z
    .object({ kind: z.literal('group-reference'), id: z.string().uuid() })
    .strict(),
]);

/** Resource types belong to plugins; transport and audience selection belong to this host adapter. */
export async function resolveWorkbenchResource(
  payload: unknown,
  host: {
    client: Client;
    assistantId: string;
    projectId: string;
    groupId?: string;
    isCurrent: () => boolean;
    signal?: AbortSignal;
  },
) {
  const target = targetSchema.parse(payload);
  if (host.signal?.aborted || !host.isCurrent())
    throw new Error('Resource context changed');
  if (target.kind === 'group-reference') {
    if (!host.groupId) throw new Error('Group resource context required');
    const view = await host.client.groups.artifacts.read(
      host.groupId,
      target.id,
      { signal: host.signal },
    );
    if (host.signal?.aborted || !host.isCurrent())
      throw new Error('Resource context changed');
    if (
      view.reference.id !== target.id ||
      view.reference.groupId !== host.groupId ||
      view.reference.runtimeProjectId !== host.projectId ||
      view.content.kind !== 'presentation'
    )
      throw new Error('Resource reference changed');
    return {
      kind: 'presentation' as const,
      preview: groupArtifactPreview(host.client, host.groupId, view.reference),
    };
  }
  const resolved = await host.client.content.resolve(
    { assistantId: host.assistantId, projectId: host.projectId },
    { providerKey: 'platform.content.catalog', resourceId: target.id },
    { signal: host.signal },
  );
  if (host.signal?.aborted || !host.isCurrent())
    throw new Error('Resource context changed');
  return {
    kind: 'content' as const,
    navigation: {
      target: 'workbench.view' as const,
      viewKey: resolved.viewKey,
      selectionId: resolved.selectionId ?? target.id,
      parameters: resolved.parameters,
    },
  };
}
