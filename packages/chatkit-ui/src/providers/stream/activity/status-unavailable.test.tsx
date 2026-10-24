import { act, render, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  deferred,
  mocks,
  provider,
  readStepStatus,
  setupHistoryTests,
  stream,
} from '../testing/history-fixture';

const outage = () =>
  Object.assign(new Error('private replica diagnostic'), {
    status: 503,
    retryAfterMs: 30_000,
  });
const live = {
  version: 1,
  threadId: 'thread-1',
  cards: [],
  runs: [
    {
      id: 'run',
      status: 'running',
      createdAt: '1',
      updatedAt: '2',
      messageRevision: '',
    },
  ],
};
const component = {
  type: 'component',
  id: 'tool-1',
  data: {
    category: 'Tool',
    tool: 'sandbox_shell',
    input: { command: 'sleep 30 && echo done' },
    status: 'running',
  },
};

describe('execution is independent of status availability', () => {
  setupHistoryTests();
  afterEach(() => vi.useRealTimers());
  it('keeps tool progress through consecutive 503, then resumes reads and finishes the same tool once', async () => {
    let available = false,
      completed = false,
      toolCalls = 0;
    const discover = deferred<void>();
    mocks.watchActivity.mockImplementation(async function* (_thread, options) {
      yield { ...live, runs: [] };
      await discover.promise;
      if (options.signal.aborted) return;
      yield live;
      await new Promise<void>((resolve) =>
        options.signal.addEventListener('abort', () => resolve(), {
          once: true,
        }),
      );
    });
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
    const view = render(provider('thread-1'));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(stream.historyLoad.status).toBe('loaded');
    mocks.getThread.mockImplementation(async () => {
      if (!available) throw outage();
      return {
        status: completed ? 'idle' : 'busy',
        metadata: { id: 'conversation-thread-1' },
      };
    });
    mocks.getRun.mockImplementation(async () => {
      if (!available) throw outage();
      return {
        run_id: 'run',
        thread_id: 'thread-1',
        status: completed ? 'success' : 'running',
      };
    });
    mocks.searchMessages.mockImplementation(async () => ({
      items: [
        {
          id: 'ai',
          role: 'ai',
          executionId: 'run',
          status: completed ? 'success' : 'thinking',
          content: completed
            ? [
                {
                  ...component,
                  data: { ...component.data, status: 'success' },
                },
                { type: 'text', text: 'done' },
              ]
            : '',
        },
      ],
      total: 1,
    }));
    mocks.runStream.mockImplementation(
      async function* (_thread, _assistant, options) {
        toolCalls++;
        options.onRunCreated({ run_id: 'run' });
        yield {
          event: 'message',
          data: {
            type: 'event',
            event: 'on_message_start',
            data: {
              id: 'ai',
              role: 'ai',
              executionId: 'run',
              status: 'answering',
              content: '',
            },
          },
        };
        yield { event: 'message', data: { type: 'message', data: component } };
        throw new Error('Connection interrupted');
      },
    );
    mocks.joinStream.mockImplementation(async function* () {
      yield {
        id: '200-0',
        event: 'message',
        data: {
          type: 'stream_snapshot',
          continuous: true,
          snapshot: {
            version: 1,
            threadId: 'thread-1',
            runId: 'run',
            segmentId: 'segment',
            revision: 1,
            cursor: '200-0',
            activeMessageId: 'ai',
            messages: [
              {
                id: 'ai',
                role: 'ai',
                executionId: 'run',
                content: [component],
                status: 'answering',
              },
            ],
          },
        },
      };
      yield {
        id: '201-0',
        event: 'message',
        data: {
          type: 'message',
          data: {
            ...component,
            data: { ...component.data, status: 'success' },
          },
        },
      };
      yield {
        id: '202-0',
        event: 'message',
        data: { type: 'message', data: 'done' },
      };
      completed = true;
      yield { id: '203-0', event: 'message', data: { type: 'complete' } };
    });
    let submission!: Promise<void>;
    await act(async () => {
      submission = stream.submit({ input: { input: 'Run once' } });
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(155_000);
    });
    expect(stream.connectionState).toBe('unavailable');
    expect(stream.isThreadInterrupted).toBe(false);
    expect(stream.error).toBeNull();
    expect(readStepStatus(stream.messages.find((m) => m.id === 'ai'))).toBe(
      'running',
    );
    expect(toolCalls).toBe(1);
    await expect(
      stream.submit({ input: { input: 'Do not duplicate' } }),
    ).rejects.toThrow('temporarily unavailable');
    await expect(stream.resumeRun('run', 'pause')).rejects.toThrow(
      'temporarily unavailable',
    );
    const before = {
      connectionState: stream.connectionState,
      toolCalls,
      toolStatus: readStepStatus(stream.messages.find((m) => m.id === 'ai')),
      statusReads: mocks.getRun.mock.calls.length,
      messages: stream.messages,
    };
    available = true;
    await act(async () => {
      discover.resolve();
      await vi.advanceTimersByTimeAsync(35_000);
      await submission;
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2_000);
    });
    expect(stream.connectionState).toBe('connected');
    expect(JSON.stringify(stream.messages)).toContain('done');
    expect(mocks.runStream).toHaveBeenCalledTimes(1);
    expect(mocks.resumeRun).not.toHaveBeenCalled();
    expect(mocks.cancelRun).not.toHaveBeenCalled();
    expect(toolCalls).toBe(1);
    expect(mocks.joinStream).toHaveBeenCalled();
    console.log(
      JSON.stringify({
        before,
        after: {
          connectionState: stream.connectionState,
          toolCalls,
          messages: stream.messages,
        },
      }),
    );
    view.unmount();
  });
  it('does not mark a failed stop request as a stopped task', async () => {
    const view = render(provider('thread-1'));
    await waitFor(() => expect(stream.historyLoad.status).toBe('loaded'));
    mocks.cancelRun.mockRejectedValue(outage());
    await expect(stream.stop('run')).rejects.toMatchObject({ status: 503 });
    expect(stream.isThreadInterrupted).toBe(false);
    expect(mocks.resumeRun).not.toHaveBeenCalled();
    view.unmount();
  });

  it('shows a confirmed final answer even while thread metadata is unavailable', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
    const view = render(provider('thread-1'));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    mocks.getThread.mockRejectedValue(outage());
    mocks.getRun.mockResolvedValue({
      run_id: 'run',
      thread_id: 'thread-1',
      status: 'success',
    });
    mocks.searchMessages.mockResolvedValue({
      items: [
        {
          id: 'ai',
          role: 'ai',
          executionId: 'run',
          status: 'success',
          content: 'Confirmed final answer',
        },
      ],
      total: 1,
    });
    mocks.runStream.mockImplementation(
      async function* (_thread, _assistant, options) {
        options.onRunCreated({ run_id: 'run' });
        yield { event: 'message', data: { type: 'complete' } };
      },
    );
    let submission!: Promise<void>;
    await act(async () => {
      submission = stream.submit({ input: { input: 'Run once' } });
      await vi.advanceTimersByTimeAsync(65_000);
    });
    expect(
      stream.messages.find((message) => message.id === 'ai')?.content,
    ).toBe('Confirmed final answer');
    expect(stream.connectionState).toBe('unavailable');
    expect(stream.isThreadInterrupted).toBe(false);
    expect(stream.error).toBeNull();
    mocks.getThread.mockResolvedValue({ status: 'idle' });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
      await submission;
    });
    expect(stream.connectionState).toBe('connected');
    expect(mocks.runStream).toHaveBeenCalledTimes(1);
    expect(mocks.resumeRun).not.toHaveBeenCalled();
    view.unmount();
  });
});
