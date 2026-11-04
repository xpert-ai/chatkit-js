import type { Client } from '@xpert-ai/xpert-sdk';
import { describe, expect, it, vi } from 'vitest';
import { ReadRecovery } from '../connection/read-recovery';
import { insertInputMessages, reconcileInputMessages } from './input-messages';
import type { StateType } from '../types';

const reply = {
  id: 'reply',
  type: 'ai' as const,
  parentId: 'input',
  content: 'streaming',
};
const input = {
  id: 'input',
  role: 'human',
  parentId: 'old-reply',
  executionId: null,
  content: '你好',
  references: [
    {
      type: 'quote',
      label: 'History',
      source: 'feishu',
      text: 'earlier context',
    },
  ],
  referenceComposition: 'compose',
  fileAssets: [{ id: 'file', originalName: 'notes.txt' }],
};
function fixture() {
  let state: StateType = {
    messages: [{ id: 'old-reply', type: 'ai', content: 'previous' }, reply],
  };
  const searchMessages = vi
    .fn()
    .mockResolvedValue({ items: [input], total: 1 });
  const options = {
    client: {
      conversations: { searchMessages },
    } as unknown as Client<StateType>,
    recovery: new ReadRecovery(),
    conversationId: 'conversation',
    threadId: 'thread',
    signal: new AbortController().signal,
    isCurrent: () => true,
    checked: new Set<string>(),
    getMessages: () => state.messages,
    setValues: (change: StateType | ((previous: StateType) => StateType)) => {
      state = typeof change === 'function' ? change(state) : change;
    },
  };
  return { options, searchMessages, getState: () => state };
}

describe('external input reconciliation', () => {
  it('loads a null-execution input by its explicit identity with quotes and files, before the streamed reply', async () => {
    const f = fixture();
    await reconcileInputMessages(f.options);
    expect(f.searchMessages).toHaveBeenCalledWith(
      'conversation',
      {
        where: { threadId: 'thread', id: 'input', role: 'human' },
        limit: 1,
        offset: 0,
      },
      { signal: expect.any(AbortSignal) },
    );
    expect(f.getState().messages.map((message) => message.id)).toEqual([
      'old-reply',
      'input',
      'reply',
    ]);
    expect(f.getState().messages[1]).toMatchObject({
      type: 'human',
      content: '你好',
      references: input.references,
      fileAssets: input.fileAssets,
    });
    expect(f.getState().messages[2]).toEqual(reply);
    await reconcileInputMessages(f.options);
    expect(f.searchMessages).toHaveBeenCalledOnce();
  });
  it('keeps local optimistic inputs and deduplicates a late read after their acknowledgment', async () => {
    const f = fixture();
    f.searchMessages.mockImplementation(async () => {
      f.options.setValues({
        messages: [
          {
            id: 'input',
            type: 'human',
            content: 'local',
            fileAssets: [{ id: 'local-file' }],
          },
          reply,
        ],
      });
      return { items: [input], total: 1 };
    });
    await reconcileInputMessages(f.options);
    expect(f.getState().messages).toHaveLength(2);
    expect(f.getState().messages[0]).toMatchObject({
      content: 'local',
      fileAssets: [{ id: 'local-file' }],
    });
  });
  it('does not traverse an unloaded AI parent or alter paginated history', async () => {
    const f = fixture();
    f.searchMessages.mockResolvedValue({ items: [], total: 0 });
    await reconcileInputMessages(f.options);
    await reconcileInputMessages(f.options);
    expect(f.searchMessages).toHaveBeenCalledOnce();
    expect(f.getState().messages.map((message) => message.id)).toEqual([
      'old-reply',
      'reply',
    ]);
  });
  it('discards late results after switching thread or auth scope', async () => {
    const f = fixture();
    f.searchMessages.mockImplementation(async () => {
      f.options.isCurrent = () => false;
      return { items: [input], total: 1 };
    });
    // Keep the identity callback live, as in the hook's current-scope closure.
    const options = { ...f.options, isCurrent: () => f.options.isCurrent() };
    await reconcileInputMessages(options);
    expect(f.getState().messages).toHaveLength(2);
    expect(f.options.checked.size).toBe(0);
  });
  it('ignores inputs whose reply was removed and preserves stream/draft order without timestamps', () => {
    const messages = [
      reply,
      { id: 'draft', type: 'human' as const, content: 'unsent next input' },
    ];
    const result = insertInputMessages(messages, [
      { id: 'unrelated', type: 'human', content: 'other' },
      { id: 'input', type: 'human', content: 'current' },
    ]);
    expect(result.map((message) => message.id)).toEqual([
      'input',
      'reply',
      'draft',
    ]);
  });
});
