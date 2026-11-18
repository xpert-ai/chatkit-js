import * as React from 'react';
import type { ResourceCardFile } from '@xpert-ai/chatkit-types';
import { useResourceCardActions } from '../../../../resource-cards/context';
import { FileTypeIcon } from '../../../task-summary/FileTypeIcon';

/** Historic cards also use the shared Office artwork; never guess format from a business title. */
export function ResourceCardFileIcon({ file }: { file: ResourceCardFile }) {
  const { loadResourceCardFileMetadata } = useResourceCardActions();
  const { viewKey, fileKey, targetId } = file.file;
  const root = React.useRef<HTMLSpanElement>(null);
  const [visible, setVisible] = React.useState(
    typeof IntersectionObserver === 'undefined',
  );
  const [mimeType, setMimeType] = React.useState<string>();
  React.useEffect(() => {
    if (visible || !root.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: '160px' },
    );
    observer.observe(root.current);
    return () => observer.disconnect();
  }, [visible]);
  React.useEffect(() => {
    setMimeType(undefined);
    if (!visible || !loadResourceCardFileMetadata) return;
    const controller = new AbortController();
    void loadResourceCardFileMetadata(
      { viewKey, fileKey, targetId },
      controller.signal,
    )
      .then((metadata) => {
        if (!controller.signal.aborted) setMimeType(metadata.mimeType);
      })
      .catch(() => {
        /* Keep the shared generic file icon when metadata is unavailable. */
      });
    return () => controller.abort();
  }, [visible, loadResourceCardFileMetadata, viewKey, fileKey, targetId]);
  return (
    <span
      ref={root}
      className="chatkit-resource-card-file-icon inline-flex aspect-square w-4/5 items-center justify-center"
    >
      <FileTypeIcon output={{ kind: 'file', mimeType }} />
    </span>
  );
}
