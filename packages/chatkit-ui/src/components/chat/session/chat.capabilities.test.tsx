import { act, waitFor } from '@testing-library/react';
import type { Thread } from '@xpert-ai/xpert-sdk';
import { describe, expect, it, vi } from 'vitest';
import {
  baseChatOptions,
  Chat,
  mocks,
  renderChat,
  setupChatTest,
} from '../testing/chat-fixture';

function deferredBranches() {
  let resolve!: (branches: Thread[]) => void;
  const promise = new Promise<Thread[]>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

describe('Chat thread capability reads', () => {
  setupChatTest();

  it('reads once after branches resolve, then revalidates once after a run finishes', async () => {
    const first = deferredBranches();
    const afterRun = deferredBranches();
    const branches = [
      { thread_id: 'history-thread', status: 'idle' },
    ] as Thread[];
    const listThreads = vi
      .fn()
      .mockReturnValueOnce(first.promise)
      .mockResolvedValueOnce(branches)
      .mockReturnValueOnce(afterRun.promise);
    const getCapabilities = vi.fn().mockResolvedValue({ canRetry: true });
    mocks.stream.client.conversations.listThreads = listThreads;
    mocks.stream.client.threads.getCapabilities = getCapabilities;
    mocks.stream.threadId = 'history-thread';
    mocks.stream.conversationId = 'conversation';
    mocks.stream.projectScopeResolved = true;
    const view = renderChat();
    await act(async () => {});
    expect(getCapabilities).not.toHaveBeenCalled();
    await act(async () => first.resolve(branches));
    await waitFor(() =>
      expect(getCapabilities).toHaveBeenCalledExactlyOnceWith('history-thread'),
    );

    mocks.stream.isLoading = true;
    view.rerender(<Chat clientSecret="secret" options={baseChatOptions} />);
    await act(async () => {});
    expect(getCapabilities).toHaveBeenCalledTimes(1);
    mocks.stream.isLoading = false;
    view.rerender(<Chat clientSecret="secret" options={baseChatOptions} />);
    await act(async () => {});
    expect(getCapabilities).toHaveBeenCalledTimes(1);
    await act(async () =>
      afterRun.resolve([{ ...branches[0], status: 'error' }]),
    );
    await waitFor(() => expect(getCapabilities).toHaveBeenCalledTimes(2));
    expect(listThreads).toHaveBeenCalledTimes(3);
  });

  it('still asks the server for capabilities when the branch-list endpoint is unavailable', async () => {
    mocks.stream.client.conversations.listThreads = vi
      .fn()
      .mockRejectedValue({ status: 404 });
    const getCapabilities = vi.fn().mockResolvedValue({ canRetry: false });
    mocks.stream.client.threads.getCapabilities = getCapabilities;
    mocks.stream.threadId = 'history-thread';
    mocks.stream.conversationId = 'conversation';
    mocks.stream.projectScopeResolved = true;
    renderChat();
    await waitFor(() =>
      expect(getCapabilities).toHaveBeenCalledExactlyOnceWith('history-thread'),
    );
  });
});
