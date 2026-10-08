import type { ResourceCardFileReference } from '@xpert-ai/chatkit-types';
import type { XpertViewRuntimeScopeInput } from '@xpert-ai/xpert-sdk';

import type { ResourceFileClient } from './types';

/** All resource blocks share scoped file access; MIME and filenames come from the grant. */
export async function loadResourceCardFile(
  client: ResourceFileClient,
  assistantId: string,
  runtimeScope: XpertViewRuntimeScopeInput,
  file: ResourceCardFileReference,
  signal: AbortSignal,
  purpose: 'preview' | 'download',
  acceptedMimeTypes?: readonly string[],
  maxBytes = Infinity,
): Promise<{ blob: Blob; fileName: string }> {
  signal.throwIfAborted();
  const session = await client.createFileAccessSession(
    'agent',
    assistantId,
    file.viewKey,
    { runtimeScope, signal },
  );
  try {
    signal.throwIfAborted();
    const grant = await client.createFileAccessGrant(
      session.sessionId,
      { fileKey: file.fileKey, targetId: file.targetId, purpose },
      { runtimeScope, signal },
    );
    if (
      (acceptedMimeTypes && !acceptedMimeTypes.includes(grant.mimeType)) ||
      (grant.size ?? 0) > maxBytes
    )
      throw new Error('Resource file unavailable');
    const blob = await client.readFileAccess(grant.url, { signal });
    signal.throwIfAborted();
    if (blob.size > maxBytes) throw new Error('Resource file unavailable');
    return {
      blob: new Blob([blob], { type: grant.mimeType }),
      fileName: grant.fileName,
    };
  } finally {
    // Cleanup must still run after cancellation, without the aborted read signal.
    await client
      .revokeFileAccessSession(session.sessionId)
      .catch(() => undefined);
  }
}
