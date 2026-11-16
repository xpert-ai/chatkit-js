import { useEffect, useRef } from 'react';
import type { ContentClient, XpertWorkspaceFile } from '@xpert-ai/xpert-sdk';
import { fileKind } from '../../lib/files/file-types';

/** File bytes and editing live in the installed editor. Host code only resolves and opens its view. */
export function useFileEditorNavigation(options: {
  api: ContentClient;
  assistantId?: string | null;
  projectId?: string | null;
  ready: boolean;
  native: (file: XpertWorkspaceFile, fromTab?: string) => void;
  navigate: (navigation: {
    target: string;
    viewKey: string;
    selectionId?: string;
    parameters?: object;
  }) => Promise<unknown>;
  failed: () => void;
}) {
  const current = useRef(options);
  const scope = useRef({ options });
  if (
    scope.current.options.api !== options.api ||
    scope.current.options.assistantId !== options.assistantId ||
    scope.current.options.projectId !== options.projectId ||
    scope.current.options.ready !== options.ready
  )
    scope.current = { options };
  current.current = options;
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  return (file: XpertWorkspaceFile, fromTab?: string) => {
    if (!['pptx', 'docx', 'pdf'].includes(fileKind(file.filePath, file.mimeType)))
      return options.native(file, fromTab);
    const { assistantId, projectId, api } = options;
    if (!assistantId || !projectId || !options.ready) {
      options.failed();
      return;
    }
    // Scope identity must change even when the user switches away and back to the same Project.
    const context = scope.current;
    const isCurrent = () => alive.current && scope.current === context;
    void (async () => {
      const resolved = await api.resolveFile(
        { assistantId, projectId },
        { path: file.filePath },
      );
      if (!isCurrent()) return;
      const result = await current.current.navigate({
        target: 'workbench.view',
        ...resolved,
      });
      if (
        isCurrent() &&
        typeof result === 'object' &&
        result &&
        'success' in result &&
        result.success === false
      )
        current.current.failed();
    })().catch(() => {
      if (isCurrent()) current.current.failed();
    });
  };
}
