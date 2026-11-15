import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ContentClient, XpertWorkspaceFile } from '@xpert-ai/xpert-sdk';
import { useFileEditorNavigation } from './useFileEditorNavigation';

const file = { filePath: 'report.pptx' } as XpertWorkspaceFile;
function options() {
  return {
    api: {
      resolveFile: vi
        .fn()
        .mockResolvedValue({ viewKey: 'editor', selectionId: 'item' }),
    } as unknown as ContentClient,
    assistantId: 'a',
    projectId: 'p',
    ready: true,
    native: vi.fn(),
    navigate: vi.fn().mockResolvedValue({ success: true }),
    failed: vi.fn(),
  };
}
describe('PPTX plugin navigation', () => {
  it('uses the authorized editor and never opens the embedded PPTX editor', async () => {
    const o = options(),
      hook = renderHook(() => useFileEditorNavigation(o));
    hook.result.current(file);
    await waitFor(() =>
      expect(o.navigate).toHaveBeenCalledWith({
        target: 'workbench.view',
        viewKey: 'editor',
        selectionId: 'item',
      }),
    );
    expect(o.native).not.toHaveBeenCalled();
  });
  it('does not navigate a result after a Project switch', async () => {
    const o = options();
    let resolve!: (value: { viewKey: string }) => void;
    vi.mocked(o.api.resolveFile).mockReturnValue(
      new Promise((done) => {
        resolve = done;
      }),
    );
    const hook = renderHook((p) => useFileEditorNavigation(p), {
      initialProps: o,
    });
    hook.result.current(file);
    hook.rerender({ ...o, projectId: 'other' });
    resolve({ viewKey: 'editor' });
    await Promise.resolve();
    expect(o.navigate).not.toHaveBeenCalled();
  });
  it('preserves ordinary native files and exposes missing plugin errors', async () => {
    const o = options(),
      hook = renderHook(() => useFileEditorNavigation(o));
    hook.result.current({ ...file, filePath: 'notes.txt' });
    expect(o.native).toHaveBeenCalled();
    vi.mocked(o.api.resolveFile).mockRejectedValue(
      new Error('plugin unavailable'),
    );
    hook.result.current(file);
    await waitFor(() => expect(o.failed).toHaveBeenCalled());
    expect(o.navigate).not.toHaveBeenCalled();
  });
  it('rejects an old response after switching away and back to the same Project', async () => {
    const o = options();
    let resolve!: (value: { viewKey: string }) => void;
    vi.mocked(o.api.resolveFile).mockReturnValue(
      new Promise((done) => {
        resolve = done;
      }),
    );
    const hook = renderHook((p) => useFileEditorNavigation(p), {
      initialProps: o,
    });
    hook.result.current(file);
    hook.rerender({ ...o, projectId: 'other' });
    hook.rerender(o);
    resolve({ viewKey: 'old-editor' });
    await Promise.resolve();
    expect(o.navigate).not.toHaveBeenCalled();
    expect(o.failed).not.toHaveBeenCalled();
  });
  it('ignores responses after unmount and rejects unavailable view navigation', async () => {
    const o = options();
    let resolve!: (value: { viewKey: string }) => void;
    vi.mocked(o.api.resolveFile).mockReturnValueOnce(
      new Promise((done) => {
        resolve = done;
      }),
    );
    const hook = renderHook(() => useFileEditorNavigation(o));
    hook.result.current(file);
    hook.unmount();
    resolve({ viewKey: 'editor' });
    await Promise.resolve();
    expect(o.navigate).not.toHaveBeenCalled();
    o.navigate.mockResolvedValue({ success: false });
    const next = renderHook(() => useFileEditorNavigation(o));
    next.result.current(file);
    await waitFor(() => expect(o.failed).toHaveBeenCalled());
    expect(o.native).not.toHaveBeenCalled();
  });
  it('does not request file resolution until Project scope is ready', () => {
    const o = { ...options(), ready: false },
      hook = renderHook(() => useFileEditorNavigation(o));
    hook.result.current(file);
    expect(o.api.resolveFile).not.toHaveBeenCalled();
    expect(o.failed).toHaveBeenCalled();
  });
});
