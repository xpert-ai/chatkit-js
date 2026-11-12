import { act, renderHook } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { useWorkbenchOpenRequest } from './useWorkbenchOpenRequest';
import { CHATKIT_INTERNAL_PARENT_EVENT } from './host-events';

const emit = (data: object) =>
  act(() => {
    window.dispatchEvent(
      new CustomEvent(CHATKIT_INTERNAL_PARENT_EVENT, {
        detail: {
          event: 'public_event',
          data: ['log', { name: 'lg.chat.event', data }],
        },
      }),
    );
  });
it('opens a fresh scoped event once and ignores replay, history-shaped payloads and other conversations', () => {
  const open = vi.fn(() => true);
  const { unmount } = renderHook(() =>
    useWorkbenchOpenRequest({
      enabled: true,
      ready: true,
      projectId: 'B',
      conversationId: 'c',
      open,
    }),
  );
  const event = {
    type: 'workbench.view.open',
    viewKey: 'editor',
    projectId: 'B',
    conversationId: 'c',
    requestId: 'one',
    issuedAt: Date.now(),
    parameters: { contentId: 'id' },
  };
  emit(event);
  emit(event);
  emit({ ...event, requestId: 'old', issuedAt: Date.now() - 60000 });
  emit({ ...event, requestId: 'foreign', conversationId: 'other' });
  emit({ ...event, requestId: 'text', type: 'resource_card' });
  expect(open).toHaveBeenCalledTimes(1);
  expect(open).toHaveBeenCalledWith(event);
  unmount();
});
