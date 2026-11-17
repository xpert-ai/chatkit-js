import type { ResourceCardFileReference } from '@xpert-ai/chatkit-types';
import type {
  XpertViewFileAccessGrantResult,
  XpertViewRuntimeScopeInput,
} from '@xpert-ai/xpert-sdk';
import type { ResourceFileClient } from './types';

/** Resolve authoritative file type without downloading document bytes or retaining a grant URL. */
export async function loadResourceCardFileMetadata(
  client: Pick<
    ResourceFileClient,
    | 'createFileAccessSession'
    | 'createFileAccessGrant'
    | 'revokeFileAccessSession'
  >,
  assistantId: string,
  runtimeScope: XpertViewRuntimeScopeInput,
  file: ResourceCardFileReference,
  signal: AbortSignal,
): Promise<Pick<XpertViewFileAccessGrantResult, 'mimeType'>> {
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
      {
        fileKey: file.fileKey,
        targetId: file.targetId,
        purpose: 'download',
      },
      { runtimeScope, signal },
    );
    signal.throwIfAborted();
    if (
      !Number.isFinite(Date.parse(grant.expiresAt)) ||
      Date.parse(grant.expiresAt) <= Date.now()
    )
      throw new Error('File access grant has expired.');
    return { mimeType: grant.mimeType };
  } finally {
    // Metadata lookup never consumes the download URL; release even after denial or cancellation.
    await client
      .revokeFileAccessSession(session.sessionId)
      .catch(() => undefined);
  }
}
