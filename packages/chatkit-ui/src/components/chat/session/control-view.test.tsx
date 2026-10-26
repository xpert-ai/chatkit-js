import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useChatRunControl } from './useChatRunControl';

describe('accepted termination with a still-running owned tool', () => {
  it('keeps stopping visible and disables duplicate stop after refresh', async () => {
    const options: Parameters<typeof useChatRunControl>[0] = {
      branchState: {
        current: {
          thread_id: 'thread',
          status: 'busy',
          metadata: {},
          values: {},
          interrupts: {},
          created_at: '',
          updated_at: '',
          runControl: { executionId: 'run', state: 'terminating' },
        },
        refresh: vi.fn(async () => undefined),
      },
      isChangingBranch: false,
      activeBranchRef: { current: 'thread' },
      stream: {
        threadId: 'thread',
        isLoading: false,
        activeRunId: 'run',
        isThreadInterrupted: true,
        stop: vi.fn(async () => undefined),
        pauseRun: vi.fn(async () => undefined),
        resumeRun: vi.fn(async () => undefined),
      },
    };
    const { result, rerender } = renderHook(() => useChatRunControl(options));
    await act(async () => {
      await result.current.handleComposerRunControl('stop');
    });
    rerender();
    console.info(
      'Accepted cancellation; owned tool still active; refreshed UI',
      {
        stopping: result.current.isStoppingRun,
        stopEnabled: result.current.canStopRun,
      },
    );
    expect(result.current.isStoppingRun).toBe(true);
    expect(result.current.canStopRun).toBe(false);
  });
});
