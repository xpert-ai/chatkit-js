import { useCallback, useEffect, useRef, useState } from 'react';
import type { ResumeStreamOptions, StreamContextType } from '../types';

export function useStreamRunState() {
  const [isLoading, setIsLoading] = useState(false);
  const [interruptedThreadId, setInterruptedThreadId] = useState<string | null>(
    null,
  );
  const [error, setError] = useState<unknown>(null);
  const abortRef = useRef<AbortController | null>(null);
  const isLoadingRef = useRef(false);
  const submitRef = useRef<StreamContextType['submit'] | null>(null);
  const lastStreamOptionsRef = useRef<ResumeStreamOptions>({});
  const lastExecutionIdRef = useRef<string | null>(null);
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const rememberActiveRunId = useCallback((executionId: string | null) => {
    lastExecutionIdRef.current = executionId;
    setActiveRunId((current) =>
      current === executionId ? current : executionId,
    );
  }, []);

  const lastEventIdRef = useRef<string | null>(null);
  const shouldStartFreshAssistantMessageAfterSteerRef = useRef(false);

  useEffect(() => {
    isLoadingRef.current = isLoading;
  }, [isLoading]);

  const pauseRequestedRef = useRef(false);
  return {
    lastExecutionIdRef,
    submitRef,
    lastStreamOptionsRef,
    rememberActiveRunId,
    setError,
    abortRef,
    isLoadingRef,
    lastEventIdRef,
    isLoading,
    interruptedThreadId,
    setInterruptedThreadId,
    setIsLoading,
    pauseRequestedRef,
    shouldStartFreshAssistantMessageAfterSteerRef,
    error,
    activeRunId,
  };
}
