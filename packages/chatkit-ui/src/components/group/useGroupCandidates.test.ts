import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Client, type ChatGroupCandidate } from '@xpert-ai/xpert-sdk';
import { useGroupCandidates } from './useGroupCandidates';

const page = (start: number, count: number): ChatGroupCandidate[] =>
  Array.from({ length: count }, (_, i) => ({
    kind: 'assistant',
    subjectId: `expert-${start + i}`,
    name: `Expert ${start + i}`,
  }));
function setup() {
  const client = new Client({ apiUrl: 'https://example.test' });
  const candidates = vi.spyOn(client.groups, 'candidates');
  const onError = vi.fn();
  const props = {
    client,
    groupId: 'group',
    kind: 'assistant' as const,
    search: '',
    membershipKey: 'member',
    enabled: true,
    onError,
  };
  return { candidates, props, onError };
}
afterEach(() => vi.restoreAllMocks());
describe('group candidate page lifecycle', () => {
  it('loads later pages with lookahead without losing entries, duplicates or concurrent requests', async () => {
    const { candidates, props } = setup();
    let resolve!: (rows: ChatGroupCandidate[]) => void;
    candidates.mockResolvedValueOnce(page(0, 51)).mockImplementationOnce(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
    const { result } = renderHook(useGroupCandidates, { initialProps: props });
    await waitFor(() => expect(result.current.candidates).toHaveLength(50));
    expect(result.current.hasMore).toBe(true);
    act(() => {
      result.current.loadMore();
      result.current.loadMore();
    });
    expect(candidates).toHaveBeenCalledTimes(2);
    expect(candidates.mock.calls[1][0]).toMatchObject({
      groupId: 'group',
      limit: 51,
      offset: 50,
    });
    expect(result.current.candidates).toHaveLength(50);
    await act(async () => resolve(page(50, 7)));
    expect(result.current.candidates).toEqual(page(0, 57));
    expect(result.current.hasMore).toBe(false);
  });
  it('preserves loaded choices when a later page fails and retries the same offset', async () => {
    const { candidates, props, onError } = setup();
    candidates
      .mockResolvedValueOnce(page(0, 51))
      .mockRejectedValueOnce(new Error('Offline'))
      .mockResolvedValueOnce(page(50, 1));
    const { result } = renderHook(useGroupCandidates, { initialProps: props });
    await waitFor(() => expect(result.current.candidates).toHaveLength(50));
    await act(async () => result.current.loadMore());
    expect(result.current.failed).toBe(true);
    expect(result.current.candidates).toHaveLength(50);
    expect(onError).toHaveBeenCalledTimes(1);
    await act(async () => result.current.loadMore());
    expect(candidates.mock.calls[2][0].offset).toBe(50);
    expect(result.current.candidates).toEqual(page(0, 51));
    expect(result.current.failed).toBe(false);
  });
  it('aborts stale searches and ignores late results even when a transport ignores cancellation', async () => {
    const { candidates, props } = setup();
    let resolve!: (rows: ChatGroupCandidate[]) => void;
    candidates
      .mockImplementationOnce(
        () =>
          new Promise((done) => {
            resolve = done;
          }),
      )
      .mockResolvedValueOnce(page(90, 1));
    const { result, rerender } = renderHook(useGroupCandidates, {
      initialProps: props,
    });
    await waitFor(() => expect(candidates).toHaveBeenCalledTimes(1));
    const oldSignal = candidates.mock.calls[0][1]?.signal;
    rerender({ ...props, search: '90' });
    expect(oldSignal?.aborted).toBe(true);
    await waitFor(() => expect(result.current.candidates).toEqual(page(90, 1)));
    await act(async () => resolve(page(0, 51)));
    expect(result.current.candidates).toEqual(page(90, 1));
    expect(candidates.mock.calls[1][0]).toMatchObject({
      search: '90',
      offset: 0,
    });
  });
  it('restarts from the first page after membership changes and clears results on close', async () => {
    const { candidates, props } = setup();
    candidates
      .mockResolvedValueOnce(page(0, 51))
      .mockResolvedValueOnce(page(1, 1));
    const { result, rerender } = renderHook(useGroupCandidates, {
      initialProps: props,
    });
    await waitFor(() => expect(result.current.candidates).toHaveLength(50));
    rerender({ ...props, membershipKey: 'member|expert-0' });
    await waitFor(() => expect(result.current.candidates).toEqual(page(1, 1)));
    expect(candidates.mock.calls[1][0].offset).toBe(0);
    rerender({ ...props, enabled: false });
    expect(result.current.candidates).toEqual([]);
    expect(candidates.mock.calls[1][1]?.signal?.aborted).toBe(true);
  });
  it('does not request candidates for viewers or a closed picker', async () => {
    const { candidates, props } = setup();
    const { result } = renderHook(useGroupCandidates, {
      initialProps: { ...props, enabled: false },
    });
    act(() => result.current.loadMore());
    expect(candidates).not.toHaveBeenCalled();
  });
});
