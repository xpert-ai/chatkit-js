import * as React from 'react';
import { previewFileKind } from '../../lib/files/file-types';
import type { FilePreviewContent, FilePreviewLoader } from './types';

/** Each surface owns its cancellation and URL; a thumbnail never owns a tab's URL. */
export function useFilePreviewContent(
  load: FilePreviewLoader | null,
  revision = 0,
) {
  const [attempt, retry] = React.useReducer((n) => n + 1, 0);
  const [state, setState] = React.useState<{
    content?: FilePreviewContent;
    error?: Error;
  }>({});
  React.useEffect(() => {
    const controller = new AbortController();
    let url = '';
    setState({});
    if (load)
      void (async () => {
        const { blob, fileName } = await load(controller.signal);
        controller.signal.throwIfAborted();
        const kind = previewFileKind(fileName, blob.type);
        const textFile = ['text', 'markdown', 'html'].includes(kind);
        const text = textFile ? await blob.text() : '';
        controller.signal.throwIfAborted();
        if (text.includes('\0')) throw new Error('workbench.files.binary');
        if (!textFile && ['image', 'pdf', 'audio', 'video'].includes(kind))
          url = URL.createObjectURL(blob);
        setState({ content: { fileName, kind, url, text } });
      })().catch((error: unknown) => {
        if (!controller.signal.aborted)
          setState({
            error: error instanceof Error ? error : new Error('Preview failed'),
          });
      });
    return () => {
      controller.abort();
      if (url) URL.revokeObjectURL(url);
    };
  }, [load, revision, attempt]);
  const fail = React.useCallback(
    () => setState({ error: new Error('Preview failed') }),
    [],
  );
  return { ...state, retry, fail };
}
