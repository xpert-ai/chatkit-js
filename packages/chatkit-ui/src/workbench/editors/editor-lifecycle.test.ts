import { describe, expect, it, vi } from 'vitest';
import { EditorLifecycle } from './editor-lifecycle';
import { RemoteEditor } from './remote-editor';

describe('Workbench editor lifecycle', () => {
  it('publishes stable, read-only dirty snapshots shared by all editor instances', () => {
    const lifecycle = new EditorLifecycle();
    const changed = vi.fn();
    const unsubscribe = lifecycle.subscribe(changed);
    const clean = lifecycle.getDirtyTabs();
    lifecycle.register('native', {
      tabKey: 'notes',
      dirty: false,
      prepare: async () => true,
    });
    expect(lifecycle.getDirtyTabs()).toBe(clean);
    // A clean registration publishes presentation, without changing the dirty snapshot.
    expect(changed).toHaveBeenCalledTimes(1);
    lifecycle.register('native', {
      tabKey: 'notes',
      dirty: true,
      prepare: async () => false,
    });
    const dirty = lifecycle.getDirtyTabs();
    expect(dirty).toEqual(['notes']);
    expect(Object.isFrozen(dirty)).toBe(true);
    lifecycle.register('remote', {
      tabKey: 'notes',
      dirty: true,
      prepare: async () => false,
    });
    lifecycle.register('native', null);
    expect(lifecycle.getDirtyTabs()).toBe(dirty);
    expect(changed).toHaveBeenCalledTimes(2);
    lifecycle.register('remote', null);
    expect(lifecycle.getDirtyTabs()).toEqual([]);
    expect(changed).toHaveBeenCalledTimes(3);
    unsubscribe();
    lifecycle.register('another', {
      tabKey: 'other',
      dirty: true,
      prepare: async () => false,
    });
    expect(changed).toHaveBeenCalledTimes(3);
  });
  it('updates titles independently of dirty and drops disposed resource metadata', () => {
    const lifecycle = new EditorLifecycle();
    const remote = new RemoteEditor(
      lifecycle,
      'frame',
      'markdown',
      'doc',
      () => {},
    );
    remote.status('doc', true, 'Draft');
    const dirty = lifecycle.getDirtyTabs();
    const before = lifecycle.getTabState('markdown');
    remote.status('doc', true, 'Draft');
    expect(lifecycle.getTabState('markdown')).toBe(before);
    remote.status('doc', true, 'Renamed');
    expect(lifecycle.getDirtyTabs()).toBe(dirty);
    expect(lifecycle.getTabState('markdown')).toEqual({
      resourceId: 'doc',
      title: 'Renamed',
      dirty: true,
    });
    expect(remote.status('another', false, 'Wrong document')).toBe(false);
    expect(lifecycle.getTabState('markdown')?.title).toBe('Renamed');
    remote.dispose();
    expect(lifecycle.getTabState('markdown')).toBeUndefined();
    expect(remote.status('doc', true, 'Late update')).toBe(false);
    expect(lifecycle.dirty).toBe(false);
  });
  it('does not treat a successful save as leave permission if another edit arrives', async () => {
    const lifecycle = new EditorLifecycle();
    lifecycle.register('original', {
      tabKey: 'notes',
      dirty: true,
      prepare: async () => {
        lifecycle.register('original', {
          tabKey: 'notes',
          dirty: false,
          prepare: async () => true,
        });
        lifecycle.register('new-edit', {
          tabKey: 'other',
          dirty: true,
          prepare: async () => false,
        });
        return true;
      },
    });
    expect(await lifecycle.prepare()).toBe(false);
    expect(lifecycle.getDirtyTabs()).toEqual(['other']);
  });
  it('isolates Workbenches and only saves the tab being replaced', async () => {
    const a = new EditorLifecycle(),
      b = new EditorLifecycle();
    const save = vi.fn(async () => false);
    a.register('one', { tabKey: 'one', dirty: true, prepare: save });
    expect(await b.prepare()).toBe(true);
    expect(await a.prepare('two')).toBe(true);
    expect(save).not.toHaveBeenCalled();
    expect(await a.prepare('one')).toBe(false);
    expect(a.dirty).toBe(true);
  });
  it('accepts a remote save only after its matching acknowledgement and clean status', async () => {
    const lifecycle = new EditorLifecycle();
    let request = '';
    const send = vi.fn((payload: object) => {
      if ('requestId' in payload && typeof payload.requestId === 'string')
        request = payload.requestId;
    });
    const remote = new RemoteEditor(
      lifecycle,
      'frame',
      'markdown',
      'doc',
      send,
    );
    remote.status('doc', true);
    const pending = lifecycle.prepare('markdown');
    remote.acknowledge('unrelated', true);
    expect(lifecycle.dirty).toBe(true);
    expect(remote.status('different-document', false)).toBe(false);
    remote.status('doc', false);
    remote.acknowledge(request, true);
    expect(await pending).toBe(true);
    remote.dispose();
  });
  it('rejects a failed save and detachment while saving', async () => {
    const lifecycle = new EditorLifecycle();
    let request = '';
    const remote = new RemoteEditor(
      lifecycle,
      'frame',
      'markdown',
      'doc',
      (payload) => {
        if ('requestId' in payload && typeof payload.requestId === 'string')
          request = payload.requestId;
      },
    );
    remote.status('doc', true);
    const first = lifecycle.prepare();
    remote.acknowledge(request, false);
    expect(await first).toBe(false);
    expect(lifecycle.dirty).toBe(true);
    const second = lifecycle.prepare();
    remote.dispose();
    expect(await second).toBe(false);
  });
  it('times out without dropping the dirty editor', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    try {
      const lifecycle = new EditorLifecycle();
      const remote = new RemoteEditor(
        lifecycle,
        'frame',
        'markdown',
        'doc',
        () => {},
      );
      remote.status('doc', true);
      const pending = lifecycle.prepare();
      await vi.advanceTimersByTimeAsync(10_000);
      expect(await pending).toBe(false);
      expect(lifecycle.dirty).toBe(true);
      remote.dispose();
    } finally {
      vi.useRealTimers();
    }
  });
});
