import { useCallback, useEffect } from 'react';
import { useParentMessenger } from '../../../hooks/useParentMessenger';
import type { ParentMessenger } from '../../ParentMessenger';
import { useThreadHistory } from '../../useThreadHistory';
import {
  normalizeThreadIdentifier,
  shouldBroadcastThreadChange,
} from '../scope/thread-identity';
import type { useStreamScope } from '../scope/useStreamScope';

type StreamHostOptions = Pick<
  ReturnType<typeof useStreamScope>,
  'threadId' | 'hasObservedThreadSelectionRef' | 'suppressThreadChangeRef'
> & {
  hostIntegration: boolean;
};

export function useStreamHost({
  hostIntegration,
  threadId,
  hasObservedThreadSelectionRef,
  suppressThreadChangeRef,
}: StreamHostOptions) {
  const { isParentAvailable, sendCommand, sendEvent } = useParentMessenger();
  const streamSendEvent: ParentMessenger['sendEvent'] = useCallback(
    (event, data, transfer) => {
      if (hostIntegration) sendEvent(event, data, transfer);
    },
    [hostIntegration, sendEvent],
  );

  const {
    state: historyLoad,
    load: loadHistory,
    reset: resetHistory,
    markLoaded: markHistoryLoaded,
    captureRequest: captureHistoryRequest,
  } = useThreadHistory({
    onLoadStart: (threadId) => {
      streamSendEvent('public_event', ['thread.load.start', { threadId }]);
    },
    onLoadEnd: (threadId) => {
      streamSendEvent('public_event', ['thread.load.end', { threadId }]);
    },
  });

  // Notify the host page when the active thread changes. The host maps
  // `public_event` -> `chatkit.<event>` so sending ['thread.change', {...}]
  // will become a `chatkit.thread.change` CustomEvent on the host element.
  useEffect(() => {
    const currentThreadId = normalizeThreadIdentifier(threadId);
    if (currentThreadId !== null) {
      hasObservedThreadSelectionRef.current = true;
    }
    if (!hostIntegration || !isParentAvailable) return;
    if (suppressThreadChangeRef.current) {
      suppressThreadChangeRef.current = false;
      return;
    }
    if (
      !shouldBroadcastThreadChange({
        threadId: currentThreadId,
        hasObservedThreadSelection: hasObservedThreadSelectionRef.current,
      })
    ) {
      return;
    }
    sendEvent('public_event', ['thread.change', { threadId: currentThreadId }]);
  }, [threadId, hostIntegration, isParentAvailable, sendEvent]);
  return {
    isParentAvailable,
    sendCommand,
    historyLoad,
    loadHistory,
    captureHistoryRequest,
    resetHistory,
    streamSendEvent,
    markHistoryLoaded,
  };
}
