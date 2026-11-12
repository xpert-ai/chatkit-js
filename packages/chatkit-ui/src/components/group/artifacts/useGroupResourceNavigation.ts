import { useCallback, useEffect, useRef } from 'react';
import type {
  ChatGroupResourceLink,
  ChatGroupResourceOpenRequest,
  Client,
} from '@xpert-ai/xpert-sdk';
import { useWorkbenchRuntime } from '../../../workbench/WorkbenchRuntime';
import { useWorkbench } from '../../../workbench/context';

/** Group messages only coordinate live delivery and cancellation; Workbench owns resource resolution. */
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
  const { openResource } = useWorkbench();
  const runtime = useWorkbenchRuntime();
  const consumed = useRef(new Set<string>());
  const pending = useRef<AbortController | null>(null);
  useEffect(
    () => () => pending.current?.abort(),
    [client, groupId, runtime?.projectId],
  );
  const active = useRef({ client, groupId, projectId: runtime?.projectId });
  active.current = { client, groupId, projectId: runtime?.projectId };
  const open = useCallback(
    async (link: ChatGroupResourceLink) => {
      const scope = active.current;
      if (
        !runtime?.runtimeScopeReady ||
        runtime.projectId !== link.projectId ||
        !openResource
      )
        return;
      pending.current?.abort();
      const controller = new AbortController();
      pending.current = controller;
      try {
        const result = await openResource(link.resource, {
          signal: controller.signal,
        });
        if (
          controller.signal.aborted ||
          active.current.client !== scope.client ||
          active.current.groupId !== scope.groupId ||
          active.current.projectId !== scope.projectId
        )
          return;
        if (
          !result ||
          typeof result !== 'object' ||
          !('success' in result) ||
          result.success !== true
        )
          throw new Error('Resource could not be opened');
      } catch (error) {
        if (
          !controller.signal.aborted &&
          active.current.client === scope.client &&
          active.current.groupId === scope.groupId &&
          active.current.projectId === scope.projectId
        )
          onError(error);
      }
    },
    [
      client,
      groupId,
      openResource,
      runtime?.runtimeScopeReady,
      runtime?.projectId,
      onError,
    ],
  );
  useEffect(() => {
    if (
      !request ||
      !consume ||
      !openResource ||
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
    openResource,
    runtime?.runtimeScopeReady,
    runtime?.projectId,
  ]);
  return open;
}
