import type {
  XpertViewFileAccessRequest,
  XpertViewRuntimeScopeInput,
} from '@xpert-ai/xpert-sdk';
import { loadViewFile, type ViewFileClient } from './view-file-access';
import { FileReadQueue } from './file-read-queue';

type ImageFile = { blob: Blob; fileName: string };
type ImageVariant = 'thumbnail' | 'original';
type ImageReference = Pick<
  XpertViewFileAccessRequest,
  'fileKey' | 'targetId'
> & { viewKey: string };

// The SDK adds this optional capability; keep hosts on SDK 0.17 compatible during rollout.
export type ImagePreviewClient = {
  readFilePreview?: (
    hostType: 'agent',
    hostId: string,
    viewKey: string,
    request: Pick<XpertViewFileAccessRequest, 'fileKey' | 'targetId'> & {
      variant?: ImageVariant;
    },
    options?: {
      runtimeScope?: XpertViewRuntimeScopeInput;
      signal?: AbortSignal;
    },
  ) => Promise<ImageFile>;
};

const queues = new WeakMap<object, FileReadQueue<ImageFile>>();
const imageTypes = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
const maxBytes = 50 * 1024 * 1024;

export function loadImagePreview(
  client: ViewFileClient,
  assistantId: string,
  runtimeScope: XpertViewRuntimeScopeInput,
  file: ImageReference,
  signal: AbortSignal,
  variant: ImageVariant,
): Promise<ImageFile> {
  let queue = queues.get(client);
  if (!queue) {
    queue = new FileReadQueue();
    queues.set(client, queue);
  }
  const key = JSON.stringify([
    assistantId,
    file.viewKey,
    runtimeScope.projectId ?? null,
    runtimeScope.conversationId ?? null,
    file.fileKey,
    file.targetId ?? null,
    variant,
  ]);
  return queue.read(
    key,
    signal,
    async (signal) => {
      if (client.readFilePreview) {
        try {
          const result = await client.readFilePreview(
            'agent',
            assistantId,
            file.viewKey,
            {
              fileKey: file.fileKey,
              targetId: file.targetId,
              variant,
            },
            { runtimeScope, signal },
          );
          signal.throwIfAborted();
          if (
            !imageTypes.includes(result.blob.type.split(';')[0].trim()) ||
            result.blob.size > maxBytes
          )
            throw new Error('Resource file unavailable');
          return result;
        } catch (error) {
          signal.throwIfAborted();
          // Old servers may not expose the route; all fallback reads retain file authorization.
          // Never retry an access denial through a different endpoint.
          if (!isPreviewRouteUnavailable(error)) throw error;
        }
      }
      return loadViewFile(
        client,
        assistantId,
        runtimeScope,
        file,
        signal,
        'preview',
        imageTypes,
        maxBytes,
      );
    },
    variant === 'original' ? 0 : 1,
  );
}

function isPreviewRouteUnavailable(error: unknown): boolean {
  return (
    error !== null &&
    typeof error === 'object' &&
    'status' in error &&
    [404, 405, 501].includes(Number(error.status))
  );
}
