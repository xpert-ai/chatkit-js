import type { ChatTaskSummaryOutput } from '@xpert-ai/chatkit-types';
import type { ResourceFileWorkbenchPreview } from '../preview/types';
import { downloadBlob } from '../../lib/files/download';

export type ArtifactIdentity = {
  artifactId: string;
  artifactVersionId: string;
};
export type ArtifactOpenOptions = Pick<
  ChatTaskSummaryOutput,
  'title' | 'mimeType' | 'workspacePath'
> & { fileName: string; conversationId?: string };

/** Always read the delivered version; workspace editing is a separate action. */
export function createArtifactPreview(
  resource: ArtifactIdentity,
  options: ArtifactOpenOptions,
  request: (signal: AbortSignal) => Promise<Blob>,
  edit?: () => void,
): ResourceFileWorkbenchPreview {
  const load = async (signal: AbortSignal) => {
    const blob = await request(signal);
    signal.throwIfAborted();
    if (blob.size > 64 * 1024 * 1024) throw new Error('File too large');
    return { blob, fileName: options.fileName };
  };
  return {
    key: `chatkit.preview.artifact:${resource.artifactId}:${resource.artifactVersionId}`,
    kind: 'resource-file',
    savedVersion: true,
    title: options.title,
    edit,
    source: {
      load,
      download: async (signal) => {
        const file = await load(signal);
        signal.throwIfAborted();
        downloadBlob(
          file.blob,
          file.fileName.split('/').pop() ?? file.fileName,
        );
      },
    },
  };
}
