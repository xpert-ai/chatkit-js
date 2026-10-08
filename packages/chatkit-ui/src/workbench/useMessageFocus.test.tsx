import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useMessageFocus } from './useMessageFocus';
function fixture() {
  const root = document.createElement('div');
  return {
    scope: 'organization',
    conversationId: 'conversation',
    threadId: 'side',
    history: {
      conversationId: 'conversation',
      threadId: 'side',
      loadedCount: 10,
      total: 20,
      hasMore: true,
      isLoadingMore: false,
    },
    historyReady: true,
    loadMore: vi.fn(async () => {}),
    rootRef: { current: root },
    unavailableMessage: 'Unavailable',
  };
}
const target = {
  conversationId: 'conversation',
  threadId: 'side',
  messageId: 'old-human',
};
describe('message focus', () => {
  it('loads older history, scrolls and highlights the exact message', async () => {
    const input = fixture();
    const scroll = vi.fn();
    input.loadMore.mockImplementation(async () => {
      input.history = { ...input.history, loadedCount: 20, hasMore: false };
      const anchor = document.createElement('div');
      anchor.dataset.messageNavigationId = 'old-human';
      anchor.scrollIntoView = scroll;
      input.rootRef.current.append(anchor);
    });
    const { result } = renderHook(() => useMessageFocus({ ...input }));
    let response: unknown;
    await act(async () => {
      void result.current(target).then((value) => {
        response = value;
      });
    });
    await waitFor(() =>
      expect(response).toEqual({ success: true, status: 'opened' }),
    );
    expect(input.loadMore).toHaveBeenCalledTimes(1);
    expect(scroll).toHaveBeenCalledTimes(1);
    expect(
      input.rootRef.current.querySelector('[data-message-focused]'),
    ).not.toBeNull();
  });
  it('waits for the requested branch without loading another branch', async () => {
    const input = fixture();
    input.threadId = 'main';
    const { result, rerender } = renderHook(() =>
      useMessageFocus({ ...input }),
    );
    let response: unknown;
    await act(async () => {
      void result.current(target).then((value) => {
        response = value;
      });
    });
    expect(input.loadMore).not.toHaveBeenCalled();
    input.threadId = 'side';
    input.history.hasMore = false;
    rerender();
    await waitFor(() =>
      expect(response).toEqual({
        success: false,
        code: 'message_unavailable',
        message: 'Unavailable',
      }),
    );
  });
  it('cancels a pending location when the user opens a different branch', async () => {
    const input = fixture();
    input.threadId = 'main';
    const { result, rerender } = renderHook(() =>
      useMessageFocus({ ...input }),
    );
    let response: unknown;
    await act(async () => {
      void result.current(target).then((value) => {
        response = value;
      });
    });
    input.threadId = 'another-side';
    rerender();
    await waitFor(() =>
      expect(response).toEqual({ success: false, code: 'stale_context' }),
    );
    expect(input.loadMore).not.toHaveBeenCalled();
  });
  it('stops when a history page makes no progress', async () => {
    const input = fixture();
    const { result } = renderHook(() => useMessageFocus({ ...input }));
    let response: unknown;
    await act(async () => {
      void result.current(target).then((value) => {
        response = value;
      });
    });
    await waitFor(() =>
      expect(response).toMatchObject({ code: 'message_unavailable' }),
    );
    expect(input.loadMore).toHaveBeenCalledTimes(1);
  });
  it('cancels pending navigation on unmount and ignores an old page error', async () => {
    const input = fixture();
    let reject!: (reason: Error) => void;
    input.loadMore.mockImplementation(
      () =>
        new Promise<void>((_, fail) => {
          reject = fail;
        }),
    );
    const { result, unmount } = renderHook(() => useMessageFocus({ ...input }));
    let response: unknown;
    await act(async () => {
      void result.current(target).then((value) => {
        response = value;
      });
    });
    unmount();
    await act(async () => {
      reject(Error('late failure'));
    });
    expect(response).toEqual({ success: false, code: 'stale_context' });
  });
});
