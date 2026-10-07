import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useChatRunControl } from './useChatRunControl';

function fixture() {
  return {
    branchState: { current: undefined, refresh: vi.fn(async () => undefined) },
    isChangingBranch: false,
    activeBranchRef: { current: 'thread-1' },
    stream: {
      threadId: 'thread-1', isLoading: true, activeRunId: 'run-1', isThreadInterrupted: false,
      stop: vi.fn(async () => undefined), pauseRun: vi.fn(async (): Promise<void> => undefined), resumeRun: vi.fn(async () => undefined),
    },
  } satisfies Parameters<typeof useChatRunControl>[0];
}

describe('run-control errors belong to the current submission', () => {
  it('ignores a late error from the preceding submission while still showing new failures', async () => {
    const options = fixture();
    let reject!: (error: Error) => void;
    options.stream.pauseRun.mockReturnValueOnce(new Promise<void>((_resolve, fail) => { reject = fail; }));
    const { result } = renderHook(() => useChatRunControl(options));
    let pending!: Promise<void>;
    act(() => { pending = result.current.handleComposerRunControl('pause'); });
    act(() => { result.current.clearRunControlError(); });
    await act(async () => { reject(new Error('previous request failed')); await pending; });
    expect(result.current.runControlError).toBeNull();
    options.stream.pauseRun.mockRejectedValueOnce(new Error('current request failed'));
    await act(async () => { await result.current.handleComposerRunControl('pause'); });
    expect(result.current.runControlError?.message).toBe('current request failed');
  });

  it('does not restore an old error after leaving and returning to a thread', async () => {
    const options = fixture();
    options.stream.pauseRun.mockRejectedValueOnce(new Error('old error'));
    const { result, rerender } = renderHook(() => useChatRunControl(options));
    await act(async () => { await result.current.handleComposerRunControl('pause'); });
    options.stream.threadId = 'thread-2';
    options.activeBranchRef.current = 'thread-2';
    rerender();
    options.stream.threadId = 'thread-1';
    options.activeBranchRef.current = 'thread-1';
    rerender();
    expect(result.current.runControlError).toBeNull();
  });
});
