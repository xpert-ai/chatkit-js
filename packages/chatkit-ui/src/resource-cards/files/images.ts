import type { ResourceCardImage } from '@xpert-ai/chatkit-types';
import type { ResourceFileAccessOptions } from './types';
import { loadImagePreview } from '../../lib/files/image-preview';

/** Image galleries use the same authorization as other file blocks. */
export async function loadResourceCardImage(
  client: ResourceFileAccessOptions['client'],
  assistantId: string,
  runtimeScope: ResourceFileAccessOptions['runtimeScope'],
  image: ResourceCardImage,
  signal: AbortSignal,
): Promise<Blob> {
  const { blob } = await loadImagePreview(
    client,
    assistantId,
    runtimeScope,
    image.file,
    signal,
    'thumbnail',
  );
  return blob;
}
