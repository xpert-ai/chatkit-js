import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useNativeWorkbench } from './useNativeWorkbench';

describe('native Workbench sessions', () => {
  it('reuses tools and file tabs, remembers files, and isolates runtime scopes', () => {
    const { result, rerender } = renderHook(
      ({ scope }) => useNativeWorkbench(scope),
      { initialProps: { scope: 'assistant/project-a' } },
    );
    act(() => {
      result.current.openTool('files');
      result.current.openTool('files');
      result.current.openFile({ filePath: 'readme.md' });
      result.current.openFile({ filePath: 'readme.md' });
    });
    expect(result.current.tabs).toHaveLength(2);
    expect(result.current.recent).toHaveLength(1);
    const key = result.current.tabs[1].key;
    act(() => {
      result.current.requestClose(key);
    });
    expect(result.current.tabs).toHaveLength(1);
    expect(result.current.recent[0].file.filePath).toBe('readme.md');
    rerender({ scope: 'assistant/project-b' });
    expect(result.current.tabs).toHaveLength(0);
    expect(result.current.recent).toHaveLength(0);
  });
  it('retains dirty tabs when save fails and supports explicit discard', async () => {
    const { result } = renderHook(() => useNativeWorkbench('scope'));
    let key = '';
    act(() => {
      key = result.current.openFile({ filePath: 'notes.md' });
    });
    const save = vi.fn().mockRejectedValue(new Error('Permission denied'));
    act(() => {
      result.current.register(key, { dirty: true, save });
      expect(result.current.requestClose(key)).toBe(false);
    });
    expect(result.current.pending).toBe(key);
    await act(async () => {
      await expect(result.current.saveAndClose(key)).rejects.toThrow(
        'Permission denied',
      );
    });
    expect(result.current.tabs).toHaveLength(1);
    act(() => {
      result.current.discard(key);
    });
    expect(result.current.tabs).toHaveLength(0);
    expect(result.current.dirty).toHaveLength(0);
  });
  it('does not close a new scope when a previous save completes late', async () => {
    const { result, rerender } = renderHook(
      ({ scope }) => useNativeWorkbench(scope),
      { initialProps: { scope: 'old' } },
    );
    let resolve!: () => void;
    const promise = new Promise<void>((r) => {
      resolve = r;
    });
    let key = '';
    act(() => {
      key = result.current.openFile({ filePath: 'a.md' });
      result.current.register(key, { dirty: true, save: () => promise });
    });
    const saving = result.current.saveAndClose(key);
    rerender({ scope: 'new' });
    act(() => {
      result.current.openFile({ filePath: 'a.md' });
    });
    await act(async () => {
      resolve();
      expect(await saving).toBe(false);
    });
    expect(result.current.tabs).toHaveLength(1);
  });
});
