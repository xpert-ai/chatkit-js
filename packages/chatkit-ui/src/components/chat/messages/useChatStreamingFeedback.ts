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
  const STREAMING_STATUS_REFRESH_MS = 250;
  const [streamingNow, setStreamingNow] = React.useState(() => Date.now());
  const lastStreamOutputAtRef = React.useRef<number | null>(null);

  React.useEffect(() => {
    if (surface === 'main') setStream(stream);
  }, [setStream, stream, surface]);

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
  return {
    streamingNow,
    lastStreamOutputAtRef,
    showLoadingDots: stream.isLoading,
  };
}
