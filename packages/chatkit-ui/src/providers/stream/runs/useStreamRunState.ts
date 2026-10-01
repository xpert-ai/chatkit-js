import type { ThreadDisplayPause } from '@xpert-ai/xpert-sdk';
import { useCallback, useEffect, useRef, useState } from 'react';
import { reconcilePausedDisplaySteps } from '../../../lib/paused-display-snapshot';
import type { useStreamMessages } from '../messages/useStreamMessages';
import type {
  ResumeStreamOptions,
  StateType,
  StreamContextType,
} from '../types';

type StreamRunStateOptions = Pick<
  ReturnType<typeof useStreamMessages>,
  'values'
>;

export function useStreamRunState({ values }: StreamRunStateOptions) {
  const [pausedDisplay, setPausedDisplayState] = useState<{
    threadId: string;
    values: StateType;
    pause?: ThreadDisplayPause;
  } | null>(null);

  const pausedDisplayRef = useRef<typeof pausedDisplay>(null);
  const setPausedDisplay = useCallback((next: typeof pausedDisplay) => {
    pausedDisplayRef.current = next;
    setPausedDisplayState(next);
  }, []);

  const [isLoading, setIsLoading] = useState(false);
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

  // A pause only takes effect at the next node boundary, so the step that was
  // already running finishes behind the frozen view. Settle those steps as the
  // live state arrives, otherwise a completed tool keeps looking active.
  useEffect(() => {
    const frozen = pausedDisplayRef.current;
    if (!frozen) return;
    const settled = reconcilePausedDisplaySteps(frozen.values, values);
    if (settled !== frozen.values) {
      setPausedDisplay({ ...frozen, values: settled });
    }
  }, [values, setPausedDisplay]);

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
    setIsLoading,
    pauseRequestedRef,
    setPausedDisplay,
    pausedDisplayRef,
    shouldStartFreshAssistantMessageAfterSteerRef,
    pausedDisplay,
    error,
    activeRunId,
  };
}
