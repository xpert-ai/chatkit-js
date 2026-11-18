import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useToolStepDurationLabel } from './useToolStepDuration';

const start = '2026-11-13T08:00:00.000Z';
const end = '2026-11-13T08:00:01.000Z';

describe('tool duration evidence', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] });
    vi.setSystemTime(new Date(end));
  });
  afterEach(() => vi.useRealTimers());

  it.each(['success', 'fail', 'running'] as const)(
    'keeps missing end time unknown after remount for %s',
    (status) => {
      const data = { category: 'Tool', status, created_date: start };
      const mount = () =>
        renderHook(() =>
          useToolStepDurationLabel(data, {
            status: status === 'running' ? 'fail' : status,
          }),
        );
      const first = mount();
      expect(first.result.current).toBeNull();
      first.unmount();
      vi.setSystemTime(new Date(Date.parse(end) + 28 * 3_600_000));
      const reopened = mount();
      expect(reopened.result.current).toBeNull();
    },
  );

  it('uses a persisted receipt time before and after reopening', () => {
    const data = {
      category: 'Tool',
      status: 'fail' as const,
      created_date: start,
      end_date: end,
    };
    const first = renderHook(() => useToolStepDurationLabel(data));
    expect(first.result.current).toBe('1.0s');
    first.unmount();
    vi.setSystemTime(new Date(Date.parse(end) + 28 * 3_600_000));
    expect(
      renderHook(() => useToolStepDurationLabel(data)).result.current,
    ).toBe('1.0s');
  });

  it('ticks only while running and stops without manufacturing an end when interrupted or paused', () => {
    const data = {
      category: 'Tool',
      status: 'running' as const,
      created_date: start,
    };
    const hook = renderHook(
      ({ paused, status }: { paused: boolean; status: 'running' | 'fail' }) =>
        useToolStepDurationLabel(data, { isPaused: paused, status }),
      { initialProps: { paused: false, status: 'running' } },
    );
    act(() => vi.advanceTimersByTime(1000));
    expect(hook.result.current).toBe('2.0s');
    hook.rerender({ paused: true, status: 'running' });
    expect(hook.result.current).toBeNull();
    hook.rerender({ paused: false, status: 'fail' });
    act(() => vi.advanceTimersByTime(28 * 3_600_000));
    expect(hook.result.current).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
  });
});
