import type { WorkbenchContextValue } from '../context';
import { parsePreview } from '../client-command-payload';
import { workspaceFileScope } from '../native/files/workspace-file-access';
import { validRelativePath } from '../native/files/workspace-file-utils';
import { useArtifactActions } from './useArtifactActions';

/** Summary entries use the same file/editor and browser routes as the Workbench. */
export function useOutputResourceActions(
  options: Parameters<typeof useArtifactActions>[0] & { onError(): void },
) {
  const artifacts = useArtifactActions(options);
  const { stream, enabled, authenticated, openWorkspaceFile, openPreview } =
    options;
  const openSummaryResource: NonNullable<
    WorkbenchContextValue['openSummaryResource']
  > = (resource, context) => {
    if (
      !enabled ||
      !authenticated ||
      stream.runtimeScopeReady === false ||
      (context.conversationId &&
        context.conversationId !== stream.conversationId)
    )
      return false;
    if (resource.type === 'workspace_file') {
      if (!workspaceFileScope(stream)) return false;
      if (!validRelativePath(resource.workspacePath)) options.onError();
      else
        openWorkspaceFile({
          filePath: resource.workspacePath,
          mimeType: context.mimeType,
        });
      return true;
    }
    if (
      resource.type === 'url' ||
      (resource.type === 'browser' && resource.url)
    ) {
      const preview = parsePreview(
        'browser',
        { url: resource.url, title: context.title },
        stream.apiUrl,
      );
      if (preview) openPreview(preview);
      else options.onError();
      return true;
    }
    return false;
  };
  return { ...artifacts, openSummaryResource };
}
