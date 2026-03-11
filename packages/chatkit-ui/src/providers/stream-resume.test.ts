import { describe, expect, it, vi } from 'vitest';

import {
  consumeResumableStream,
  isCompleteStreamChunk,
  type ResumableStreamChunk,
} from './stream-resume';

async function* emitChunks(chunks: ResumableStreamChunk[]) {
  for (const chunk of chunks) {
    yield chunk;
  }
}

describe('consumeResumableStream', () => {
  it('resumes from the last event id after an unexpected stream end', async () => {
    let lastEventId: string | null = null;
    const onChunk = vi.fn();
    const onResumeStreamOpen = vi.fn();

    const result = await consumeResumableStream({
      openInitialStream: () =>
        emitChunks([{ id: 'evt-1', event: 'message', data: { text: 'hello' } }]),
      openResumeStream: ({ lastEventId: resumeFrom, runId, attempt }) => {
        expect(runId).toBe('run-1');
        expect(attempt).toBe(1);
        expect(resumeFrom).toBe('evt-1');
        onResumeStreamOpen(resumeFrom);
        return emitChunks([
          { id: 'evt-2', event: 'message', data: { text: 'world' } },
          { id: 'evt-3', event: 'complete', data: { type: 'complete' } },
        ]);
      },
      getLastEventId: () => lastEventId,
      getRunId: () => 'run-1',
      onChunk,
      setLastEventId: (value) => {
        lastEventId = value;
      },
    });

    expect(result).toEqual({ attempts: 1, status: 'complete' });
    expect(onChunk).toHaveBeenCalledTimes(3);
    expect(onResumeStreamOpen).toHaveBeenCalledTimes(1);
    expect(onResumeStreamOpen).toHaveBeenCalledWith('evt-1');
    expect(lastEventId).toBe('evt-3');
  });

  it('does not resume after a complete event', async () => {
    let lastEventId: string | null = null;
    const openResumeStream = vi.fn();

    const result = await consumeResumableStream({
      openInitialStream: () =>
        emitChunks([{ id: 'evt-1', event: 'complete', data: { type: 'complete' } }]),
      openResumeStream,
      getLastEventId: () => lastEventId,
      getRunId: () => 'run-1',
      onChunk: vi.fn(),
      setLastEventId: (value) => {
        lastEventId = value;
      },
    });

    expect(result).toEqual({ attempts: 0, status: 'complete' });
    expect(openResumeStream).not.toHaveBeenCalled();
  });

  it('resumes after a transient stream error when the run id is known', async () => {
    let lastEventId: string | null = null;
    let firstAttempt = true;

    const result = await consumeResumableStream({
      openInitialStream: async function* () {
        yield { id: 'evt-1', event: 'message', data: { text: 'hello' } };
        if (firstAttempt) {
          firstAttempt = false;
          throw new Error('socket hang up');
        }
      },
      openResumeStream: ({ lastEventId: resumeFrom }) => {
        expect(resumeFrom).toBe('evt-1');
        return emitChunks([
          { id: 'evt-2', event: 'message', data: { text: 'world' } },
          { id: 'evt-3', event: 'complete', data: { type: 'complete' } },
        ]);
      },
      getLastEventId: () => lastEventId,
      getRunId: () => 'run-1',
      onChunk: vi.fn(),
      setLastEventId: (value) => {
        lastEventId = value;
      },
    });

    expect(result).toEqual({ attempts: 1, status: 'complete' });
  });

  it('stops before resuming when the caller has pending interrupts', async () => {
    const result = await consumeResumableStream({
      openInitialStream: () =>
        emitChunks([{ id: 'evt-1', event: 'message', data: { text: 'hello' } }]),
      openResumeStream: () => emitChunks([]),
      canResume: () => false,
      getLastEventId: () => 'evt-1',
      getRunId: () => 'run-1',
      onChunk: vi.fn(),
      setLastEventId: vi.fn(),
    });

    expect(result).toEqual({ attempts: 0, status: 'interrupted' });
  });

  it('rethrows chunk processing errors without advancing the resume cursor', async () => {
    let lastEventId: string | null = null;
    const openResumeStream = vi.fn();
    const processingError = new Error('bad chunk');

    await expect(
      consumeResumableStream({
        openInitialStream: () =>
          emitChunks([{ id: 'evt-1', event: 'complete', data: { type: 'complete' } }]),
        openResumeStream,
        getLastEventId: () => lastEventId,
        getRunId: () => 'run-1',
        onChunk: vi.fn(async () => {
          throw processingError;
        }),
        setLastEventId: (value) => {
          lastEventId = value;
        },
      }),
    ).rejects.toBe(processingError);

    expect(lastEventId).toBeNull();
    expect(openResumeStream).not.toHaveBeenCalled();
  });
});

describe('isCompleteStreamChunk', () => {
  it('recognizes terminal stream chunks', () => {
    expect(
      isCompleteStreamChunk({
        event: 'complete',
        data: null,
      }),
    ).toBe(true);
    expect(
      isCompleteStreamChunk({
        event: 'message',
        data: { type: 'complete' },
      }),
    ).toBe(true);
    expect(
      isCompleteStreamChunk({
        event: 'message',
        data: { type: 'message' },
      }),
    ).toBe(false);
  });
});
