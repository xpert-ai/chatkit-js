import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ThreadControlView } from '@xpert-ai/xpert-sdk';
import { useChatRunControl } from './useChatRunControl';

const actions: ThreadControlView['actions'] = {
  canPause: false,
  canResume: false,
  canTerminate: false,
  canSend: false,
  canQueue: false,
  canRetry: false,
  canRespond: false,
};
function options(
  state: ThreadControlView['state'],
  capabilities: Partial<ThreadControlView['actions']> = {},
) {
  const view: ThreadControlView = {
    version: 1,
    threadId: 'thread',
    runId: 'run',
    revision: '2',
    state,
    actions: { ...actions, ...capabilities },
  };
  const value: Parameters<typeof useChatRunControl>[0] = {
    branchState: {
      current: {
        thread_id: 'thread',
        created_at: '',
        updated_at: '',
        metadata: {},
        values: {},
        interrupts: {},
        status: 'busy',
        controlView: view,
        runControl: {
          executionId: 'old-run',
          state: 'paused',
          pauseId: 'old-token',
        },
      },
      refresh: vi.fn(async () => undefined),
    },
    isChangingBranch: false,
    activeBranchRef: { current: 'thread' },
    stream: {
      threadId: 'thread',
      activeRunId: 'run',
      isLoading: false,
      isThreadInterrupted: true,
      stop: vi.fn(async () => undefined),
      pauseRun: vi.fn(async () => undefined),
      resumeRun: vi.fn(async () => undefined),
    },
  };
  return { value, view };
}
describe('authoritative controls and delayed acknowledgements', () => {
  it('keeps execution controls stable through repeated output reconnects until confirmed completion', () => {
    const { value, view } = options('running', {
      canPause: true,
      canTerminate: true,
    });
    value.stream.isThreadInterrupted = false;
    const { result, rerender } = renderHook(() => useChatRunControl(value));
    for (const isLoading of [true, false, true, false]) {
      value.stream.isLoading = isLoading;
      value.stream.connectionState = isLoading ? 'connected' : 'reconnecting';
      rerender();
      expect(result.current.isRunActive).toBe(true);
      expect(result.current.canStopRun).toBe(true);
      expect(result.current.canSubmit).toBe(false);
    }
    value.stream.connectionState = 'connected';
    value.branchState.current!.controlView = {
      ...view,
      state: 'completed',
      actions: { ...actions, canSend: true },
    };
    rerender();
    expect(result.current.isRunActive).toBe(false);
    expect(result.current.canStopRun).toBe(false);
    expect(result.current.canSubmit).toBe(true);
    expect(value.stream.stop).not.toHaveBeenCalled();
  });
  it('retains accepted stop through unavailable reads, and opens send only on confirmed settlement', async () => {
    const { value, view } = options('running', {
      canTerminate: true,
      canPause: true,
      canQueue: true,
    });
    const { result, rerender } = renderHook(() => useChatRunControl(value));
    await act(() => result.current.handleComposerRunControl('stop'));
    value.branchState.controlUnavailable = true;
    rerender();
    expect(result.current.controlStatus).toBe('stopping');
    expect(result.current.canSubmit).toBe(false);
    expect(result.current.canStopRun).toBe(false);
    await act(() => result.current.handleComposerRunControl('stop'));
    expect(value.stream.stop).toHaveBeenCalledTimes(1);
    value.branchState.controlUnavailable = false;
    value.branchState.current!.controlView = {
      ...view,
      revision: '3',
      state: 'stopped',
      actions: { ...actions, canSend: true },
    };
    rerender();
    expect(result.current.canSubmit).toBe(true);
    expect(result.current.canResumeRun).toBe(false);
  });
  it('keeps necessary input enabled during pause without permitting a new run', () => {
    const { value } = options('input_required', {
      canRespond: true,
      canTerminate: true,
    });
    const { result, rerender } = renderHook(() => useChatRunControl(value));
    expect(result.current.canRespond).toBe(true);
    expect(result.current.canSubmit).toBe(false);
    expect(result.current.canResumeRun).toBe(false);
    value.branchState.controlUnavailable = true;
    rerender();
    expect(result.current.canRespond).toBe(false);
  });
  it('never revives old raw paused controls when the public view is stopping', async () => {
    const { value } = options('stopping');
    const { result } = renderHook(() => useChatRunControl(value));
    await act(() => result.current.handleComposerRunControl('resume'));
    expect(value.stream.resumeRun).not.toHaveBeenCalled();
    expect(result.current.isRunPaused).toBe(false);
    expect(result.current.controlStatus).toBe('stopping');
  });
  it('binds pause/resume to the public run and opaque token', async () => {
    const { value, view } = options('paused', { canResume: true });
    view.pauseId = 'current-token';
    const { result } = renderHook(() => useChatRunControl(value));
    await act(() => result.current.handleComposerRunControl('resume'));
    expect(value.stream.resumeRun).toHaveBeenCalledWith('run', 'current-token');
  });
  it('ignores a late stop acknowledgement after switching threads', async () => {
    const { value } = options('running', { canTerminate: true });
    let release!: () => void;
    value.stream.stop = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          release = resolve;
        }),
    );
    const { result, rerender } = renderHook(() => useChatRunControl(value));
    let pending!: Promise<void>;
    act(() => {
      pending = result.current.handleComposerRunControl('stop');
    });
    value.activeBranchRef.current = 'new';
    value.stream.threadId = 'new';
    value.branchState.current = {
      thread_id: 'new',
      created_at: '',
      updated_at: '',
      metadata: {},
      values: {},
      interrupts: {},
      status: 'idle',
    };
    rerender();
    await act(async () => {
      release();
      await pending;
    });
    expect(result.current.isStoppingRun).toBe(false);
    expect(value.branchState.refresh).not.toHaveBeenCalled();
  });
  it('does not send controls to a snapshot from the previous run while the new stream is active', async () => {
    const { value } = options('running', {
      canPause: true,
      canTerminate: true,
      canQueue: true,
    });
    value.stream.isLoading = true;
    value.stream.activeRunId = 'replacement';
    const { result } = renderHook(() => useChatRunControl(value));
    await act(() => result.current.handleComposerRunControl('stop'));
    expect(value.stream.stop).not.toHaveBeenCalled();
    expect(result.current.canPauseRun).toBe(false);
    expect(result.current.canSubmit).toBe(false);
  });
});
