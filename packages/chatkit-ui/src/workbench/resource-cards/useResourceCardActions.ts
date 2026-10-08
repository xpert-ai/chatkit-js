import * as React from 'react';
import type {
  ResourceCardFileReference,
  ResourceCardOpenTarget,
} from '@xpert-ai/chatkit-types';
import { loadResourceCardFile } from '../../resource-cards/files/access';
import { useResourceFiles } from '../../resource-cards/files/useResourceFiles';
import type { ResourceFileAccessOptions } from '../../resource-cards/files/types';
import type {
  ResourceCardActions,
  ResourceCardOpenResult,
} from '../../resource-cards/types';
import type { WorkbenchPreview } from '../preview/types';

type NavigationTarget = Exclude<
  ResourceCardOpenTarget,
  { target: 'workbench.file' }
>;
type Options = ResourceFileAccessOptions & {
  canOpen: boolean;
  openPreview: (preview: WorkbenchPreview) => void;
  navigate: (
    target: NavigationTarget,
    origin: { messageId: string; id: string },
  ) => Promise<unknown>;
  remember: (target: ResourceCardOpenTarget) => void;
};

/** Adapt resource actions to tabs/navigation without exposing Workbench state to cards. */
export function useWorkbenchResourceCardActions(
  options: Options,
): ResourceCardActions {
  const {
    client,
    assistantId,
    runtimeScope,
    available,
    canOpen,
    openPreview,
    navigate,
    remember,
  } = options;
  const files = useResourceFiles(options);
  return React.useMemo(() => {
    if (!available || !canOpen) return files;
    const openFile = (
      file: ResourceCardFileReference,
      title: string,
      previewFile = file,
    ) =>
      openPreview({
        key: `chatkit.preview.resource-file:${JSON.stringify(file)}`,
        kind: 'resource-file',
        title,
        source: {
          load: (signal) =>
            loadResourceCardFile(
              client,
              assistantId,
              runtimeScope,
              previewFile,
              signal,
              'preview',
            ),
          download: () =>
            files.downloadResourceCardFile!({
              id: JSON.stringify(file),
              title,
              file,
            }),
        },
      });
    return {
      ...files,
      openResourceCardImage: (image) => openFile(image.file, image.title),
      openResourceCard: async (
        card,
        messageId,
      ): Promise<ResourceCardOpenResult> => {
        const target = card.data.open;
        if (target.target === 'workbench.file') {
          const file = {
            viewKey: target.viewKey,
            fileKey: target.fileKey,
            targetId: target.targetId,
          };
          openFile(file, card.data.title, target.previewFile);
          return { success: true, status: 'opened' };
        }
        const result = await navigate(target, { messageId, id: card.id });
        if (
          result &&
          typeof result === 'object' &&
          'success' in result &&
          result.success === true
        ) {
          remember(target);
          return { success: true, status: 'opened' };
        }
        return {
          success: false,
          code:
            result &&
            typeof result === 'object' &&
            'code' in result &&
            typeof result.code === 'string'
              ? result.code
              : 'unavailable',
        };
      },
    };
  }, [
    available,
    canOpen,
    files,
    client,
    assistantId,
    runtimeScope,
    openPreview,
    navigate,
    remember,
  ]);
}
