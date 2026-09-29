import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useExecutionFocus } from './useExecutionFocus';

function fixture() {
  return {
    executionId: 'attempt-2',
    requestId: 'navigation-1',
    requestedThread: 'thread',
    threadId: 'thread',
    scope: 'project:thread',
    externalRuns: [{ id: 'attempt-1' }, { id: 'attempt-2' }],
    messages: [],
    historyReady: true,
    history: {
      conversationId: 'conversation',
      threadId: 'thread',
      loadedCount: 10,
      total: 10,
      hasMore: false,
      isLoadingMore: false,
    },
    rootRef: { current: document.createElement('div') },
    loadMore: vi.fn(async () => undefined),
    openExternal: vi.fn(),
    onError: vi.fn(),
    unavailableMessage: 'Execution unavailable',
  };
}
describe('task execution focus', () => {
  it('waits for initial history hydration before declaring an execution absent', () => {
    const input = fixture();
    input.historyReady = false;
    input.externalRuns = [];
    const { rerender } = renderHook(() => useExecutionFocus({ ...input }));
    expect(input.onError).not.toHaveBeenCalled();
    expect(input.loadMore).not.toHaveBeenCalled();
    input.historyReady = true;
    input.externalRuns = [{ id: 'attempt-2' }];
    rerender();
    expect(input.openExternal).toHaveBeenCalledExactlyOnceWith('attempt-2');
    expect(input.onError).not.toHaveBeenCalled();
  });
  it('opens the exact repeated expert attempt once, without starting a conversation', () => {
    const input = fixture();
    const { rerender } = renderHook(() => useExecutionFocus(input));
    rerender();
    expect(input.openExternal).toHaveBeenCalledExactlyOnceWith('attempt-2');
    expect(input.loadMore).not.toHaveBeenCalled();
  });
  it('does not follow the target into a different thread', () => {
    const input = { ...fixture(), threadId: 'other-thread' };
    renderHook(() => useExecutionFocus(input));
    expect(input.openExternal).not.toHaveBeenCalled();
    expect(input.loadMore).not.toHaveBeenCalled();
  });
  it('opens the same attempt again only for a new explicit request', () => {
    const input = fixture();
    const { rerender } = renderHook(useExecutionFocus, { initialProps: input });
    rerender({ ...input });
    expect(input.openExternal).toHaveBeenCalledTimes(1);
    rerender({ ...input, requestId: 'navigation-2' });
    expect(input.openExternal).toHaveBeenCalledTimes(2);
    expect(input.openExternal).toHaveBeenLastCalledWith('attempt-2');
    expect(input.loadMore).not.toHaveBeenCalled();
  });
  it('allows a legacy focus request again after it is cleared', () => {
    const input = fixture();
    const { rerender } = renderHook(useExecutionFocus, { initialProps: input });
    rerender({ ...input, requestedThread: '' });
    rerender(input);
    expect(input.openExternal).toHaveBeenCalledTimes(2);
  });
  it('ignores an old pagination error when a new navigation has arrived', async () => {
    const input = fixture();
    input.externalRuns = [];
    input.history.hasMore = true;
    let rejectPage!: (reason: Error) => void;
    input.loadMore.mockImplementation(
      () =>
        new Promise((_resolve, reject) => {
          rejectPage = reject;
        }),
    );
    const { rerender } = renderHook(useExecutionFocus, { initialProps: input });
    rerender({
      ...input,
      requestId: 'navigation-2',
      externalRuns: [{ id: 'attempt-2' }],
    });
    await act(async () => {
      rejectPage(Error('Old navigation failed'));
    });
    expect(input.openExternal).toHaveBeenCalledExactlyOnceWith('attempt-2');
    expect(input.onError).not.toHaveBeenCalled();
  });
  it('loads successive history pages until the target attempt is available', async () => {
    const input = fixture();
    input.externalRuns = [];
    input.history = { ...input.history, total: 30, hasMore: true };
    input.loadMore.mockImplementation(async () => {
      input.history = {
        ...input.history,
        loadedCount: input.history.loadedCount + 10,
      };
      if (input.history.loadedCount === 30) {
        input.history.hasMore = false;
        input.externalRuns = [{ id: 'attempt-2' }];
      }
    });
    renderHook(() => useExecutionFocus(input));
    await waitFor(() =>
      expect(input.openExternal).toHaveBeenCalledWith('attempt-2'),
    );
    expect(input.loadMore).toHaveBeenCalledTimes(2);
  });
  it('reports an absent execution instead of silently selecting another attempt', () => {
    const input = fixture();
    input.externalRuns = [{ id: 'attempt-1' }];
    renderHook(() => useExecutionFocus(input));
    expect(input.onError).toHaveBeenCalledWith('Execution unavailable');
    expect(input.openExternal).not.toHaveBeenCalled();
  });
  it('surfaces pagination failure without a retry loop', async () => {
    const input = fixture();
    input.externalRuns = [];
    input.history.hasMore = true;
    input.loadMore.mockRejectedValue(Error('History access denied'));
    renderHook(() => useExecutionFocus(input));
    await waitFor(() =>
      expect(input.onError).toHaveBeenCalledWith('History access denied'),
    );
    expect(input.loadMore).toHaveBeenCalledTimes(1);
  });
  it('stops if the history endpoint returns no pagination progress', async () => {
    const input = fixture();
    input.externalRuns = [];
    input.history.hasMore = true;
    renderHook(() => useExecutionFocus(input));
    await waitFor(() =>
      expect(input.onError).toHaveBeenCalledWith('Execution unavailable'),
    );
    expect(input.loadMore).toHaveBeenCalledTimes(1);
  });
});
