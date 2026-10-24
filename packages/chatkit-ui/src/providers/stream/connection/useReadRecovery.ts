import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
} from 'react';
import { ReadRecovery } from './read-recovery';

export function useReadRecovery(scopeKey: string, threadId: string | null) {
  const recovery = useMemo(() => new ReadRecovery(), [scopeKey]);
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
  return { recovery, connectionState };
}
