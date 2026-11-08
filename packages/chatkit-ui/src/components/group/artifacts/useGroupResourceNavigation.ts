import { useCallback, useEffect, useRef } from 'react';
import type {
  ChatGroupResourceLink,
  ChatGroupResourceOpenRequest,
  Client,
} from '@xpert-ai/xpert-sdk';
import { useWorkbenchRuntime } from '../../../workbench/WorkbenchRuntime';
import { useWorkbench } from '../../../workbench/context';
import { groupArtifactPreview } from './group-artifact-presentation';

/** Group credentials and reference resolution stay outside the generic Workbench presentation layer. */
export function useGroupResourceNavigation({
  client,
  groupId,
  request,
  consume,
  onError,
}: {
  client: Client;
  groupId: string;
  request?: ChatGroupResourceOpenRequest | null;
  consume?: (requestId: string) => void;
  onError: (error: unknown) => void;
}) {
  const { openPresentation } = useWorkbench();
  const runtime = useWorkbenchRuntime();
  const consumed = useRef(new Set<string>());
  const pending = useRef<AbortController | null>(null);
  useEffect(() => () => pending.current?.abort(), [client, groupId]);
  const active = useRef({ client, groupId });
  active.current = { client, groupId };
  const open = useCallback(
    async (link: ChatGroupResourceLink) => {
      const scope = active.current;
      if (!openPresentation) return;
      pending.current?.abort();
      const controller = new AbortController();
      pending.current = controller;
      try {
        const view = await client.groups.artifacts.read(
          groupId,
          link.referenceId,
          { signal: controller.signal },
        );
        if (controller.signal.aborted) return;
        if (
          active.current.client !== scope.client ||
          active.current.groupId !== scope.groupId
        )
          return;
        if (
          view.reference.groupId !== groupId ||
          view.reference.id !== link.referenceId ||
          view.reference.runtimeProjectId !== link.projectId
        )
          throw new Error('Resource reference changed');
        openPresentation(groupArtifactPreview(client, groupId, view.reference));
      } catch (error) {
        if (
          !controller.signal.aborted &&
          active.current.client === scope.client &&
          active.current.groupId === scope.groupId
        )
          onError(error);
      }
    },
    [client, groupId, openPresentation, onError],
  );
  useEffect(() => {
    if (
      !request ||
      !consume ||
      !openPresentation ||
      !runtime?.runtimeScopeReady ||
      consumed.current.has(request.requestId)
    )
      return;
    consumed.current.add(request.requestId);
    consume(request.requestId);
    if (runtime.projectId === request.projectId) void open(request);
  }, [
    request,
    consume,
    open,
    openPresentation,
    runtime?.runtimeScopeReady,
    runtime?.projectId,
  ]);
  return open;
}
