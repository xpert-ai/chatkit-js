import type { ChatKitWorkbenchFileResource } from '@xpert-ai/chatkit-types';
import type {
  XpertViewFileAccessPurpose,
  XpertViewRuntimeScopeInput,
} from '@xpert-ai/xpert-sdk';
import { downloadBlob } from '../../lib/files/download';
import type { ResourceFileWorkbenchPreview } from '../preview/types';
import { isCompatiblePreviewType } from '../../lib/files/file-types';

import {
  loadViewFile,
  type ViewFileClient,
} from '../../lib/files/view-file-access';

type ViewFileContext = {
  hostId: string;
  viewKey: string;
  runtimeScope: XpertViewRuntimeScopeInput;
  isCurrent: () => boolean;
};

/** Authenticated bytes stay in the host. Each read gets a purpose-specific grant. */
export class ViewFilePreviewAccess {
  private epoch = 0;
  private controllers = new Set<AbortController>();
  private identity = crypto.randomUUID();

  constructor(private readonly client: ViewFileClient) {}

  clear() {
    this.epoch += 1;
    for (const controller of this.controllers) controller.abort();
    this.controllers.clear();
  }

  async open(
    resource: ChatKitWorkbenchFileResource,
    context: ViewFileContext,
  ): Promise<ResourceFileWorkbenchPreview> {
    const epoch = this.epoch;
    const assertCurrent = () => {
      if (epoch !== this.epoch || !context.isCurrent())
        throw new Error('File preview context is no longer active.');
    };
    const read = async (
      purpose: XpertViewFileAccessPurpose,
      caller?: AbortSignal,
    ) => {
      assertCurrent();
      caller?.throwIfAborted();
      const controller = new AbortController();
      const cancel = () => controller.abort();
      caller?.addEventListener('abort', cancel, { once: true });
      this.controllers.add(controller);
      const timeout = setTimeout(cancel, 30_000);
      const { signal } = controller;
      try {
        const file = await loadViewFile(
          this.client,
          context.hostId,
          context.runtimeScope,
          { ...resource, viewKey: context.viewKey },
          signal,
          purpose,
        );
        assertCurrent();
        if (
          purpose === 'preview' &&
          !isCompatiblePreviewType(file.fileName, file.blob.type)
        )
          throw new Error('File type does not match its preview renderer.');
        return file;
      } finally {
        clearTimeout(timeout);
        caller?.removeEventListener('abort', cancel);
        this.controllers.delete(controller);
      }
    };
    const file = await read('preview');
    assertCurrent();
    return {
      kind: 'resource-file',
      key: `chatkit.preview.view-file:${JSON.stringify([this.identity, epoch, context.hostId, context.viewKey, context.runtimeScope, resource.fileKey, resource.targetId])}`,
      title: file.fileName,
      source: {
        load: async (signal) => {
          signal.throwIfAborted();
          assertCurrent();
          return file;
        },
        download: async (signal) => {
          const original = await read('download', signal);
          signal.throwIfAborted();
          assertCurrent();
          downloadBlob(original.blob, original.fileName);
        },
      },
    };
  }
}
