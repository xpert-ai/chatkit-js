import { describe, expect, it, vi } from 'vitest';
import { createResumedRootExecutionHydrator } from './resumed-root-executions';

const message = {
  executionId: 'root-3',
  content: [{ type: 'text', text: 'Before pause', executionId: 'root-1' }],
};

describe('resumed root execution ancestry', () => {
  it('follows repeated resumes and caches lookups for later history reconciliation', async () => {
    const getRun = vi.fn(async (_thread: string, id: string) => ({
      metadata:
        id === 'root-3'
          ? { resumedFromExecutionId: 'root-2' }
          : id === 'root-2'
            ? { resumedFromExecutionId: 'root-1' }
            : {},
    }));
    const hydrate = createResumedRootExecutionHydrator(getRun);
    expect(await hydrate([message], 'thread')).toEqual([
      { ...message, rootExecutionIds: ['root-3', 'root-2', 'root-1'] },
    ]);
    await hydrate([message], 'thread');
    expect(getRun).toHaveBeenCalledTimes(3);
    await hydrate([message], 'other-thread');
    expect(getRun).toHaveBeenCalledTimes(6);
  });

  it('does not infer root ancestry from matching agent names or a different execution ID', async () => {
    const getRun = vi.fn(async () => ({ metadata: {} }));
    const hydrate = createResumedRootExecutionHydrator(getRun);
    expect(await hydrate([message], 'thread')).toEqual([message]);
  });

  it('keeps history available on lookup failure and retries on the next read', async () => {
    const getRun = vi
      .fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValue({ metadata: {} });
    const hydrate = createResumedRootExecutionHydrator(getRun);
    expect(await hydrate([message], 'thread')).toEqual([message]);
    await hydrate([message], 'thread');
    expect(getRun).toHaveBeenCalledTimes(2);
  });

  it('terminates cyclic ancestry without duplicating executions', async () => {
    const getRun = vi.fn(async (_thread: string, id: string) => ({
      metadata: {
        resumedFromExecutionId: id === 'root-3' ? 'root-1' : 'root-3',
      },
    }));
    expect(
      await createResumedRootExecutionHydrator(getRun)([message], 'thread'),
    ).toEqual([{ ...message, rootExecutionIds: ['root-3', 'root-1'] }]);
    expect(getRun).toHaveBeenCalledTimes(2);
  });

  it('does not fetch execution metadata for ordinary messages', async () => {
    const getRun = vi.fn();
    const original = { ...message, executionId: 'root-1' };
    expect(
      await createResumedRootExecutionHydrator(getRun)([original], 'thread'),
    ).toEqual([original]);
    expect(getRun).not.toHaveBeenCalled();
  });
});
