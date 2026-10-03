import * as React from 'react';
import type { useChatEnvironment } from '../session/useChatEnvironment';

type ChatStreamingFeedbackOptions = Pick<
  ReturnType<typeof useChatEnvironment>,
  'setStream' | 'stream'
> & {
  surface: 'main' | 'side';
};

export function useChatStreamingFeedback({
  surface,
  setStream,
  stream,
}: ChatStreamingFeedbackOptions) {
  // Minimum loading dots display time (ms)
  const LOADING_DOTS_MIN_DURATION = 800;
  const STREAMING_STATUS_REFRESH_MS = 250;
  const [showLoadingDots, setShowLoadingDots] = React.useState(false);
  const [streamingNow, setStreamingNow] = React.useState(() => Date.now());
  const loadingStartTimeRef = React.useRef<number | null>(null);
  const lastStreamOutputAtRef = React.useRef<number | null>(null);

  React.useEffect(() => {
    if (surface === 'main') setStream(stream);
  }, [setStream, stream, surface]);

  // Handle loading dots with minimum display time
  React.useEffect(() => {
    if (stream.isLoading) {
      // Start showing loading dots
      if (!loadingStartTimeRef.current) {
        loadingStartTimeRef.current = Date.now();
        setShowLoadingDots(true);
      }
    } else {
      // Loading finished - check if we need to keep dots visible
      if (loadingStartTimeRef.current) {
        const elapsed = Date.now() - loadingStartTimeRef.current;
        const remaining = LOADING_DOTS_MIN_DURATION - elapsed;

        if (remaining > 0) {
          // Keep dots visible for remaining time
          const timer = setTimeout(() => {
            setShowLoadingDots(false);
            loadingStartTimeRef.current = null;
          }, remaining);
          return () => clearTimeout(timer);
        } else {
          // Minimum time already passed
          setShowLoadingDots(false);
          loadingStartTimeRef.current = null;
        }
      }
    }
  }, [stream.isLoading]);

  React.useEffect(() => {
    if (!stream.isLoading) {
      lastStreamOutputAtRef.current = null;
      setStreamingNow(Date.now());
      return;
    }

    const now = Date.now();
    lastStreamOutputAtRef.current = now;
    setStreamingNow(now);
  }, [stream.messages, stream.isLoading]);

  React.useEffect(() => {
    if (!stream.isLoading) {
      return;
    }

    const timer = window.setInterval(() => {
      setStreamingNow(Date.now());
    }, STREAMING_STATUS_REFRESH_MS);

    return () => window.clearInterval(timer);
  }, [stream.isLoading]);
  return { streamingNow, lastStreamOutputAtRef, showLoadingDots };
}
