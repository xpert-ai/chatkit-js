import { act, renderHook, waitFor } from '@testing-library/react';
import type { XpertExtensionViewManifest } from '@xpert-ai/xpert-sdk';
import { describe, expect, it, vi } from 'vitest';
import { useWorkbenchViews } from './useWorkbenchViews';

const manifest: XpertExtensionViewManifest = {
  key: 'documents',
  title: { en_US: 'Documents' },
  hostType: 'agent',
  slot: 'agent.workbench.fixed',
  source: { provider: 'documents' },
  view: {
    type: 'remote_component',
    runtime: 'react',
    protocolVersion: 1,
    component: { isolation: 'iframe', entry: 'documents' },
    dataSource: { mode: 'platform' },
  },
  dataSource: { mode: 'platform' },
};
function setup() {
  const listSlotViews = vi.fn().mockResolvedValue([manifest]);
  return {
    listSlotViews,
    props: {
      client: { listSlotViews },
      hostId: 'assistant-1',
      scopeKey: 'scope-1',
      runtimeScope: {
        projectId: null as string | null,
        conversationId: null as string | null,
      },
      enabled: true,
      ready: true,
      locale: 'en-US',
      revision: 0,
    },
  };
}
function deferred() {
  let resolve!: (views: XpertExtensionViewManifest[]) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<XpertExtensionViewManifest[]>((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { promise, resolve, reject };
}

describe('Workbench view loading', () => {
  it('loads once after the restored conversation and Project scope are ready', async () => {
    const { props, listSlotViews } = setup();
    const { result, rerender } = renderHook(useWorkbenchViews, {
      initialProps: { ...props, ready: false },
    });
    expect(listSlotViews).not.toHaveBeenCalled();
    expect(result.current.showLoading).toBe(true);
    rerender({
      ...props,
      ready: false,
      scopeKey: 'conversation-only',
      runtimeScope: { conversationId: 'conversation-1', projectId: null },
    });
    expect(listSlotViews).not.toHaveBeenCalled();
    const finalScope = {
      conversationId: 'conversation-1',
      projectId: 'project-1',
    };
    rerender({
      ...props,
      ready: true,
      scopeKey: 'final-scope',
      runtimeScope: finalScope,
    });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.showLoading).toBe(false);
    expect(listSlotViews).toHaveBeenCalledOnce();
    expect(listSlotViews).toHaveBeenCalledWith(
      'agent',
      'assistant-1',
      'agent.workbench.fixed',
      expect.objectContaining({ runtimeScope: finalScope }),
    );
  });

  it('preserves loaded views during same-scope refresh, failure and retry', async () => {
    const { props, listSlotViews } = setup();
    const { result, rerender } = renderHook(useWorkbenchViews, {
      initialProps: props,
    });
    await waitFor(() => expect(result.current.views).toEqual([manifest]));
    const original = result.current.views;
    const refresh = deferred();
    listSlotViews.mockReturnValueOnce(refresh.promise);
    rerender({ ...props, revision: 1 });
    expect(result.current.loading).toBe(true);
    expect(result.current.showLoading).toBe(true);
    expect(result.current.views).toBe(original);
    expect(result.current.viewsScope).toBe('scope-1');
    await act(async () => refresh.reject(new Error('Temporary failure')));
    expect(result.current.views).toBe(original);
    expect(result.current.error).toBe('Temporary failure');
    expect(result.current.showLoading).toBe(false);
    listSlotViews.mockResolvedValueOnce([]);
    rerender({ ...props, revision: 2 });
    await waitFor(() => expect(result.current.views).toEqual([]));
    expect(result.current.error).toBeNull();
  });

  it('discards old scope views and late responses when switching or signing out', async () => {
    const { props, listSlotViews } = setup();
    const { result, rerender } = renderHook(useWorkbenchViews, {
      initialProps: props,
    });
    await waitFor(() => expect(result.current.views).toEqual([manifest]));
    const oldRequest = deferred();
    listSlotViews.mockReturnValueOnce(oldRequest.promise);
    rerender({ ...props, revision: 1 });
    const oldSignal = listSlotViews.mock.calls.at(-1)?.[3].signal;
    rerender({ ...props, scopeKey: 'new-scope', ready: false });
    expect(result.current.views).toEqual([]);
    expect(oldSignal.aborted).toBe(true);
    await act(async () => oldRequest.resolve([manifest]));
    expect(result.current.views).toEqual([]);
    rerender({ ...props, scopeKey: 'new-scope' });
    await waitFor(() => expect(result.current.views).toEqual([manifest]));
    rerender({ ...props, scopeKey: 'new-scope', enabled: false });
    expect(result.current.views).toEqual([]);
  });

  it('removes retained views when access is denied during refresh', async () => {
    const { props, listSlotViews } = setup();
    const { result, rerender } = renderHook(useWorkbenchViews, {
      initialProps: props,
    });
    await waitFor(() => expect(result.current.views).toEqual([manifest]));
    listSlotViews.mockRejectedValueOnce(
      Object.assign(new Error('Forbidden'), { status: 403 }),
    );
    rerender({ ...props, revision: 1 });
    await waitFor(() => expect(result.current.error).toBe('Forbidden'));
    expect(result.current.views).toEqual([]);
  });
  it('retains Assistant views while the next project scope is unresolved or loading, then applies new authorization', async () => {
    const { props, listSlotViews } = setup();
    const initial = { ...props, retentionKey: 'assistant-1' };
    const { result, rerender } = renderHook(useWorkbenchViews, {
      initialProps: initial,
    });
    await waitFor(() => expect(result.current.views).toEqual([manifest]));
    const next = {
      ...initial,
      scopeKey: 'next-project',
      runtimeScope: {
        projectId: 'project-2',
        conversationId: 'conversation-2',
      },
    };
    rerender({ ...next, ready: false });
    expect(result.current.views).toEqual([manifest]);
    expect(result.current.viewsScope).toBe('scope-1');
    expect(result.current.loading).toBe(true);
    expect(result.current.showLoading).toBe(false);
    const pending = deferred();
    listSlotViews.mockReturnValueOnce(pending.promise);
    rerender(next);
    expect(result.current.views).toEqual([manifest]);
    expect(result.current.showLoading).toBe(false);
    await act(async () => pending.resolve([]));
    await waitFor(() => expect(result.current.viewsScope).toBe('next-project'));
    expect(result.current.views).toEqual([]);
  });

  it.each([
    { name: 'empty', views: [] },
    { name: 'recommended', views: [manifest] },
  ])(
    'silently revalidates a $name result and shows explicit refresh feedback while revalidating',
    async ({ views }) => {
      const { props, listSlotViews } = setup();
      listSlotViews.mockResolvedValue(views);
      const initial = { ...props, retentionKey: 'assistant-1' };
      const { result, rerender } = renderHook(useWorkbenchViews, {
        initialProps: initial,
      });
      await waitFor(() => expect(result.current.loading).toBe(false));
      const background = deferred();
      listSlotViews.mockReturnValueOnce(background.promise);
      const next = {
        ...initial,
        scopeKey: 'conversation-created',
        runtimeScope: {
          projectId: null,
          conversationId: 'conversation-created',
        },
      };
      rerender(next);
      expect(result.current.loading).toBe(true);
      expect(result.current.showLoading).toBe(false);
      expect(result.current.views).toEqual(views);
      const manual = deferred();
      listSlotViews.mockReturnValueOnce(manual.promise);
      rerender({ ...next, revision: 1 });
      expect(result.current.loading).toBe(true);
      expect(result.current.showLoading).toBe(true);
      await act(async () => manual.resolve(views));
      expect(result.current.loading).toBe(false);
      expect(result.current.showLoading).toBe(false);
      await act(async () => background.resolve([]));
      expect(result.current.views).toEqual(views);
    },
  );
});
