import { act, render, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  deferred,
  mocks,
  provider,
  setupHistoryTests,
  stream,
} from '../testing/history-fixture';

describe('background output replay', () => {
  setupHistoryTests();

  it('recovers from a disconnected stream using its cursor without duplicating loaded text', async () => {
    const finish = deferred<void>();
    const snapshot = {
      version: 1,
      threadId: 'thread-1',
      cards: [],
      runs: [
        {
          id: 'thread-1-run',
          status: 'running',
          createdAt: '1',
          updatedAt: '2',
          messageRevision: '',
        },
      ],
    };
    mocks.watchActivity.mockImplementation(async function* (_id, options) {
      yield snapshot;
      await new Promise<void>((resolve) =>
        options.signal.addEventListener('abort', resolve, { once: true }),
      );
    });
    mocks.joinStream
      .mockReset()
      .mockImplementationOnce(async function* () {
        yield { id: '1-0', event: 'message', data: { type: 'stream_start' } };
        yield {
          id: '2-0',
          event: 'message',
          data: {
            type: 'event',
            event: 'on_message_start',
            data: {
              id: 'thread-1-ai',
              type: 'ai',
              executionId: 'thread-1-run',
            },
          },
        };
        yield {
          id: '3-0',
          event: 'message',
          data: { type: 'message', data: 'Hello' },
        };
        throw new Error('Temporary disconnect');
      })
      .mockImplementation(async function* () {
        yield {
          id: '4-0',
          event: 'message',
          data: { type: 'message', data: ' world' },
        };
        await finish.promise;
      });
    const view = render(provider('thread-1'));
    await waitFor(() => expect(stream.historyLoad.status).toBe('loaded'));
    await waitFor(() => expect(stream.messages.at(-1)?.content).toBe('Hello'), {
      timeout: 2000,
    });
    await waitFor(
      () => expect(stream.messages.at(-1)?.content).toBe('Hello world'),
      { timeout: 2500 },
    );
    expect(mocks.joinStream.mock.calls[1][2].lastEventId).toBe('3-0');
    expect(
      stream.messages.filter((message) => message.id === 'thread-1-ai'),
    ).toHaveLength(1);
    expect(mocks.runStream).not.toHaveBeenCalled();
    expect(mocks.resumeRun).not.toHaveBeenCalled();
    expect(mocks.cancelRun).not.toHaveBeenCalled();
    view.unmount();
    await act(async () => finish.resolve());
  });
});
