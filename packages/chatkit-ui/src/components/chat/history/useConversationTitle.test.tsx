import { renderHook, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import type { PropsWithChildren } from 'react';
import type { StreamContextType } from '../../../providers/stream/types';
import { WorkbenchChatProvider } from '../../../workbench/floating-chat/context';
import { useConversationTitle } from './useConversationTitle';

const wrapper = ({ children }: PropsWithChildren) => (
  <WorkbenchChatProvider scope="test" floating>
    {children}
  </WorkbenchChatProvider>
);
function setup() {
  const get = vi.fn().mockResolvedValue({ title: 'Loaded conversation' });
  const search = vi
    .fn()
    .mockResolvedValue({ items: [{ title: 'Found conversation' }] });
  const stream = {
    client: {
      conversations: { get, search },
    } as unknown as StreamContextType['client'],
    assistantId: 'assistant',
    conversationId: 'first',
    threadId: 'thread',
    isReady: true,
    isLoading: false,
  };
  return { get, search, stream };
}
describe('current conversation title', () => {
  it('loads a title without history, refreshes after generation, and uses a renamed known title', async () => {
    const { stream, get } = setup();
    const result = renderHook(
      ({ known, running }) =>
        useConversationTitle({ ...stream, isLoading: running }, known, 'main'),
      {
        wrapper,
        initialProps: {
          known: undefined as string | undefined,
          running: false,
        },
      },
    );
    await waitFor(() =>
      expect(result.result.current).toBe('Loaded conversation'),
    );
    get.mockResolvedValue({ title: 'Generated title' });
    result.rerender({ known: undefined, running: true });
    result.rerender({ known: undefined, running: false });
    await waitFor(() => expect(result.result.current).toBe('Generated title'));
    result.rerender({ known: 'Renamed title', running: false });
    expect(result.result.current).toBe('Renamed title');
  });
  it('clears the old title immediately and ignores late responses after switching', async () => {
    const { stream, get } = setup();
    let resolveOld!: (value: { title: string }) => void;
    get.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveOld = resolve;
        }),
    );
    const result = renderHook(
      ({ id }) =>
        useConversationTitle(
          { ...stream, conversationId: id },
          undefined,
          'main',
        ),
      { wrapper, initialProps: { id: 'first' } },
    );
    result.rerender({ id: 'second' });
    expect(result.result.current).toBeUndefined();
    await waitFor(() =>
      expect(result.result.current).toBe('Loaded conversation'),
    );
    await act(async () => resolveOld({ title: 'Stale' }));
    expect(result.result.current).toBe('Loaded conversation');
  });
  it('uses thread lookup when necessary and does not query for side chats', async () => {
    const { stream, get, search } = setup();
    const result = renderHook(
      () =>
        useConversationTitle(
          { ...stream, conversationId: null },
          undefined,
          'main',
        ),
      { wrapper },
    );
    await waitFor(() =>
      expect(result.result.current).toBe('Found conversation'),
    );
    expect(get).not.toHaveBeenCalled();
    expect(search).toHaveBeenCalledTimes(1);
    renderHook(() => useConversationTitle(stream, undefined, 'side'), {
      wrapper,
    });
    expect(get).not.toHaveBeenCalled();
  });
});
