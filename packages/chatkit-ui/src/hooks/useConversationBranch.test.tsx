import { act, renderHook } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { ChatConversation, Client } from '@xpert-ai/xpert-sdk';
import { useConversationBranch } from './useConversationBranch';

const target = {
  id: 'new-conversation',
  threadId: 'new-thread',
} as ChatConversation;

function setup(branch = vi.fn().mockResolvedValue(target)) {
  const load = vi.fn().mockResolvedValue(undefined);
  const ready = vi.fn();
  const refresh = vi.fn().mockResolvedValue(undefined);
  const client = { conversations: { branch } } as unknown as Client;
  const hook = renderHook(() => {
    const [threadId, select] = useState('source');
    const state = useConversationBranch({
      client,
      conversationId: 'conversation',
      threadId,
      navigate: async (id) => {
        select(id);
        await load(id);
      },
      onReady: ready,
      refresh,
    });
    return { ...state, threadId, select };
  });
  return { ...hook, branch, load, ready, refresh };
}

describe('useConversationBranch', () => {
  it('creates and opens the conversation without sending a human message', async () => {
    const test = setup();
    await act(() => test.result.current.branch('a1'));
    expect(test.branch).toHaveBeenCalledWith('conversation', {
      sourceThreadId: 'source',
      afterMessageId: 'a1',
      requestId: expect.any(String),
    });
    expect(test.load).toHaveBeenCalledWith('new-thread');
    expect(test.result.current.threadId).toBe('new-thread');
    expect(test.ready).toHaveBeenCalledOnce();
    expect(test.refresh).toHaveBeenCalledOnce();
  });

  it('deduplicates clicks and ignores a response after navigation away and back', async () => {
    let resolve!: (value: ChatConversation) => void;
    const test = setup(
      vi.fn(
        () =>
          new Promise<ChatConversation>((done) => {
            resolve = done;
          }),
      ),
    );
    let pending!: Promise<void>;
    act(() => {
      pending = test.result.current.branch('a1');
      void test.result.current.branch('a1');
    });
    expect(test.branch).toHaveBeenCalledOnce();
    act(() => test.result.current.select('another'));
    act(() => test.result.current.select('source'));
    await act(async () => {
      resolve(target);
      await pending;
    });
    expect(test.load).not.toHaveBeenCalled();
    expect(test.ready).not.toHaveBeenCalled();
  });

  it('retries an uncertain creation with the same request id and preserves the draft', async () => {
    const test = setup(
      vi
        .fn()
        .mockRejectedValueOnce(new Error('Network failed'))
        .mockResolvedValue(target),
    );
    await act(() => test.result.current.branch('a1'));
    expect(test.ready).not.toHaveBeenCalled();
    expect(test.result.current.error).toBe('Network failed');
    await act(() => test.result.current.branch('a1'));
    expect(test.branch.mock.calls[0][1]).toEqual(test.branch.mock.calls[1][1]);
    expect(test.ready).toHaveBeenCalledOnce();
  });

  it('returns to the source after history fails and reuses the created conversation on retry', async () => {
    const test = setup();
    test.load.mockRejectedValueOnce(new Error('History failed'));
    await act(() => test.result.current.branch('a1'));
    expect(test.result.current.threadId).toBe('source');
    expect(test.ready).not.toHaveBeenCalled();
    await act(() => test.result.current.branch('a1'));
    expect(test.branch).toHaveBeenCalledOnce();
    expect(test.ready).toHaveBeenCalledOnce();
  });

  it('does not roll back a loaded conversation if the sidebar refresh fails', async () => {
    const test = setup();
    test.refresh.mockRejectedValue(new Error('Sidebar offline'));
    await act(() => test.result.current.branch('a1'));
    expect(test.result.current.threadId).toBe('new-thread');
    expect(test.result.current.error).toBeNull();
  });

  it('ignores a pending request when the component unmounts', async () => {
    let resolve!: (value: ChatConversation) => void;
    const test = setup(
      vi.fn(
        () =>
          new Promise<ChatConversation>((done) => {
            resolve = done;
          }),
      ),
    );
    let pending!: Promise<void>;
    act(() => {
      pending = test.result.current.branch('a1');
    });
    test.unmount();
    await act(async () => {
      resolve(target);
      await pending;
    });
    expect(test.load).not.toHaveBeenCalled();
  });
});
