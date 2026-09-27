import * as React from 'react';
import type {
  ChatKitOptions,
  ChatKitWorkbenchClientCommandRequest,
} from '@xpert-ai/chatkit-types';
import { useParentMessenger } from '../hooks/useParentMessenger';
import {
  parseNavigationSession,
  type NavigationSession,
} from './client-command-payload';

export function useWorkbenchNavigation(
  options: ChatKitOptions | null | undefined,
  organizationId?: string,
) {
  const parent = useParentMessenger();
  const binding = JSON.stringify([
    options?.api.apiUrl,
    options?.api.xpertId,
    organizationId,
    options?.api && 'getClientSecret' in options.api
      ? options.api.projectId
      : undefined,
    options?.initialThread,
  ]);
  const [navigation, setNavigation] = React.useState<{
    binding: string;
    revision: number;
    session: NavigationSession;
    request: ChatKitWorkbenchClientCommandRequest;
  } | null>(null);
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  React.useEffect(() => {
    setNavigation((current) => (current?.binding === binding ? current : null));
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [binding]);
  const active = navigation?.binding === binding ? navigation : null;
  const navigate = React.useCallback(
    (
      session: NavigationSession,
      request: ChatKitWorkbenchClientCommandRequest,
    ) => {
      if (timer.current) clearTimeout(timer.current);
      // Reply to the source iframe before changing the Assistant/runtime scope.
      timer.current = setTimeout(
        () =>
          setNavigation((previous) => ({
            binding,
            session,
            request,
            revision: (previous?.revision ?? 0) + 1,
          })),
        0,
      );
    },
    [binding],
  );
  const refresh = React.useCallback(async () => {
    if (!active) throw new Error('No Workbench navigation session.');
    const result =
      typeof options?.workbench?.onClientCommand === 'function'
        ? await options.workbench.onClientCommand(active.request)
        : await parent.sendCommand('onWorkbenchClientCommand', active.request);
    const next = parseNavigationSession(result);
    if (
      !next ||
      next.assistantId !== active.session.assistantId ||
      next.projectId !== active.session.projectId ||
      next.threadId !== active.session.threadId ||
      next.organizationId !== active.session.organizationId
    )
      throw new Error('Workbench session scope changed.');
    return { secret: next.secret, organizationId: next.organizationId };
  }, [active, options?.workbench?.onClientCommand, parent.sendCommand]);
  return {
    revision: active?.revision,
    session: active?.session,
    request: active?.request,
    navigate,
    refresh: active ? refresh : undefined,
  };
}
