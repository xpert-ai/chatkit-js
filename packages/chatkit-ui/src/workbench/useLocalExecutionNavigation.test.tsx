import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useLocalExecutionNavigation } from './useLocalExecutionNavigation';
import type { ExecutionNavigationResult } from './client-command-payload';

function fixture() {
  return {
    scope: 'assistant:thread',
    navigationKey: '',
    conversationId: 'conversation',
    threadId: 'thread',
    projectId: 'project',
    externalRuns: [{ id: 'attempt-1' }, { id: 'attempt-2' }],
    messages: [] as { executionId?: string }[],
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
    openExternal: vi.fn(),
    revealMessage: vi.fn(),
    loadMore: vi.fn(async (): Promise<void> => undefined),
    unavailableMessage: 'Execution unavailable',
  };
}
const target = {
  conversationId: 'conversation',
  threadId: 'thread',
  executionId: 'attempt-2',
};
describe('local execution navigation', () => {
  it('opens and reopens the exact cached attempt without reloading history', async () => {
    const input = fixture();
    const { result } = renderHook(() => useLocalExecutionNavigation(input));
    for (let i = 0; i < 2; i++) {
      let response!: Promise<ExecutionNavigationResult>;
      act(() => {
        response = result.current(target);
      });
      expect(await response).toEqual({ success: true, status: 'opened' });
    }
    expect(input.openExternal).toHaveBeenCalledTimes(2);
    expect(input.openExternal).toHaveBeenLastCalledWith('attempt-2');
    expect(input.loadMore).not.toHaveBeenCalled();
  });
  it('leaves other conversations/branches to the host and rejects inconsistent project hints', async () => {
    const input = fixture();
    const { result } = renderHook(() => useLocalExecutionNavigation(input));
    expect(
      await result.current({ ...target, conversationId: 'other' }),
    ).toMatchObject({ code: 'unsupported' });
    expect(
      await result.current({ ...target, threadId: 'other-branch' }),
    ).toMatchObject({ code: 'unsupported' });
    expect(
      await result.current({ ...target, projectId: 'other' }),
    ).toMatchObject({ code: 'navigation_mismatch' });
    expect(input.openExternal).not.toHaveBeenCalled();
  });
  it('loads older pages internally until the exact execution is available', async () => {
    const input = fixture();
    input.externalRuns = [];
    input.history.hasMore = true;
    input.history.total = 30;
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
    const { result } = renderHook(() =>
      useLocalExecutionNavigation({ ...input }),
    );
    let response!: Promise<ExecutionNavigationResult>;
    act(() => {
      response = result.current(target);
    });
    await waitFor(() =>
      expect(input.openExternal).toHaveBeenCalledWith('attempt-2'),
    );
    expect(await response).toEqual({ success: true, status: 'opened' });
    expect(input.loadMore).toHaveBeenCalledTimes(2);
  });
  it('waits for initial hydration without treating a cache miss as unsupported', async () => {
    const input = fixture();
    input.historyReady = false;
    input.externalRuns = [];
    const { result, rerender } = renderHook(useLocalExecutionNavigation, {
      initialProps: input,
    });
    let response!: Promise<ExecutionNavigationResult>;
    act(() => {
      response = result.current(target);
    });
    expect(input.loadMore).not.toHaveBeenCalled();
    rerender({
      ...input,
      historyReady: true,
      externalRuns: [{ id: 'attempt-2' }],
    });
    expect(await response).toEqual({ success: true, status: 'opened' });
  });
  it('reports missing executions and read failures without falling back or retrying', async () => {
    const input = fixture();
    input.externalRuns = [];
    const { result, rerender } = renderHook(useLocalExecutionNavigation, {
      initialProps: input,
    });
    let response!: Promise<ExecutionNavigationResult>;
    act(() => {
      response = result.current(target);
    });
    expect(await response).toMatchObject({
      success: false,
      code: 'execution_unavailable',
    });
    input.history.hasMore = true;
    input.loadMore.mockRejectedValue(new Error('Access denied'));
    rerender({ ...input });
    act(() => {
      response = result.current(target);
    });
    await act(async () => {
      expect(await response).toMatchObject({
        code: 'execution_load_failed',
        message: 'Access denied',
      });
    });
    expect(input.loadMore).toHaveBeenCalledTimes(1);
  });
  it('does not open retained history from a previous branch during hydration', async () => {
    const input = fixture();
    input.history.threadId = 'old-branch';
    input.historyReady = false;
    const { result, rerender } = renderHook(useLocalExecutionNavigation, {
      initialProps: input,
    });
    let response!: Promise<ExecutionNavigationResult>;
    act(() => {
      response = result.current(target);
    });
    expect(input.openExternal).not.toHaveBeenCalled();
    rerender({
      ...input,
      historyReady: true,
      externalRuns: [],
      history: { ...input.history, threadId: 'thread' },
    });
    expect(await response).toMatchObject({ code: 'execution_unavailable' });
    expect(input.openExternal).not.toHaveBeenCalled();
  });
  it('cancels a pending selection when the scope changes, ignoring late responses', async () => {
    const input = fixture();
    input.externalRuns = [];
    input.history.hasMore = true;
    let finish!: () => void;
    input.loadMore.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    const { result, rerender } = renderHook(useLocalExecutionNavigation, {
      initialProps: input,
    });
    let response!: Promise<ExecutionNavigationResult>;
    act(() => {
      response = result.current(target);
    });
    rerender({
      ...input,
      scope: 'other',
      threadId: 'other',
      externalRuns: [{ id: 'attempt-2' }],
    });
    expect(await response).toMatchObject({ code: 'stale_context' });
    await act(async () => {
      finish();
    });
    expect(input.openExternal).not.toHaveBeenCalled();
  });
  it('settles a pending command on unmount', async () => {
    const input = { ...fixture(), historyReady: false, externalRuns: [] };
    const { result, unmount } = renderHook(() =>
      useLocalExecutionNavigation(input),
    );
    let response!: Promise<ExecutionNavigationResult>;
    act(() => {
      response = result.current(target);
    });
    unmount();
    expect(await response).toMatchObject({ code: 'stale_context' });
  });
  it('reports an initial history load failure instead of leaving the command pending', async () => {
    const input = {
      ...fixture(),
      historyReady: false,
      externalRuns: [],
      historyError: undefined as string | undefined,
    };
    const { result, rerender } = renderHook(useLocalExecutionNavigation, {
      initialProps: input,
    });
    let response!: Promise<ExecutionNavigationResult>;
    act(() => {
      response = result.current(target);
    });
    rerender({ ...input, historyError: 'History access denied' });
    expect(await response).toMatchObject({
      code: 'execution_load_failed',
      message: 'History access denied',
    });
    expect(input.loadMore).not.toHaveBeenCalled();
  });
  it('a newer selection wins while an older page is loading', async () => {
    const input = fixture();
    input.externalRuns = [{ id: 'attempt-1' }];
    input.history.hasMore = true;
    let finish!: () => void;
    input.loadMore.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    const { result } = renderHook(() => useLocalExecutionNavigation(input));
    let first!: Promise<ExecutionNavigationResult>,
      second!: Promise<ExecutionNavigationResult>;
    act(() => {
      first = result.current(target);
    });
    act(() => {
      second = result.current({ ...target, executionId: 'attempt-1' });
    });
    expect(await first).toMatchObject({ code: 'stale_context' });
    expect(await second).toMatchObject({ success: true });
    await act(async () => {
      finish();
    });
    expect(input.openExternal).toHaveBeenCalledExactlyOnceWith('attempt-1');
  });
  it('reveals and scrolls a main Agent execution instead of opening an unrelated expert', async () => {
    const input = fixture();
    const anchor = document.createElement('div');
    anchor.dataset.executionId = 'root';
    anchor.scrollIntoView = vi.fn();
    input.rootRef.current.append(anchor);
    input.messages = [{ executionId: 'root' }];
    const { result } = renderHook(() => useLocalExecutionNavigation(input));
    let response!: Promise<ExecutionNavigationResult>;
    act(() => {
      response = result.current({ ...target, executionId: 'root' });
    });
    expect(await response).toMatchObject({ success: true });
    expect(anchor.scrollIntoView).toHaveBeenCalled();
    expect(input.revealMessage).toHaveBeenCalled();
    expect(input.openExternal).not.toHaveBeenCalled();
  });
});
