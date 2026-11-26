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
import type { PersistedChatMessage } from '../types';

const receipt = (
  status: PersistedChatMessage['followUpStatus'],
): PersistedChatMessage => ({
  id: 'saved-follow-up',
  role: 'human',
  content: 'Correct the existing work',
  followUpMode: 'steer',
  followUpStatus: status,
  visibleAt: status === 'consumed' ? '2026-01-01T00:00:00Z' : null,
  thirdPartyMessage: { followUpClientMessageId: 'client-follow-up' },
});
const page = (status: PersistedChatMessage['followUpStatus']) => ({
  items: [receipt(status)],
  total: 1,
});

describe('follow-up reads independent of output transport', () => {
  setupHistoryTests();

  it('retries a failed receipt read and clears the connection error without starting a run', async () => {
    let reads = 0;
    mocks.searchMessages.mockImplementation(async (_id, query) => {
      if (query.where.role !== 'human') return page('pending');
      if (++reads === 1)
        throw Object.assign(new Error('Service restarting'), { status: 503 });
      return page('consumed');
    });
    render(provider('thread-1'));
    await waitFor(() => expect(stream.connectionState).toBe('reconnecting'));
    expect(stream.pendingFollowUps).toHaveLength(1);
    await waitFor(() => expect(stream.pendingFollowUps).toHaveLength(0), {
      timeout: 4_000,
    });
    expect(stream.connectionState).toBe('connected');
    expect(stream.messages.some((m) => m.id === 'client-follow-up')).toBe(true);
    expect(mocks.runStream).not.toHaveBeenCalled();
    expect(mocks.createRun).not.toHaveBeenCalled();
  });

  it('resumes receipt reads on explicit reconnect after a non-retryable read failure', async () => {
    let available = false;
    mocks.searchMessages.mockImplementation(async (_id, query) => {
      if (query.where.role !== 'human') return page('pending');
      if (!available)
        throw Object.assign(new Error('Read denied'), { status: 403 });
      return page('canceled');
    });
    render(provider('thread-1'));
    await waitFor(() => expect(stream.connectionState).toBe('unavailable'));
    expect(stream.pendingFollowUps).toHaveLength(1);
    available = true;
    await act(async () => {
      stream.reconnect?.();
    });
    await waitFor(() => expect(stream.pendingFollowUps).toHaveLength(0));
    expect(stream.connectionState).toBe('connected');
    expect(mocks.runStream).not.toHaveBeenCalled();
    expect(mocks.createRun).not.toHaveBeenCalled();
  });

  it('observes a pending input becoming consumed after the transport is already idle', async () => {
    let reads = 0;
    mocks.searchMessages.mockImplementation(async (_id, query) => {
      if (query.where.role !== 'human') return page('pending');
      return page(++reads === 1 ? 'pending' : 'consumed');
    });
    render(provider('thread-1'));
    await waitFor(() => expect(stream.pendingFollowUps).toHaveLength(1));
    expect(stream.isLoading).toBe(false);
    await waitFor(() => expect(stream.pendingFollowUps).toHaveLength(0), {
      timeout: 4_000,
    });
    expect(mocks.runStream).not.toHaveBeenCalled();
    expect(mocks.createRun).not.toHaveBeenCalled();
  });

  it('ignores a late receipt after switching branches in the same conversation', async () => {
    const old = deferred<ReturnType<typeof page>>();
    let oldSignal: AbortSignal | undefined;
    mocks.getThread.mockImplementation(async () => ({
      metadata: { id: 'shared-conversation' },
    }));
    mocks.searchMessages.mockImplementation(async (_id, query, options) => {
      if (query.where.role === 'human' && query.where.threadId === 'thread-1') {
        oldSignal = options.signal;
        return old.promise;
      }
      if (query.where.role === 'human') return page('pending');
      return {
        items: [...history(query.where.threadId).items, receipt('pending')],
        total: 3,
      };
    });
    render(provider('thread-1'));
    await waitFor(() => expect(oldSignal).toBeDefined());
    await act(async () => {
      await stream.loadThread('thread-2');
    });
    await waitFor(() =>
      expect(stream.messages.some((m) => m.id === 'thread-2-ai')).toBe(true),
    );
    expect(oldSignal?.aborted).toBe(true);
    await act(async () => {
      old.resolve(page('consumed'));
    });
    expect(stream.pendingFollowUps).toHaveLength(1);
    expect(stream.messages.some((m) => m.id === 'client-follow-up')).toBe(
      false,
    );
    expect(mocks.runStream).not.toHaveBeenCalled();
    expect(mocks.createRun).not.toHaveBeenCalled();
  });
});
