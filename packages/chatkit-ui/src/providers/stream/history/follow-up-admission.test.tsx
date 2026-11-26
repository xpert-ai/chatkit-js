import { act, render, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  deferred,
  history,
  mocks,
  provider,
  setupHistoryTests,
  stream,
} from '../testing/history-fixture';

async function runningConversation() {
  render(provider('thread-1'));
  await waitFor(() => expect(stream.historyLoad.status).toBe('loaded'));
  const finished = deferred<undefined>();
  mocks.getThread.mockResolvedValue({ status: 'idle' });
  mocks.getRun.mockResolvedValue({
    run_id: 'run-1',
    thread_id: 'thread-1',
    status: 'success',
  });
  mocks.runStream.mockImplementation(
    async function* (_thread, _assistant, options) {
      options.onRunCreated({ run_id: 'run-1', thread_id: 'thread-1' });
      await finished.promise;
      yield { event: 'complete', data: { type: 'complete' } };
    },
  );
  let run!: Promise<void>;
  await act(async () => {
    run = stream.submit({ input: { input: 'Original work' } });
  });
  return async () =>
    act(async () => {
      finished.resolve(undefined);
      await run;
    });
}

async function sendFollowUp(promote: boolean) {
  await act(async () => {
    await stream.submit(
      { input: { input: 'Correct the existing work' } },
      { followUpMode: promote ? 'queue' : 'steer' },
    );
  });
  if (promote)
    await act(async () => {
      await stream.promotePendingFollowUpToSteer(stream.pendingFollowUps[0].id);
    });
}

describe.each([false, true])('follow-up admission, promoted=%s', (promote) => {
  setupHistoryTests();

  it('continues an unconsumed input explicitly returned to queue by the server', async () => {
    const finish = await runningConversation();
    await sendFollowUp(promote);
    const clientMessageId = stream.pendingFollowUps[0].clientMessageId;
    mocks.searchMessages.mockImplementation(async (_id, query) =>
      query.where.role === 'human'
        ? {
            items: [
              {
                id: 'saved',
                role: 'human',
                content: 'Correct the existing work',
                followUpMode: 'queue',
                followUpStatus: 'pending',
                thirdPartyMessage: { followUpClientMessageId: clientMessageId },
              },
            ],
            total: 1,
          }
        : history(query.where.threadId),
    );
    await waitFor(
      () => expect(stream.pendingFollowUps[0]?.mode).toBe('queue'),
      { timeout: 4_000 },
    );
    await finish();
    await waitFor(() => expect(mocks.runStream).toHaveBeenCalledTimes(2));
    expect(mocks.createRun).toHaveBeenCalledOnce();
  });

  it.each([
    new TypeError('Response lost'),
    Object.assign(new Error('Request timeout'), { status: 408 }),
    Object.assign(new Error('Gateway timeout'), { status: 504 }),
  ])('does not auto-resend an uncertain acceptance: %s', async (error) => {
    const finish = await runningConversation();
    mocks.createRun.mockRejectedValueOnce(error);
    await sendFollowUp(promote);
    expect(stream.pendingFollowUps).toHaveLength(1);
    expect(stream.pendingFollowUps[0].mode).toBe('steer');
    await finish();
    expect(mocks.createRun).toHaveBeenCalledOnce();
    expect(mocks.runStream).toHaveBeenCalledOnce();
    expect(stream.pendingFollowUps[0].mode).toBe('steer');
  });

  it('retains queued fallback when the server explicitly rejects the steer', async () => {
    const finish = await runningConversation();
    mocks.createRun.mockRejectedValueOnce(
      Object.assign(new Error('Target ended'), { status: 409 }),
    );
    await sendFollowUp(promote);
    expect(stream.pendingFollowUps[0].mode).toBe('queue');
    await finish();
    await waitFor(() => expect(mocks.runStream).toHaveBeenCalledTimes(2));
    expect(mocks.createRun).toHaveBeenCalledOnce();
  });

  it('recovers a consumed input whose acceptance response was lost without repeating it', async () => {
    const finish = await runningConversation();
    mocks.createRun.mockRejectedValueOnce(
      new TypeError('Response lost after persistence'),
    );
    await sendFollowUp(promote);
    const clientMessageId = stream.pendingFollowUps[0].clientMessageId;
    mocks.searchMessages.mockImplementation(async (_id, query) =>
      query.where.role === 'human'
        ? {
            items: [
              {
                id: 'saved',
                role: 'human',
                content: 'Correct the existing work',
                followUpMode: 'steer',
                followUpStatus: 'consumed',
                thirdPartyMessage: { followUpClientMessageId: clientMessageId },
              },
            ],
            total: 1,
          }
        : history(query.where.threadId),
    );
    await finish();
    await waitFor(() => expect(stream.pendingFollowUps).toHaveLength(0), {
      timeout: 4_000,
    });
    expect(
      stream.messages.some((message) => message.id === clientMessageId),
    ).toBe(true);
    expect(mocks.createRun).toHaveBeenCalledOnce();
    expect(mocks.runStream).toHaveBeenCalledOnce();
  });
});
