import { act, renderHook } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { useWorkbenchPages } from '../useWorkbenchPages';
import type { PresentationWorkbenchPreview } from '../preview/types';

const preview = (key: string): PresentationWorkbenchPreview => ({
  kind: 'presentation',
  key,
  title: key,
  source: { read: vi.fn(), query: vi.fn() },
});
it('retains one renderer per reference, isolates different references, and disposes them on group scope change', () => {
  const { result, rerender } = renderHook(
    ({ group }) => useWorkbenchPages('project', group),
    { initialProps: { group: 'g1' } },
  );
  const first = preview('r1');
  act(() => result.current.openPreview(first));
  act(() => result.current.openPreview(preview('r2')));
  act(() => result.current.openPreview(preview('r1')));
  expect(result.current.previews).toHaveLength(2);
  expect(result.current.previews[0]).toMatchObject({ source: first.source });
  act(() => result.current.closePreview('r1'));
  expect(result.current.previews.map((item) => item.key)).toEqual(['r2']);
  rerender({ group: 'g2' });
  expect(result.current.previews).toEqual([]);
  expect(result.current.recent).toEqual([]);
});
