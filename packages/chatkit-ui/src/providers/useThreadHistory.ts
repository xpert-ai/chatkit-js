import { useCallback, useEffect, useRef, useState } from 'react';

export type ThreadHistoryState = {
  threadId: string | null;
  status: 'idle' | 'loading' | 'loaded' | 'error';
  error?: unknown;
};

export type HistoryRequest = { isCurrent: () => boolean };

// A selected thread is not proof that its messages have been loaded. Each
// request owns a generation, including branches sharing one conversation ID.
export function useThreadHistory() {
  const [state, setState] = useState<ThreadHistoryState>({
    threadId: null,
    status: 'idle',
  });
  const generation = useRef(0);
  const pending = useRef<{ threadId: string; promise: Promise<void> } | null>(
    null,
  );

  const invalidate = useCallback(() => {
    generation.current += 1;
    pending.current = null;
  }, []);
  useEffect(() => invalidate, [invalidate]);

  const captureRequest = useCallback((): HistoryRequest => {
    const requestGeneration = generation.current;
    return { isCurrent: () => requestGeneration === generation.current };
  }, []);

  const reset = useCallback(() => {
    invalidate();
    setState({ threadId: null, status: 'idle' });
  }, [invalidate]);

  const markLoaded = useCallback(
    (threadId: string) => {
      invalidate();
      setState({ threadId, status: 'loaded' });
    },
    [invalidate],
  );

  const load = useCallback(
    (threadId: string, read: (request: HistoryRequest) => Promise<void>) => {
      if (pending.current?.threadId === threadId)
        return pending.current.promise;
      invalidate();
      const { isCurrent } = captureRequest();
      setState({ threadId, status: 'loading' });
      const promise = Promise.resolve()
        .then(() => {
          if (isCurrent()) return read({ isCurrent });
        })
        .then(() => {
          if (isCurrent()) setState({ threadId, status: 'loaded' });
        })
        .catch((error: unknown) => {
          if (!isCurrent()) return;
          setState({ threadId, status: 'error', error });
          throw error;
        })
        .finally(() => {
          if (isCurrent()) pending.current = null;
        });
      pending.current = { threadId, promise };
      return promise;
    },
    [captureRequest, invalidate],
  );

  return { state, load, reset, markLoaded, captureRequest };
}
