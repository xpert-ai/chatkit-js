export type ResumableStreamChunk = {
  id?: string;
  event?: string;
  data?: unknown;
};

type ResumableStreamStatus =
  | 'complete'
  | 'aborted'
  | 'interrupted'
  | 'disconnected';

export type ConsumeResumableStreamResult = {
  attempts: number;
  status: ResumableStreamStatus;
};

type ConsumeResumableStreamOptions<TChunk extends ResumableStreamChunk> = {
  openInitialStream: () => AsyncIterable<TChunk>;
  openResumeStream: (params: {
    attempt: number;
    lastEventId?: string;
    runId: string;
  }) => AsyncIterable<TChunk>;
  getLastEventId: () => string | null | undefined;
  getRunId: () => string | null | undefined;
  onChunk: (chunk: TChunk) => void | Promise<void>;
  canResume?: () => boolean;
  isCompleteChunk?: (chunk: TChunk) => boolean;
  maxResumeAttempts?: number;
  onResume?: (params: {
    attempt: number;
    lastEventId?: string;
    runId: string;
  }) => void | Promise<void>;
  setLastEventId: (id: string) => void;
  signal?: AbortSignal;
};

const DEFAULT_MAX_RESUME_ATTEMPTS = 3;

function isAbortError(error: unknown) {
  return (
    (error instanceof DOMException && error.name === 'AbortError') ||
    (error instanceof Error && error.name === 'AbortError')
  );
}

export function isCompleteStreamChunk<TChunk extends ResumableStreamChunk>(
  chunk: TChunk,
) {
  if (chunk.event === 'complete') {
    return true;
  }

  if (!chunk.data || typeof chunk.data !== 'object') {
    return false;
  }

  return (chunk.data as { type?: unknown }).type === 'complete';
}

export async function consumeResumableStream<
  TChunk extends ResumableStreamChunk,
>({
  openInitialStream,
  openResumeStream,
  getLastEventId,
  getRunId,
  onChunk,
  canResume,
  isCompleteChunk = isCompleteStreamChunk,
  maxResumeAttempts = DEFAULT_MAX_RESUME_ATTEMPTS,
  onResume,
  setLastEventId,
  signal,
}: ConsumeResumableStreamOptions<TChunk>): Promise<ConsumeResumableStreamResult> {
  let attempts = 0;
  let stream = openInitialStream();

  while (true) {
    let sawComplete = false;
    let streamError: unknown = null;

    try {
      for await (const chunk of stream) {
        if (chunk.id) {
          setLastEventId(String(chunk.id));
        }

        if (isCompleteChunk(chunk)) {
          sawComplete = true;
        }

        await onChunk(chunk);
      }
    } catch (error) {
      if (signal?.aborted || isAbortError(error)) {
        return { attempts, status: 'aborted' };
      }
      streamError = error;
    }

    if (signal?.aborted) {
      return { attempts, status: 'aborted' };
    }

    if (sawComplete) {
      return { attempts, status: 'complete' };
    }

    if (canResume && !canResume()) {
      return { attempts, status: 'interrupted' };
    }

    const runId = getRunId()?.trim();
    if (!runId || attempts >= maxResumeAttempts) {
      if (streamError) {
        throw streamError;
      }
      return { attempts, status: 'disconnected' };
    }

    attempts += 1;
    const lastEventId = getLastEventId()?.trim() || undefined;
    await onResume?.({ attempt: attempts, lastEventId, runId });
    stream = openResumeStream({ attempt: attempts, lastEventId, runId });
  }
}
