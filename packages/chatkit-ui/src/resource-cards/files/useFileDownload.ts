import * as React from 'react';
import type { ResourceCardFile } from '@xpert-ai/chatkit-types';
import type { ResourceFileAccessOptions } from './types';
import { loadResourceCardFile } from './access';
import { downloadBlob } from '../../lib/files/download';

/** Downloads belong to the current assistant/project scope, just like previews. */
export function useResourceCardFileDownload({
  client,
  assistantId,
  runtimeScope,
  available,
}: ResourceFileAccessOptions) {
  const scope = React.useMemo(
    () => ({ controllers: new Set<AbortController>(), disposed: false }),
    [client, assistantId, runtimeScope, available],
  );
  React.useEffect(() => {
    scope.disposed = false;
    return () => {
      scope.disposed = true;
      for (const controller of scope.controllers) controller.abort();
      scope.controllers.clear();
    };
  }, [scope]);
  return React.useCallback(
    async (file: ResourceCardFile) => {
      if (!available || scope.disposed)
        throw new Error('Resource file unavailable');
      const controller = new AbortController();
      scope.controllers.add(controller);
      try {
        const result = await loadResourceCardFile(
          client,
          assistantId,
          runtimeScope,
          file.file,
          controller.signal,
          'download',
        );
        controller.signal.throwIfAborted();
        downloadBlob(result.blob, result.fileName);
      } finally {
        scope.controllers.delete(controller);
      }
    },
    [client, assistantId, runtimeScope, available, scope],
  );
}
