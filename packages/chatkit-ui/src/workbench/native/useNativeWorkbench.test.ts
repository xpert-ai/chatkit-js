import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useNativeWorkbench } from './useNativeWorkbench';
import { EditorLifecycle } from '../editors/editor-lifecycle';

describe('native Workbench sessions', () => {
  it('reuses the browser tab for previews while recording recent files separately from editor tabs', () => {
    const editors = new EditorLifecycle();
    const { result } = renderHook(() =>
      useNativeWorkbench('preview-scope', editors),
    );
    act(() => {
      result.current.openTool('files');
      result.current.previewFile({ filePath: 'docs/a.md' });
      result.current.previewFile({ filePath: 'docs/b.txt' });
      result.current.previewFile({ filePath: 'docs/a.md' });
    });
    expect(result.current.tabs).toHaveLength(1);
    expect(result.current.tabs[0]).toMatchObject({
      kind: 'files',
      preview: { filePath: 'docs/a.md' },
    });
    expect(result.current.recent.map((item) => item.file.filePath)).toEqual([
      'docs/a.md',
      'docs/b.txt',
    ]);
    act(() => {
      result.current.openFile({ filePath: 'budget.xlsx' });
      result.current.previewFile(null);
    });
    expect(result.current.tabs).toHaveLength(2);
    expect(result.current.tabs[0]).toMatchObject({
      kind: 'files',
      preview: undefined,
    });
    expect(result.current.tabs[1]).toMatchObject({
      kind: 'file',
      file: { filePath: 'budget.xlsx' },
    });
    expect(result.current.recent).toHaveLength(3);
  });
  it('reuses tools and file tabs, remembers files, and isolates runtime scopes', () => {
    const editors = new EditorLifecycle();
    const { result, rerender } = renderHook(
      ({ scope }) => useNativeWorkbench(scope, editors),
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
    const editors = new EditorLifecycle();
    const { result } = renderHook(() => useNativeWorkbench('scope', editors));
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
    const editors = new EditorLifecycle();
    const { result, rerender } = renderHook(
      ({ scope }) => useNativeWorkbench(scope, editors),
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
  it('derives tab indicators and leave permission from the same native and remote registry', async () => {
    const editors = new EditorLifecycle();
    const { result, unmount } = renderHook(() =>
      useNativeWorkbench('scope', editors),
    );
    let key = '';
    const save = vi.fn(async () => {
      result.current.register(key, { dirty: false, save });
    });
    act(() => {
      key = result.current.openFile({ filePath: 'notes.md' });
      result.current.register(key, { dirty: true, save });
      editors.register('remote', {
        tabKey: 'markdown',
        dirty: true,
        prepare: async () => false,
      });
    });
    expect(result.current.dirty).toEqual([key]);
    expect(editors.getDirtyTabs()).toContain('markdown');
    await act(async () => {
      expect(await editors.prepare(key)).toBe(true);
    });
    expect(save).toHaveBeenCalledOnce();
    expect(result.current.dirty).toEqual([]);
    expect(editors.dirty).toBe(true);
    expect(await editors.prepare()).toBe(false);
    unmount();
    expect(editors.getDirtyTabs()).toEqual(['markdown']);
  });

  it('removes old native dirty state without late cleanup or status erasing the replacement', () => {
    const editors = new EditorLifecycle();
    const { result, rerender, unmount } = renderHook(
      ({ scope }) => useNativeWorkbench(scope, editors),
      { initialProps: { scope: 'old' } },
    );
    const save = async () => {};
    let key = '';
    act(() => {
      key = result.current.openFile({ filePath: 'notes.md' });
      result.current.register(key, { dirty: true, save });
    });
    const oldRegister = result.current.register;
    rerender({ scope: 'new' });
    expect(editors.dirty).toBe(false);
    act(() => {
      result.current.openFile({ filePath: 'notes.md' });
      result.current.register(key, { dirty: true, save });
      oldRegister(key, null);
      oldRegister('stale-file', { dirty: true, save });
    });
    expect(editors.getDirtyTabs()).toEqual([key]);
    expect(result.current.dirty).toEqual([key]);
    unmount();
    expect(editors.dirty).toBe(false);
  });
});
