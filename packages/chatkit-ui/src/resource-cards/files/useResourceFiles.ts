import * as React from 'react';
import type { ResourceCardImage } from '@xpert-ai/chatkit-types';
import { loadResourceCardImage } from './images';
import { useResourceCardFileDownload } from './useFileDownload';
import type { ResourceFileAccessOptions } from './types';

/** Authentication/scope determine access, independently of the host's layout. */
export function useResourceFiles(options: ResourceFileAccessOptions) {
  const { client, assistantId, runtimeScope, available } = options;
  const download = useResourceCardFileDownload(options);
  const loadImage = React.useCallback(
    (image: ResourceCardImage, signal: AbortSignal) => {
      if (!available) return Promise.reject(new Error('Preview unavailable'));
      return loadResourceCardImage(
        client,
        assistantId,
        runtimeScope,
        image,
        signal,
      );
    },
    [available, client, assistantId, runtimeScope],
  );
  return React.useMemo(
    () => ({
      loadResourceCardImage: available ? loadImage : undefined,
      downloadResourceCardFile: available ? download : undefined,
    }),
    [available, loadImage, download],
  );
}
