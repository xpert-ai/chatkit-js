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
    act(() => view.result.current.remember(first));
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
    act(() => result.current.remember(first));
    const previous = history.state;
    act(() => result.current.remember({ ...first, selectionId: 'two' }));
    act(() =>
      window.dispatchEvent(new PopStateEvent('popstate', { state: previous })),
    );
    expect(restore).toHaveBeenLastCalledWith(first);
    act(() =>
      window.dispatchEvent(
        new PopStateEvent('popstate', {
          state: {
            xpertResourceCardV2: { scope: 'conversation', target: null },
          },
        }),
      ),
    );
    expect(close).toHaveBeenCalledOnce();
  });

  it('ignores history from another project or conversation without closing the current panel', () => {
    const restore = vi.fn(() => true),
      close = vi.fn();
    const options = {
      scope: 'project-one',
      conversationId: 'conversation-one',
      isConversationScoped: () => true,
      enabled: true,
      ready: true,
      restore,
      close,
    };
    const view = renderHook((context) => useResourceCardNavigation(context), {
      initialProps: options,
    });
    act(() => view.result.current.remember(first));
    const original = structuredClone(history.state);
    view.rerender({ ...options, conversationId: 'conversation-two' });
    act(() =>
      window.dispatchEvent(new PopStateEvent('popstate', { state: original })),
    );
    view.rerender({ ...options, scope: 'project-two' });
    act(() =>
      window.dispatchEvent(new PopStateEvent('popstate', { state: original })),
    );
    expect(restore).not.toHaveBeenCalled();
    expect(close).not.toHaveBeenCalled();
    view.unmount();
    renderHook(() => useResourceCardNavigation(options));
    expect(restore).toHaveBeenCalledWith(first);
  });

  it('does not discard the remembered view when a different tab is closed', () => {
    const restore = vi.fn(() => true);
    const options = {
      scope: 'project',
      enabled: true,
      ready: true,
      restore,
      close: vi.fn(),
    };
    const view = renderHook(() => useResourceCardNavigation(options));
    act(() => view.result.current.remember(first));
    act(() => view.result.current.forget('another-view'));
    view.unmount();
    renderHook(() => useResourceCardNavigation(options));
    expect(restore).toHaveBeenCalledWith(first);
  });

  it('ignores legacy unscoped selections and malformed history entries', () => {
    sessionStorage.setItem('xpertResourceCard:project', JSON.stringify(first));
    const restore = vi.fn(() => true),
      close = vi.fn();
    renderHook(() =>
      useResourceCardNavigation({
        scope: 'project',
        enabled: true,
        ready: true,
        restore,
        close,
      }),
    );
    act(() =>
      window.dispatchEvent(
        new PopStateEvent('popstate', {
          state: {
            xpertResourceCardV2: {
              scope: 'project',
              target: { ...first, parameters: undefined },
            },
          },
        }),
      ),
    );
    expect(restore).not.toHaveBeenCalled();
    expect(close).not.toHaveBeenCalled();
  });
});
