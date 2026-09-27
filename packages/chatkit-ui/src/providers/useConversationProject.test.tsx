import { act, renderHook, waitFor } from '@testing-library/react';
import type { ChatConversation, Client } from '@xpert-ai/xpert-sdk';
import { describe, expect, it, vi } from 'vitest';
import { useConversationProject } from './useConversationProject';

function setup(projectId?: string) {
  const get = vi.fn().mockResolvedValue({ id: 'conversation-1' });
  const client = { conversations: { get } } as unknown as Pick<
    Client,
    'conversations'
  >;
  const props = {
    client,
    projectId,
    conversationId: 'conversation-1' as string | null,
    threadId: 'thread-1' as string | null,
    isLoading: true,
    historyReady: true,
    historyMessageLoadVersion: 0,
  };
  return { get, props };
}

describe('persisted conversation Project scope', () => {
  it('refreshes a first-send binding without changing the configured mount scope', async () => {
    const { get, props } = setup();
    const { result } = renderHook(useConversationProject, {
      initialProps: props,
    });
    await waitFor(() => expect(get).toHaveBeenCalledOnce());
    expect(result.current.projectId).toBeUndefined();

    get.mockResolvedValue({ id: 'conversation-1', projectId: 'project-1' });
    act(() => result.current.refresh());
    await waitFor(() => expect(result.current.projectId).toBe('project-1'));
    expect(props.projectId).toBeUndefined();
  });

  it('retries at response end and preserves the known scope on a metadata failure', async () => {
    const { get, props } = setup();
    get.mockRejectedValueOnce(new Error('temporary failure'));
    const { result, rerender } = renderHook(useConversationProject, {
      initialProps: props,
    });
    await waitFor(() => expect(get).toHaveBeenCalledOnce());
    get.mockResolvedValue({ id: 'conversation-1', projectId: 'project-1' });
    rerender({ ...props, isLoading: false });
    await waitFor(() => expect(result.current.projectId).toBe('project-1'));
    get.mockRejectedValueOnce(new Error('temporary failure'));
    await act(async () => result.current.refresh());
    expect(result.current.projectId).toBe('project-1');
  });

  it('discards late responses after switching conversations and clears the scope for a new chat', async () => {
    const { get, props } = setup();
    let resolveFirst!: (
      value: Pick<ChatConversation, 'id' | 'projectId'>,
    ) => void;
    get.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveFirst = resolve;
      }),
    );
    const { result, rerender } = renderHook(useConversationProject, {
      initialProps: props,
    });
    get.mockResolvedValue({ id: 'conversation-2', projectId: 'project-2' });
    rerender({
      ...props,
      conversationId: 'conversation-2',
      threadId: 'thread-2',
    });
    await waitFor(() => expect(result.current.projectId).toBe('project-2'));
    await act(async () =>
      resolveFirst({ id: 'conversation-1', projectId: 'project-1' }),
    );
    expect(result.current.projectId).toBe('project-2');
    rerender({ ...props, conversationId: null, threadId: null });
    expect(result.current.projectId).toBeUndefined();
  });

  it('uses the configured Project for a new draft', async () => {
    const { get, props } = setup('configured-project');
    const { result } = renderHook(useConversationProject, {
      initialProps: { ...props, conversationId: null, threadId: null },
    });
    await act(async () => result.current.refresh());
    expect(result.current.projectId).toBe('configured-project');
    expect(get).not.toHaveBeenCalled();
  });

  it.each(['saved-project', undefined])(
    'uses a saved history scope %s over the mounted Project',
    async (projectId) => {
      const { get, props } = setup('configured-project');
      get.mockResolvedValue({ id: 'conversation-1', projectId });
      const { result } = renderHook(useConversationProject, {
        initialProps: props,
      });
      act(() =>
        result.current.hydrate({ id: 'conversation-1', projectId }, 'thread-1'),
      );
      await waitFor(() => expect(get).toHaveBeenCalledOnce());
      expect(result.current.projectId).toBe(projectId);
      expect(result.current.resolved).toBe(true);
      expect(result.current.fromHistory).toBe(true);
      await act(async () => result.current.refresh());
      expect(result.current.fromHistory).toBe(true);
    },
  );

  it('does not read the previous conversation while the next thread history is loading', async () => {
    const { get, props } = setup('configured-project');
    get.mockResolvedValue({ id: 'conversation-1', projectId: 'project-1' });
    const { result, rerender } = renderHook(useConversationProject, {
      initialProps: props,
    });
    await waitFor(() => expect(result.current.projectId).toBe('project-1'));
    get.mockClear();
    rerender({ ...props, threadId: 'thread-2', historyReady: false });
    expect(result.current.projectId).toBeUndefined();
    expect(get).not.toHaveBeenCalled();
    get.mockResolvedValue({ id: 'conversation-2', projectId: 'project-2' });
    rerender({
      ...props,
      threadId: 'thread-2',
      conversationId: 'conversation-2',
    });
    await waitFor(() => expect(result.current.projectId).toBe('project-2'));
  });
});
