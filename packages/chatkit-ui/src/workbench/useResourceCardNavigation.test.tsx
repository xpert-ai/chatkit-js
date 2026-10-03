import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useResourceCardNavigation } from './useResourceCardNavigation';
import type { ResourceCardOpenTarget } from '@xpert-ai/chatkit-types';
const first: ResourceCardOpenTarget = {
  target: 'workbench.view',
  viewKey: 'scheduler__detail',
  selectionId: 'one',
};
beforeEach(() => {
  sessionStorage.clear();
  history.replaceState({}, '');
});
describe('explicit Resource Card navigation', () => {
  it('opens only after a click and restores that selection after remount', () => {
    const restore = vi.fn(() => true);
    const options = {
      scope: 'conversation',
      enabled: true,
      ready: true,
      restore,
      close: vi.fn(),
    };
    const view = renderHook(() => useResourceCardNavigation(options));
    expect(restore).not.toHaveBeenCalled();
    act(() => view.result.current(first));
    view.unmount();
    renderHook(() => useResourceCardNavigation(options));
    expect(restore).toHaveBeenCalledWith(first);
    const another = vi.fn(() => true);
    renderHook(() =>
      useResourceCardNavigation({
        ...options,
        scope: 'other-conversation',
        restore: another,
      }),
    );
    expect(another).not.toHaveBeenCalled();
  });
  it('restores successive selections on back/forward and closes at the pre-click entry', () => {
    const restore = vi.fn(() => true),
      close = vi.fn();
    const { result } = renderHook(() =>
      useResourceCardNavigation({
        scope: 'conversation',
        enabled: true,
        ready: true,
        restore,
        close,
      }),
    );
    act(() => result.current(first));
    const previous = history.state;
    act(() => result.current({ ...first, selectionId: 'two' }));
    act(() =>
      window.dispatchEvent(new PopStateEvent('popstate', { state: previous })),
    );
    expect(restore).toHaveBeenLastCalledWith(first);
    act(() =>
      window.dispatchEvent(
        new PopStateEvent('popstate', {
          state: { xpertResourceCard: { scope: 'conversation', target: null } },
        }),
      ),
    );
    expect(close).toHaveBeenCalledOnce();
  });
});
