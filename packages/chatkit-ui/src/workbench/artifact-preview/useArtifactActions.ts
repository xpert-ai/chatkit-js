import * as React from 'react';
import type { ChatKitQuoteReference } from '@xpert-ai/chatkit-types';
import type { XpertWorkspaceFile } from '@xpert-ai/xpert-sdk';
import type { WorkbenchRuntime } from '../WorkbenchRuntime';
import type { WorkbenchContextValue } from '../context';
import type { WorkbenchPreview } from '../preview/types';
import { createHtmlArtifactPreview } from '../html-preview/html-artifact-preview';
import { editableKinds, fileKind } from '../../lib/files/file-types';
import { validRelativePath } from '../native/files/workspace-file-utils';
import { createArtifactPreview } from './artifact-preview';
import {
  canWriteWorkspaceFile,
  workspaceFileScope,
} from '../native/files/workspace-file-access';

export function useArtifactActions({
  stream,
  enabled,
  authenticated,
  openPreview,
  openWorkspaceFile,
  onAnnotate,
  unavailableMessage,
}: {
  stream: WorkbenchRuntime;
  enabled: boolean;
  authenticated: boolean;
  openPreview: (preview: WorkbenchPreview) => void;
  openWorkspaceFile: (file: XpertWorkspaceFile) => void;
  onAnnotate: (reference: ChatKitQuoteReference) => Promise<void>;
  unavailableMessage: string;
}): Pick<WorkbenchContextValue, 'openArtifact' | 'openHtmlArtifact'> {
  const scope = JSON.stringify([
    stream.apiUrl,
    stream.organizationId,
    stream.assistantId,
    stream.projectId,
    stream.conversationId,
    enabled,
    authenticated,
    stream.runtimeScopeReady,
  ]);
  const currentScope = React.useRef(scope);
  const pending = React.useRef(new Set<AbortController>());
  currentScope.current = scope;
  React.useEffect(() => {
    currentScope.current = scope;
    const requests = pending.current;
    return () => {
      currentScope.current = '';
      requests.forEach((controller) => controller.abort());
      requests.clear();
    };
  }, [scope]);
  const openArtifact: NonNullable<WorkbenchContextValue['openArtifact']> = (
    resource,
    options,
  ) => {
    const conversationId = stream.conversationId;
    if (
      !enabled ||
      !authenticated ||
      stream.runtimeScopeReady === false ||
      !conversationId ||
      (options.conversationId && options.conversationId !== conversationId)
    )
      return false;
    const request = (signal: AbortSignal) => {
      if (currentScope.current !== scope)
        return Promise.reject(new Error(unavailableMessage));
      return stream.client.workbench.downloadArtifact(
        conversationId,
        resource,
        { signal },
      );
    };
    const path = options.workspacePath;
    const fileScope = workspaceFileScope(stream);
    if (fileKind(options.fileName, options.mimeType) === 'markdown') {
      const fallback = () =>
        openPreview(createArtifactPreview(resource, options, request));
      if (!path || !validRelativePath(path) || !fileScope) {
        fallback();
        return true;
      }
      const controller = new AbortController();
      pending.current.add(controller);
      void stream.client.workbench
        .readFile(fileScope, path, { signal: controller.signal })
        .then((document) => {
          if (controller.signal.aborted || currentScope.current !== scope)
            return;
          if (canWriteWorkspaceFile(document))
            openWorkspaceFile({ filePath: path, mimeType: options.mimeType });
          else fallback();
        })
        .catch(() => {
          if (!controller.signal.aborted && currentScope.current === scope)
            fallback();
        })
        .finally(() => pending.current.delete(controller));
      return true;
    }
    const edit =
      path &&
      validRelativePath(path) &&
      stream.assistantId &&
      editableKinds.includes(fileKind(path, options.mimeType))
        ? () => {
            if (currentScope.current === scope)
              openWorkspaceFile({ filePath: path, mimeType: options.mimeType });
          }
        : undefined;
    if (
      options.mimeType?.split(';')[0].trim().toLowerCase() === 'text/html' ||
      fileKind(options.fileName, options.mimeType) === 'html'
    ) {
      openPreview({
        ...createHtmlArtifactPreview(
          resource,
          options.title,
          request,
          unavailableMessage,
          onAnnotate,
        ),
        edit,
      });
    } else {
      openPreview(createArtifactPreview(resource, options, request, edit));
    }
    return true;
  };
  return {
    openArtifact,
    openHtmlArtifact: (resource, title) =>
      openArtifact(resource, {
        title,
        fileName: title,
        mimeType: 'text/html',
      }),
  };
}
