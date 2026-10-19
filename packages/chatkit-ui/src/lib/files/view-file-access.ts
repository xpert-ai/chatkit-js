import type {
  Client,
  XpertViewFileAccessRequest,
  XpertViewRuntimeScopeInput,
} from '@xpert-ai/xpert-sdk';

export type ViewFileClient = Pick<
  Client['viewHosts'],
  | 'createFileAccessSession'
  | 'createFileAccessGrant'
  | 'readFileAccess'
  | 'revokeFileAccessSession'
>;
type ViewFileReference = Pick<
  XpertViewFileAccessRequest,
  'fileKey' | 'targetId'
> & { viewKey: string };

/** Views and resource cards share scoped file access; MIME and filenames come from the grant. */
export async function loadViewFile(
  client: ViewFileClient,
  assistantId: string,
  runtimeScope: XpertViewRuntimeScopeInput,
  file: ViewFileReference,
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
    const assertGrant = () => {
      signal.throwIfAborted();
      const expiresAt = Date.parse(grant.expiresAt);
      if (!Number.isFinite(expiresAt) || expiresAt <= Date.now())
        throw new Error('File access grant has expired.');
    };
    assertGrant();
    if (
      (acceptedMimeTypes && !acceptedMimeTypes.includes(grant.mimeType)) ||
      (grant.size ?? 0) > maxBytes
    )
      throw new Error('Resource file unavailable');
    const blob = await client.readFileAccess(grant.url, { signal });
    assertGrant();
    if (blob.size > maxBytes) throw new Error('Resource file unavailable');
    return {
      blob: blob.slice(
        0,
        blob.size,
        grant.mimeType.split(';')[0].trim().toLowerCase(),
      ),
      fileName: grant.fileName,
    };
  } finally {
    // Cleanup must still run after cancellation, without the aborted read signal.
    await client
      .revokeFileAccessSession(session.sessionId)
      .catch(() => undefined);
  }
}
