import * as React from 'react';
import {
  parseWorkbenchViewOpenEvent,
  type WorkbenchViewOpenEvent,
} from '@xpert-ai/xpert-sdk';
import { CHATKIT_INTERNAL_PARENT_EVENT } from './host-events';

/** Consume live navigation only; never infer UI navigation from persisted tool output. */
export function useWorkbenchOpenRequest(options: {
  enabled: boolean;
  projectId?: string | null;
  conversationId?: string | null;
  ready: boolean;
  open: (request: WorkbenchViewOpenEvent) => boolean;
}) {
  const [pending, setPending] = React.useState<WorkbenchViewOpenEvent | null>(
    null,
  );
  const { enabled, projectId, conversationId, ready, open } = options;
  React.useEffect(() => {
    if (!enabled) return;
    const receive = (event: Event) => {
      if (!(event instanceof CustomEvent)) return;
      const detail: unknown = event.detail;
      if (
        !detail ||
        typeof detail !== 'object' ||
        !('event' in detail) ||
        detail.event !== 'public_event' ||
        !('data' in detail) ||
        !Array.isArray(detail.data)
      )
        return;
      const [type, payload] = detail.data;
      if (type !== 'log' || payload?.name !== 'lg.chat.event') return;
      const request = parseWorkbenchViewOpenEvent(payload.data);
      if (request) setPending(request);
    };
    window.addEventListener(CHATKIT_INTERNAL_PARENT_EVENT, receive);
    return () =>
      window.removeEventListener(CHATKIT_INTERNAL_PARENT_EVENT, receive);
  }, [enabled]);
  React.useEffect(() => {
    if (!pending || !ready) return;
    if (
      enabled &&
      pending.projectId === projectId &&
      pending.conversationId &&
      !conversationId
    )
      return;
    if (
      enabled &&
      pending.projectId === projectId &&
      (!pending.conversationId || pending.conversationId === conversationId)
    )
      open(pending);
    setPending(null);
  }, [pending, enabled, ready, projectId, conversationId, open]);
}
