import { act, render, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  deferred,
  mocks,
  provider,
  readStepStatus,
  setupHistoryTests,
  stream,
} from '../testing/history-fixture';

const live = {
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
const snapshot = (cursor = '200-0', continuous = true) => ({
  id: cursor,
  event: 'message',
  data: {
    type: 'stream_snapshot',
    continuous,
    snapshot: {
      version: 1,
      threadId: 'thread-1',
      runId: 'thread-1-run',
      segmentId: 'segment',
      revision: 200,
      cursor,
      activeMessageId: 'thread-1-ai',
      savedAt: '2026-10-22T00:00:00Z',
      messages: [
        {
          id: 'thread-1-ai',
          role: 'ai',
          executionId: 'thread-1-run',
          status: 'answering',
          content: [
            {
              type: 'component',
              id: 'tool-1',
              data: {
                category: 'Tool',
                tool: 'sandbox_shell',
                status: 'running',
              },
            },
          ],
          // Even a future server accidentally including commands must not dispatch them during hydration.
          clientToolCalls: [
            { id: 'client-tool', name: 'host.shell', args: {} },
          ],
          agentRuns: [{ id: 'agent-1', status: 'running' }],
        },
      ],
    },
  },
});

function discover() {
  mocks.watchActivity.mockImplementation(async function* (_id, options) {
    yield live;
    await new Promise<void>((resolve) =>
      options.signal.addEventListener('abort', resolve, { once: true }),
    );
  });
}

describe('trimmed display snapshot replay', () => {
  setupHistoryTests();
  it('hydrates tools without host effects, follows the tail once and rejoins using the applied cursor', async () => {
    discover();
    const progress = deferred<void>(),
      finish = deferred<void>();
    mocks.joinStream
      .mockReset()
      .mockImplementationOnce(async function* () {
        yield snapshot();
        await progress.promise;
        yield {
          id: '201-0',
          event: 'message',
          data: {
            type: 'message',
            data: {
              type: 'component',
              id: 'tool-1',
              data: { category: 'Tool', status: 'success' },
            },
          },
        };
        yield {
          id: '202-0',
          event: 'message',
          data: { type: 'message', data: 'done' },
        };
        throw new Error('Disconnected again');
      })
      .mockImplementation(async function* () {
        yield {
          id: '202-0',
          event: 'message',
          data: { type: 'message', data: 'done' },
        }; // duplicated transport chunk
        yield {
          id: '203-0',
          event: 'message',
          data: { type: 'message', data: '!' },
        };
        await finish.promise;
      });
    const view = render(provider('thread-1'));
    await waitFor(
      () => expect(readStepStatus(stream.messages.at(-1))).toBe('running'),
      { timeout: 2500 },
    );
    expect(mocks.sendCommand).not.toHaveBeenCalled();
    expect(
      mocks.sendEvent.mock.calls.some(
        ([name]) =>
          name === 'response.start' ||
          name === 'response.end' ||
          name === 'tool.start',
      ),
    ).toBe(false);
    expect(stream.messages.at(-1)?.clientToolCalls).toBeUndefined();
    await act(async () => progress.resolve());
    await waitFor(() =>
      expect(readStepStatus(stream.messages.at(-1))).toBe('success'),
    );
    await waitFor(
      () =>
        expect(JSON.stringify(stream.messages.at(-1)?.content)).toContain(
          '"text":"!"',
        ),
      { timeout: 3000 },
    );
    expect(
      JSON.stringify(stream.messages.at(-1)?.content).match(/done/g),
    ).toHaveLength(1);
    expect(mocks.joinStream.mock.calls[1][2]).toMatchObject({
      lastEventId: '202-0',
      displaySnapshot: true,
    });
    expect(stream.messages.filter((m) => m.id === 'thread-1-ai')).toHaveLength(
      1,
    );
    expect(mocks.runStream).not.toHaveBeenCalled();
    expect(mocks.resumeRun).not.toHaveBeenCalled();
    expect(mocks.sendCommand).not.toHaveBeenCalled();
    view.unmount();
    await act(async () => finish.resolve());
  });
  it('retries a broken tail without entering the ten-minute terminal reconciliation loop', async () => {
    discover();
    const finish = deferred<void>();
    mocks.joinStream
      .mockReset()
      .mockImplementationOnce(async function* () {
        yield snapshot('200-0', false);
      })
      .mockImplementation(async function* () {
        yield snapshot('300-0');
        await finish.promise;
      });
    const view = render(provider('thread-1'));
    await waitFor(() => expect(mocks.joinStream).toHaveBeenCalledTimes(2), {
      timeout: 3000,
    });
    expect(readStepStatus(stream.messages.at(-1))).toBe('running');
    expect(mocks.resumeRun).not.toHaveBeenCalled();
    expect(mocks.runStream).not.toHaveBeenCalled();
    view.unmount();
    await act(async () => finish.resolve());
  });
});
