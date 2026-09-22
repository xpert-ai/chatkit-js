import { describe, expect, it, vi } from 'vitest';
import { Client, type RuntimeResourcesSelection } from '@xpert-ai/xpert-sdk';
import {
  createXpertThreadConversation,
  withPersistedRuntimeResources,
} from './xpert-conversation-bootstrap';

const draft: RuntimeResourcesSelection = {
  revision: 0,
  resources: [
    { bindingId: 'plugin', version: '1' },
    { bindingId: 'middleware', version: '2' },
    { bindingId: 'expert', version: '3' },
  ],
};
function setup() {
  const client = new Client<unknown>({ apiUrl: 'https://example.test/api/ai' });
  vi.spyOn(client.threads, 'create').mockResolvedValue({
    thread_id: 'thread',
    created_at: '',
    updated_at: '',
    metadata: {},
    status: 'idle',
    values: null,
    interrupts: {},
  });
  vi.spyOn(client.conversations, 'create').mockResolvedValue({
    id: 'conversation',
    threadId: 'thread',
  });
  const update = vi.spyOn(client.conversations, 'updateRuntimeResources');
  return { client, update };
}

describe('first-message resource persistence', () => {
  it('does not expose the created conversation until the full selection is committed', async () => {
    const { client, update } = setup();
    let commit!: (value: RuntimeResourcesSelection) => void;
    update.mockReturnValue(
      new Promise((resolve) => {
        commit = resolve;
      }),
    );
    const onThreadCreated = vi.fn();
    const resolved = vi.fn();
    const pending = createXpertThreadConversation(client, {
      assistantId: 'assistant',
      runtimeResources: draft,
      onThreadCreated,
    }).then(resolved);
    await vi.waitFor(() =>
      expect(update).toHaveBeenCalledWith('conversation', draft),
    );
    expect(onThreadCreated).toHaveBeenCalledWith('thread');
    expect(resolved).not.toHaveBeenCalled();
    commit({ ...draft, revision: 1 });
    await pending;
    expect(resolved).toHaveBeenCalledWith(
      expect.objectContaining({
        runtimeResources: { ...draft, revision: 1 },
      }),
    );
  });

  it('propagates persistence failure while reporting the created thread for rollback', async () => {
    const { client, update } = setup();
    update.mockRejectedValue(new Error('Resource revoked'));
    const onThreadCreated = vi.fn();
    await expect(
      createXpertThreadConversation(client, {
        assistantId: 'assistant',
        runtimeResources: draft,
        onThreadCreated,
      }),
    ).rejects.toThrow('Resource revoked');
    expect(onThreadCreated).toHaveBeenCalledWith('thread');
  });

  it('does not add a persistence request for clients without selected resources', async () => {
    const { client, update } = setup();
    await createXpertThreadConversation(client, { assistantId: 'assistant' });
    expect(update).not.toHaveBeenCalled();
  });

  it('uses the committed revision in both input and injected human state without changing other fields', () => {
    const input = {
      id: 'message',
      input: { input: 'hello', runtimeResources: draft },
      state: {
        custom: 'value',
        human: { input: 'hello', planMode: true, runtimeResources: draft },
      },
    };
    const saved = { ...draft, revision: 1 };
    const request = withPersistedRuntimeResources(input, saved);
    expect(request).toEqual({
      ...input,
      input: { ...input.input, runtimeResources: saved },
      state: {
        ...input.state,
        human: { ...input.state.human, runtimeResources: saved },
      },
    });
    expect(input.input.runtimeResources.revision).toBe(0);
  });
});
