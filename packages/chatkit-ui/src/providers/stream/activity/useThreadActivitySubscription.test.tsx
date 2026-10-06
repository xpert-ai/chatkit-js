import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Client, ThreadActivitySnapshot } from '@xpert-ai/xpert-sdk';
import type { StateType } from '../types';
import { useThreadActivitySubscription } from './useThreadActivitySubscription';

type Run = ThreadActivitySnapshot['runs'][number];
const run = (id: string, status: string): Run => ({
  id,
  status,
  createdAt: '2026-10-06T12:00:00Z',
  updatedAt: '2026-10-06T12:00:01Z',
  messageRevision: '1',
});
function fixture() {
  let receive: ((value: ThreadActivitySnapshot | null) => void) | undefined;
  const watchActivity = vi.fn(async function* (
    _id: string,
    options?: { signal?: AbortSignal },
  ) {
    while (!options?.signal?.aborted) {
      const next = await new Promise<ThreadActivitySnapshot | null>(
        (resolve) => {
          receive = resolve;
          options?.signal?.addEventListener('abort', () => resolve(null), {
            once: true,
          });
        },
      );
      if (!next) return;
      yield next;
    }
  });
  const searchMessages = vi.fn().mockResolvedValue({
    items: [
      {
        id: 'reply',
        role: 'ai',
        executionId: 'fast',
        content: 'finished',
        createdAt: '2026-10-06T12:00:00Z',
      },
    ],
    total: 1,
  });
  const valuesRef = { current: { messages: [] } as StateType };
  const setValues = vi.fn(
    (change: StateType | ((value: StateType) => StateType)) => {
      valuesRef.current =
        typeof change === 'function' ? change(valuesRef.current) : change;
    },
  );
  const options = {
    client: {
      threads: { watchActivity },
      conversations: { searchMessages },
    } as unknown as Client<StateType>,
    threadId: 'thread',
    conversationId: 'conversation',
    scopeKey: 'scope',
    enabled: true,
    valuesRef,
    setValues,
    isLoadingRef: { current: false },
    pauseRequestedRef: { current: false },
    runStream: vi.fn().mockResolvedValue(undefined),
  };
  const publish = async (
    runs: Run[],
    cards: ThreadActivitySnapshot['cards'] = [],
  ) => {
    await act(async () => {
      receive?.({ version: 1, threadId: 'thread', runs, cards });
      await Promise.resolve();
    });
  };
  const tick = async (ms = 1000) =>
    act(async () => {
      await vi.advanceTimersByTimeAsync(ms);
    });
  return { options, watchActivity, searchMessages, valuesRef, publish, tick };
}
describe('background answer discovery', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());
  it('reconciles concurrent completed answers independently and picks up delayed final persistence', async () => {
    const f = fixture();
    f.searchMessages.mockImplementation(async (_id, query) => ({
      items: [
        {
          id: `message-${query.where.executionId}`,
          role: 'ai',
          executionId: query.where.executionId,
          content:
            query.where.executionId === 'first'
              ? 'First result'
              : 'Second result',
        },
      ],
      total: 1,
    }));
    const view = renderHook(() => useThreadActivitySubscription(f.options));
    await f.publish([run('first', 'success'), run('second', 'success')]);
    await f.tick();
    expect(
      f.valuesRef.current.messages.map((message) => message.content),
    ).toEqual(['First result', 'Second result']);
    f.searchMessages.mockResolvedValue({
      items: [
        {
          id: 'message-first',
          role: 'ai',
          executionId: 'first',
          content: 'Final persisted result',
        },
      ],
      total: 1,
    });
    await f.publish([
      { ...run('first', 'success'), messageRevision: '2' },
      run('second', 'success'),
    ]);
    await f.tick();
    expect(
      f.valuesRef.current.messages.map((message) => message.content),
    ).toEqual(['Final persisted result', 'Second result']);
    expect(f.searchMessages).toHaveBeenCalledTimes(3);
    view.unmount();
  });
  it('finds an answer that finished before notification, merges it once, and stays subscribed', async () => {
    const f = fixture();
    const view = renderHook(() => useThreadActivitySubscription(f.options));
    await f.publish([run('fast', 'success')]);
    await f.tick();
    await f.tick();
    expect(
      f.valuesRef.current.messages.map((message) => message.content),
    ).toEqual(['finished']);
    expect(f.searchMessages).toHaveBeenCalledTimes(1);
    expect(f.options.runStream).not.toHaveBeenCalled();
    expect(f.watchActivity.mock.calls[0][1]?.signal?.aborted).toBe(false);
    view.unmount();
    expect(f.watchActivity.mock.calls[0][1]?.signal?.aborted).toBe(true);
  });
  it('does not steal a local stream or resume a paused run', async () => {
    const f = fixture();
    f.options.isLoadingRef.current = true;
    const view = renderHook(() => useThreadActivitySubscription(f.options));
    await f.publish([run('background', 'running')]);
    await f.tick();
    expect(f.options.runStream).not.toHaveBeenCalled();
    f.options.isLoadingRef.current = false;
    f.options.pauseRequestedRef.current = true;
    await f.tick();
    expect(f.options.runStream).not.toHaveBeenCalled();
    f.options.pauseRequestedRef.current = false;
    await f.tick();
    expect(f.options.runStream).toHaveBeenCalledWith(
      'thread',
      null,
      { joinExistingThread: true },
      'background',
    );
    view.unmount();
  });
  it('discards a late final-message response after a scope switch', async () => {
    const f = fixture();
    let finish: (value: object) => void = () => undefined;
    f.searchMessages.mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const view = renderHook((props) => useThreadActivitySubscription(props), {
      initialProps: f.options,
    });
    await f.publish([run('fast', 'success')]);
    await f.tick();
    view.rerender({ ...f.options, threadId: 'other', scopeKey: 'other-scope' });
    await act(async () => {
      finish({
        items: [{ id: 'old', role: 'ai', content: 'wrong thread' }],
        total: 1,
      });
    });
    expect(f.valuesRef.current.messages).toEqual([]);
    view.unmount();
  });
  it('updates bound cards while a background answer is still streaming', async () => {
    const f = fixture();
    let finishStream: () => void = () => undefined;
    f.options.runStream.mockImplementation(
      () => new Promise<void>((resolve) => { finishStream = resolve; }),
    );
    const card = {
      type: 'resource_card' as const,
      id: '["platform.project-tasks","execution","attempt"]',
      messageId: 'owner',
      data: {
        resource: {
          namespace: 'platform.project-tasks',
          type: 'execution',
          id: 'attempt',
        },
        title: 'Task',
        description: 'Running',
        open: {
          target: 'workbench.view' as const,
          viewKey: 'platform.project-tasks__timeline',
        },
      },
    };
    f.valuesRef.current = {
      messages: [
        {
          id: 'owner',
          type: 'ai',
          content: [{ type: 'text', text: 'Delegated' }, card],
        },
        { id: 'newer', type: 'ai', content: 'Checking result' },
      ],
    };
    const view = renderHook(() => useThreadActivitySubscription(f.options));
    await f.publish([run('background', 'running')], [card]);
    await f.tick();
    expect(f.options.runStream).toHaveBeenCalledTimes(1);
    await f.publish(
      [run('background', 'running')],
      [{ ...card, data: { ...card.data, description: 'Execution succeeded' } }],
    );
    await f.tick();
    const text = JSON.stringify(f.valuesRef.current);
    expect(text).toContain('Delegated');
    expect(text).toContain('Execution succeeded');
    expect(f.valuesRef.current.messages[1].content).toBe('Checking result');
    view.unmount();
    await act(async () => finishStream());
  });
});
