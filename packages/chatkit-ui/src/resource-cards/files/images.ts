import type { ResourceCardImage } from '@xpert-ai/chatkit-types';
import type { ResourceFileAccessOptions } from './types';
import { loadResourceCardFile } from './access';

/** Image galleries use the same authorization as other file blocks. */
export async function loadResourceCardImage(
  client: ResourceFileAccessOptions['client'],
  assistantId: string,
  runtimeScope: ResourceFileAccessOptions['runtimeScope'],
  image: ResourceCardImage,
  signal: AbortSignal,
): Promise<Blob> {
  const { blob } = await loadResourceCardFile(
    client,
    assistantId,
    runtimeScope,
    image.file,
    signal,
    'preview',
    ['image/png', 'image/jpeg', 'image/webp', 'image/gif'],
    50 * 1024 * 1024,
  );
  return blob;
}
