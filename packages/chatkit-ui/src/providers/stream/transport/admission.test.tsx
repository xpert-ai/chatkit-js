import { act, render, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  mocks,
  provider,
  setupHistoryTests,
  stream,
} from '../testing/history-fixture';
import { UnconfirmedRunError } from './errors';

const rejected = Object.assign(new Error('Model unavailable'), { status: 400 });
const oldAssistant = {
  id: 'old-ai',
  role: 'ai',
  content: 'Previous reply',
  executionId: 'old-execution',
  status: 'success',
};
const optimistic = {
  optimisticValues: (previous: { messages: typeof stream.messages }) => ({
    ...previous,
    messages: [
      ...previous.messages,
      { id: 'new-user', type: 'human', content: 'Investigate my app' },
    ],
  }),
};

describe('run admission and recovery', () => {
  setupHistoryTests();

  it.each([
    { label: 'older successful assistant', items: [oldAssistant] },
    { label: 'no assistant', items: [] },
    {
      label: 'older failed assistant',
      items: [{ ...oldAssistant, status: 'error', error: 'Old failure' }],
    },
  ])(
    'retains HTTP 400 and rolls back the optimistic message with $label',
    async ({ items }) => {
      mocks.searchMessages.mockResolvedValue({ items, total: items.length });
      render(provider('thread-1'));
      await waitFor(() => expect(stream.historyLoad.status).toBe('loaded'));
      mocks.searchMessages.mockClear();
      mocks.getThread.mockResolvedValue({ status: 'idle' });
      mocks.runStream.mockImplementation(async function* () {
        yield* [];
        throw rejected;
      });
      await act(async () => {
        await expect(
          stream.submit({ input: { input: 'Investigate my app' } }, optimistic),
        ).rejects.toBe(rejected);
      });
      expect(stream.error).toBe(rejected);
      expect(stream.isLoading).toBe(false);
      expect(stream.messages.some((message) => message.id === 'new-user')).toBe(
        false,
      );
      expect(mocks.searchMessages).not.toHaveBeenCalled();
    },
  );

  it('propagates the installed SDK HTTP 400 without an acceptance callback', async () => {
    const actual = await vi.importActual<typeof import('@xpert-ai/xpert-sdk')>(
      '@xpert-ai/xpert-sdk',
    );
    const http = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            message: rejected.message,
            error: 'Bad Request',
            statusCode: 400,
            code: 'ASSISTANT_MODEL_UNAVAILABLE',
            modelId: 'mdl_stale',
          }),
          { status: 400, headers: { 'Content-Type': 'application/json' } },
        ),
    );
    const realClient = new actual.Client({
      apiUrl: 'https://api.example.test/api/ai',
      callerOptions: { fetch: http },
    });
    render(provider('thread-1'));
    await waitFor(() => expect(stream.historyLoad.status).toBe('loaded'));
    mocks.runStream.mockImplementation(
      realClient.runs.stream.bind(realClient.runs),
    );
    await act(async () => {
      await expect(
        stream.submit(
          { input: { input: 'Investigate my app', model: 'mdl_stale' } },
          optimistic,
        ),
      ).rejects.toMatchObject({ status: 400 });
    });
    expect(http).toHaveBeenCalledOnce();
    expect(stream.error).toHaveProperty(
      'message',
      expect.stringContaining(rejected.message),
    );
    expect(stream.messages.some((message) => message.id === 'new-user')).toBe(
      false,
    );
  });

  it.each([
    new TypeError('Network lost'),
    Object.assign(new Error('Gateway timeout'), { status: 504 }),
  ])(
    'preserves an unconfirmed submission instead of enabling duplicate retries: %s',
    async (error) => {
      render(provider('thread-1'));
      await waitFor(() => expect(stream.historyLoad.status).toBe('loaded'));
      mocks.runStream.mockImplementation(async function* () {
        yield* [];
        throw error;
      });
      await act(async () => {
        await expect(
          stream.submit({ input: { input: 'Investigate my app' } }, optimistic),
        ).rejects.toBeInstanceOf(UnconfirmedRunError);
      });
      expect(stream.error).toBeInstanceOf(UnconfirmedRunError);
      expect(stream.messages.some((message) => message.id === 'new-user')).toBe(
        true,
      );
      expect(mocks.runStream).toHaveBeenCalledOnce();
    },
  );

  it.each([
    { runId: 'new-run', status: 'success', recovered: true },
    { runId: 'old-run', status: 'success', recovered: false },
    { runId: 'new-run', status: 'error', recovered: false },
  ])(
    'recovers only the acknowledged run: $runId / $status',
    async ({ runId, status, recovered }) => {
      render(provider('thread-1'));
      await waitFor(() => expect(stream.historyLoad.status).toBe('loaded'));
      const failure = new Error('Stream disconnected');
      mocks.getThread.mockResolvedValue({ status: 'idle' });
      mocks.getRun.mockResolvedValue({
        run_id: runId,
        thread_id: 'thread-1',
        status,
        metadata: {},
      });
      mocks.runStream.mockImplementation(
        async function* (_thread, _assistant, options) {
          options.onRunCreated({ run_id: 'new-run', thread_id: 'thread-1' });
          yield* [];
          throw failure;
        },
      );
      await act(async () => {
        await stream.submit(
          { input: { input: 'Investigate my app' } },
          optimistic,
        );
      });
      expect(mocks.getRun).toHaveBeenCalledWith('thread-1', 'new-run');
      expect(mocks.searchMessages).toHaveBeenLastCalledWith(
        'conversation-thread-1',
        expect.objectContaining({
          where: { role: 'ai', threadId: 'thread-1', executionId: 'new-run' },
        }),
      );
      expect(stream.error).toBe(recovered ? null : failure);
      expect(stream.messages.some((message) => message.id === 'new-user')).toBe(
        true,
      );
      expect(mocks.runStream).toHaveBeenCalledOnce();
    },
  );

  it('keeps a disconnected acknowledged run busy until its completion is confirmed', async () => {
    render(provider('thread-1'));
    await waitFor(() => expect(stream.historyLoad.status).toBe('loaded'));
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    try {
      const failure = new Error('Stream disconnected');
      const run = { run_id: 'new-run', thread_id: 'thread-1', metadata: {} };
      mocks.getRun.mockResolvedValue({ ...run, status: 'running' });
      mocks.runStream.mockImplementation(
        async function* (_thread, _assistant, options) {
          options.onRunCreated({ run_id: 'new-run', thread_id: 'thread-1' });
          yield* [];
          throw failure;
        },
      );
      let submission!: Promise<void>;
      await act(async () => {
        submission = stream.submit(
          { input: { input: 'Run once' } },
          optimistic,
        );
      });
      expect(stream.isLoading).toBe(true);
      expect(stream.error).toBe(failure);
      mocks.getRun.mockResolvedValue({ ...run, status: 'success' });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(2_000);
        await submission;
      });
      expect(stream.isLoading).toBe(false);
      expect(stream.error).toBeNull();
      expect(mocks.runStream).toHaveBeenCalledOnce();
    } finally {
      vi.useRealTimers();
    }
  });
});
