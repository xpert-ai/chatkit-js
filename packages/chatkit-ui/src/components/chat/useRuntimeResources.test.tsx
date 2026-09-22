import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Client, type RuntimeResourcesSelection } from '@xpert-ai/xpert-sdk';
import { useRuntimeResources } from './useRuntimeResources';

const ref = { bindingId: 'binding', version: 'version' };
const saved: RuntimeResourcesSelection = { revision: 2, resources: [ref] };
function setup() {
  const client = new Client<unknown>({ apiUrl: 'https://example.test/api/ai' });
  const read = vi
    .spyOn(client.conversations, 'getRuntimeResources')
    .mockResolvedValue(saved);
  const update = vi
    .spyOn(client.conversations, 'updateRuntimeResources')
    .mockImplementation(async (_id, value) => ({
      ...value,
      revision: value.revision + 1,
    }));
  const validate = vi
    .spyOn(client.assistants, 'validateResources')
    .mockImplementation(async (_id, value) => value);
  return { client, read, update, validate };
}
describe('conversation resource selection', () => {
  const resources = [
    ref,
    { bindingId: 'middleware', version: '2' },
    { bindingId: 'expert', version: '3' },
  ];
  function draftHarness() {
    const mocks = setup();
    const initialProps: {
      conversationId: string | null;
      threadId: string | null;
    } = {
      conversationId: null,
      threadId: null,
    };
    const hook = renderHook(
      ({
        conversationId,
        threadId,
      }: {
        conversationId: string | null;
        threadId: string | null;
      }) =>
        useRuntimeResources({
          client: mocks.client,
          enabled: true,
          assistantId: 'assistant',
          conversationId,
          threadId,
        }),
      { initialProps },
    );
    return { ...mocks, ...hook };
  }
  async function selectDraft(
    result: ReturnType<typeof draftHarness>['result'],
  ) {
    await waitFor(() => expect(result.current.busy).toBe(false));
    for (const resource of resources)
      await act(() => result.current.toggle(resource));
  }

  it('keeps all draft resources visible through first-message handoff and adopts the committed revision', async () => {
    const { result, read, rerender } = draftHarness();
    await selectDraft(result);
    let finish!: (value: RuntimeResourcesSelection) => void;
    read.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    const submission = result.current.beginSubmission();
    submission?.onThreadResolved('new-thread', 'new-conversation');
    rerender({ conversationId: 'new-conversation', threadId: 'new-thread' });
    expect(result.current.selection).toEqual({ revision: 0, resources });
    expect(result.current.ready).toBe(false);
    await act(async () => finish({ revision: 1, resources }));
    expect(result.current.selection).toEqual({ revision: 1, resources });
    expect(result.current.ready).toBe(true);
    submission?.onSettled(true);
    rerender({ conversationId: null, threadId: null });
    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.selection.resources).toEqual([]);
  });

  it('restores the original draft revision when first-message execution rolls back', async () => {
    const { result, read, rerender } = draftHarness();
    await selectDraft(result);
    const submission = result.current.beginSubmission();
    submission?.onThreadResolved('new-thread', 'new-conversation');
    read.mockResolvedValue({ revision: 1, resources });
    rerender({ conversationId: 'new-conversation', threadId: 'new-thread' });
    await waitFor(() => expect(result.current.selection.revision).toBe(1));
    // Stream rolls back its IDs before reporting the rejection to the composer.
    rerender({ conversationId: null, threadId: null });
    submission?.onSettled(false);
    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.selection).toEqual({ revision: 0, resources });
  });

  it('retains the draft when creation or initial persistence fails before thread resolution', async () => {
    const { result } = draftHarness();
    await selectDraft(result);
    result.current.beginSubmission()?.onSettled(false);
    expect(result.current.selection).toEqual({ revision: 0, resources });
    expect(result.current.ready).toBe(true);
  });

  it('does not transfer a draft into existing history or resurrect it after a late submission callback', async () => {
    const { result, read, rerender } = draftHarness();
    await selectDraft(result);
    const submission = result.current.beginSubmission();
    read.mockResolvedValue({ revision: 8, resources: [] });
    rerender({ conversationId: 'history', threadId: 'history-thread' });
    expect(result.current.selection.resources).toEqual([]);
    await waitFor(() => expect(result.current.selection.revision).toBe(8));
    submission?.onThreadResolved('old-submit', 'old-submit-conversation');
    submission?.onSettled(false);
    expect(result.current.selection).toEqual({ revision: 8, resources: [] });
    rerender({ conversationId: null, threadId: null });
    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.selection.resources).toEqual([]);
  });

  it('does not call resource APIs when the feature is disabled', async () => {
    const { client, read } = setup();
    const { result } = renderHook(() =>
      useRuntimeResources({
        client,
        enabled: false,
        assistantId: 'assistant',
        conversationId: 'conversation',
      }),
    );
    expect(result.current.ready).toBe(true);
    expect(read).not.toHaveBeenCalled();
  });
  it('validates first-message selections without creating a conversation', async () => {
    const { client, validate, update } = setup();
    const { result } = renderHook(() =>
      useRuntimeResources({
        client,
        enabled: true,
        assistantId: 'assistant',
        projectId: 'project',
      }),
    );
    await waitFor(() => {
      expect(result.current.ready).toBe(true);
      expect(result.current.busy).toBe(false);
    });
    await act(() => result.current.toggle(ref));
    expect(validate).toHaveBeenCalledWith(
      'assistant',
      { revision: 0, resources: [ref] },
      'project',
    );
    expect(result.current.selection.resources).toEqual([ref]);
    expect(update).not.toHaveBeenCalled();
  });
  it('restores a saved selection and sends the complete removal with its revision', async () => {
    const { client, update } = setup();
    const { result } = renderHook(() =>
      useRuntimeResources({
        client,
        enabled: true,
        assistantId: 'assistant',
        conversationId: 'conversation',
      }),
    );
    await waitFor(() => expect(result.current.selection).toEqual(saved));
    await act(() => result.current.toggle(ref));
    expect(update).toHaveBeenCalledWith('conversation', {
      revision: 2,
      resources: [],
    });
    expect(result.current.selection).toEqual({ revision: 3, resources: [] });
  });
  it('blocks edits after a history read fails, then retries and persists with the recovered revision', async () => {
    const { client, read, update, validate } = setup();
    read.mockRejectedValueOnce(new Error('temporary 503'));
    const { result } = renderHook(() =>
      useRuntimeResources({
        client,
        enabled: true,
        assistantId: 'assistant',
        conversationId: 'conversation',
      }),
    );
    await waitFor(() => expect(result.current.error).toBe('temporary 503'));
    expect(result.current.ready).toBe(false);
    expect(result.current.canEdit).toBe(false);
    await act(() => result.current.toggle(ref));
    expect(update).not.toHaveBeenCalled();
    expect(validate).not.toHaveBeenCalled();
    expect(result.current.ready).toBe(false);
    act(() => result.current.refresh());
    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.selection).toEqual(saved);
    expect(result.current.error).toBeNull();
    await act(() => result.current.toggle(ref));
    expect(update).toHaveBeenCalledWith('conversation', {
      revision: 2,
      resources: [],
    });
    expect(validate).not.toHaveBeenCalled();
  });
  it('does not treat an unresolved history thread as a new draft', async () => {
    const { client, read, validate } = setup();
    vi.spyOn(client.conversations, 'search').mockResolvedValue({
      items: [],
      total: 0,
    });
    const { result } = renderHook(() =>
      useRuntimeResources({
        client,
        enabled: true,
        assistantId: 'assistant',
        threadId: 'missing-thread',
      }),
    );
    await waitFor(() => expect(result.current.error).not.toBeNull());
    expect(result.current.canEdit).toBe(false);
    expect(result.current.ready).toBe(false);
    await act(() => result.current.toggle(ref));
    expect(read).not.toHaveBeenCalled();
    expect(validate).not.toHaveBeenCalled();
  });
  it('requires a successful reload when a rejected update cannot recover the server revision', async () => {
    const { client, read, update } = setup();
    const { result } = renderHook(() =>
      useRuntimeResources({
        client,
        enabled: true,
        assistantId: 'assistant',
        conversationId: 'conversation',
      }),
    );
    await waitFor(() => expect(result.current.ready).toBe(true));
    update.mockRejectedValue(new Error('conflict'));
    read.mockRejectedValueOnce(new Error('temporary 503'));
    await act(() => result.current.toggle(ref));
    expect(result.current.selection).toEqual(saved);
    expect(result.current.canEdit).toBe(false);
    await act(() => result.current.toggle(ref));
    expect(update).toHaveBeenCalledTimes(1);
    act(() => result.current.refresh());
    await waitFor(() => expect(result.current.canEdit).toBe(true));
  });
  it('retains the server selection on a rejected update and exposes the conflict', async () => {
    const { client, update } = setup();
    update.mockRejectedValue(new Error('revision conflict'));
    const { result } = renderHook(() =>
      useRuntimeResources({
        client,
        enabled: true,
        assistantId: 'assistant',
        conversationId: 'conversation',
      }),
    );
    await waitFor(() => {
      expect(result.current.ready).toBe(true);
      expect(result.current.busy).toBe(false);
    });
    await act(() => result.current.toggle(ref));
    expect(result.current.selection).toEqual(saved);
    expect(result.current.error).toBe('revision conflict');
  });
  it('does not replace another conversation with a late update response', async () => {
    const { client, read, update } = setup();
    let finish: (value: RuntimeResourcesSelection) => void = () => undefined;
    update.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    const { result, rerender } = renderHook(
      ({ conversationId }) =>
        useRuntimeResources({
          client,
          enabled: true,
          assistantId: 'assistant',
          conversationId,
        }),
      { initialProps: { conversationId: 'first' } },
    );
    await waitFor(() => {
      expect(result.current.ready).toBe(true);
      expect(result.current.busy).toBe(false);
    });
    let pending: Promise<void>;
    act(() => {
      pending = result.current.toggle(ref);
    });
    read.mockResolvedValue({ revision: 9, resources: [] });
    rerender({ conversationId: 'second' });
    await waitFor(() => expect(result.current.selection.revision).toBe(9));
    await act(async () => {
      finish({ revision: 3, resources: [] });
      await pending;
    });
    expect(result.current.selection.revision).toBe(9);
  });
  it('revalidates a local draft on project change and blocks sends after a failed read', async () => {
    const { client, validate } = setup();
    const { result, rerender } = renderHook(
      ({ projectId }) =>
        useRuntimeResources({
          client,
          enabled: true,
          assistantId: 'assistant',
          projectId,
        }),
      { initialProps: { projectId: 'one' } },
    );
    await waitFor(() => {
      expect(result.current.ready).toBe(true);
      expect(result.current.busy).toBe(false);
    });
    await act(() => result.current.toggle(ref));
    validate.mockRejectedValue(new Error('not available in project'));
    rerender({ projectId: 'two' });
    await waitFor(() =>
      expect(result.current.error).toBe('not available in project'),
    );
    expect(result.current.ready).toBe(false);
    expect(result.current.selection.resources).toEqual([ref]);
  });
});
