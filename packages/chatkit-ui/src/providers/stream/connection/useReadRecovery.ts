import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useReducer,
  useRef,
  useSyncExternalStore,
} from 'react';
import { ReadRecovery } from './read-recovery';

export function useReadRecovery(scopeKey: string, threadId: string | null) {
  const [attempt, reconnect] = useReducer((value: number) => value + 1, 0);
  // A new coordinator restarts read subscriptions without resetting the thread
  // or replaying an admitted run. Keep controls stale until a read succeeds.
  const recovery = useMemo(
    () => new ReadRecovery(attempt > 0),
    [scopeKey, attempt],
  );
  const previous = useRef(threadId);
  useLayoutEffect(() => {
    // Adopting the first server-created thread keeps the submitting transport's coordinator.
    if (previous.current && previous.current !== threadId) recovery.reset();
    previous.current = threadId;
  }, [recovery, threadId]);
  useEffect(() => {
    recovery.activate();
    return () => recovery.dispose();
  }, [recovery]);
  const connectionState = useSyncExternalStore(
    recovery.subscribe,
    recovery.getSnapshot,
    recovery.getSnapshot,
  );
  return { recovery, connectionState, reconnect };
}
