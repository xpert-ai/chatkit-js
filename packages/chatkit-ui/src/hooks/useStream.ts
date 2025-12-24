import type { StreamContextType } from '../providers/Stream';

export type StreamManager = {
  streamRef: { current: StreamContextType | null };
  stream: StreamContextType | null;
  setStream: (stream: StreamContextType | null) => void;
};

const streamRef: { current: StreamContextType | null } = { current: null };

export function useStreamManager(): StreamManager {
  return {
    streamRef,
    stream: streamRef.current,
    setStream: (stream: StreamContextType | null) => {
      streamRef.current = stream;
    },
  };
}
