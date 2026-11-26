import { describe, expect, it, vi } from 'vitest';
import type { PendingFollowUp } from '../../../lib/follow-ups';
import type { PersistedChatMessage } from '../types';
import { readFollowUpReceipts, reconcileFollowUpReceipts } from './reconcile';

const pending = (
  id: string,
  mode: PendingFollowUp['mode'] = 'steer',
): PendingFollowUp => ({
  id: `local-${id}`,
  clientMessageId: id,
  mode,
  createdAt: 1,
  request: { id, input: { input: 'Correction' }, followUpMode: mode },
});
const receipt = (
  id: string,
  status: PersistedChatMessage['followUpStatus'],
): PersistedChatMessage => ({
  id: `saved-${id}`,
  role: 'human',
  content: 'Correction',
  followUpMode: 'steer',
  followUpStatus: status,
  thirdPartyMessage: { followUpClientMessageId: id },
});

describe('persisted follow-up receipts', () => {
  it('restores only an explicitly pending server queue entry, never a consumed or canceled one', () => {
    const receipts: PersistedChatMessage[] = [
      { ...receipt('a', 'pending'), followUpMode: 'queue' },
      { ...receipt('b', 'consumed'), followUpMode: 'queue' },
      { ...receipt('c', 'canceled'), followUpMode: 'queue' },
    ];
    const result = reconcileFollowUpReceipts(
      [pending('a'), pending('b'), pending('c')],
      receipts,
    );
    expect(result).toEqual({
      queued: ['local-a'],
      consumed: [{ id: 'local-b', visibleAt: undefined }],
      canceled: ['local-c'],
      matched: ['local-a', 'local-b', 'local-c'],
    });
  });

  it('settles local identities by client ID without touching queued or unrelated inputs', () => {
    const result = reconcileFollowUpReceipts(
      [pending('a'), pending('b'), pending('c'), pending('queued', 'queue')],
      [
        receipt('a', 'consumed'),
        receipt('b', 'canceled'),
        receipt('c', 'pending'),
        receipt('queued', 'consumed'),
        receipt('other', 'consumed'),
      ],
    );
    expect(result).toEqual({
      consumed: [{ id: 'local-a', visibleAt: undefined }],
      canceled: ['local-b'],
      queued: [],
      matched: ['local-a', 'local-b', 'local-c'],
    });
  });

  it('finds an older receipt after the first 100 rows within the selected branch', async () => {
    const first = Array.from({ length: 100 }, (_, i) =>
      receipt(`other-${i}`, 'consumed'),
    );
    const searchMessages = vi
      .fn()
      .mockResolvedValueOnce({ items: first, total: 101 })
      .mockResolvedValueOnce({
        items: [receipt('target', 'consumed')],
        total: 101,
      });
    const signal = new AbortController().signal;
    expect(
      await readFollowUpReceipts(
        { searchMessages },
        'conversation',
        'branch',
        [pending('target')],
        signal,
      ),
    ).toEqual({
      consumed: [{ id: 'local-target', visibleAt: undefined }],
      canceled: [],
      queued: [],
    });
    expect(searchMessages).toHaveBeenCalledTimes(2);
    expect(searchMessages).toHaveBeenNthCalledWith(
      2,
      'conversation',
      {
        where: { role: 'human', threadId: 'branch' },
        order: { createdAt: 'DESC', id: 'DESC' },
        limit: 100,
        offset: 100,
      },
      { signal },
    );
  });

  it('stops paging once all tracked IDs are found, including still-pending receipts', async () => {
    const searchMessages = vi
      .fn()
      .mockResolvedValue({ items: [receipt('target', 'pending')], total: 500 });
    expect(
      await readFollowUpReceipts(
        { searchMessages },
        'c',
        't',
        [pending('target')],
        new AbortController().signal,
      ),
    ).toEqual({ consumed: [], canceled: [], queued: [] });
    expect(searchMessages).toHaveBeenCalledOnce();
  });

  it('does not guess an outcome when history contains no receipt', async () => {
    const searchMessages = vi.fn().mockResolvedValue({ items: [], total: 0 });
    expect(
      await readFollowUpReceipts(
        { searchMessages },
        'c',
        't',
        [pending('missing')],
        new AbortController().signal,
      ),
    ).toEqual({ consumed: [], canceled: [], queued: [] });
  });

  it('discards a response received after cancellation and requests no later page', async () => {
    const controller = new AbortController();
    const searchMessages = vi.fn(async () => {
      controller.abort();
      return { items: [receipt('target', 'consumed')], total: 500 };
    });
    expect(
      await readFollowUpReceipts(
        { searchMessages },
        'c',
        't',
        [pending('target')],
        controller.signal,
      ),
    ).toEqual({ consumed: [], canceled: [], queued: [] });
    expect(searchMessages).toHaveBeenCalledOnce();
  });
});
