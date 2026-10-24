import * as React from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ChatKitWorkbenchOptions } from '@xpert-ai/chatkit-types';
import type {
  XpertExtensionViewManifest,
  XpertViewQuery,
} from '@xpert-ai/xpert-sdk';
import { EditorLifecycle } from './editors/editor-lifecycle';
import { useWorkbenchViewNavigation } from './useHostedWorkbenchNavigation';

const local = vi.hoisted(() =>
  vi.fn(() => ({ remember: vi.fn(), forget: vi.fn() })),
);
const parent = vi.hoisted(() => ({
  isParentAvailable: false,
  sendCommand: vi.fn(),
}));
vi.mock('./resource-cards/useResourceCardNavigation', () => ({
  useResourceCardNavigation: local,
}));
vi.mock('../hooks/useParentMessenger', () => ({
  useParentMessenger: () => parent,
}));
const views = [{ key: 'markdown' }] as XpertExtensionViewManifest[];

function fixture(
  view: { viewKey: string; selectionId: string } | null = {
    viewKey: 'markdown',
    selectionId: 'next',
  },
) {
  const editors = new EditorLifecycle();
  let finish!: (ready: boolean) => void;
  const save = new Promise<boolean>((resolve) => {
    finish = resolve;
  });
  const handle = {
    tabKey: 'markdown',
    resourceId: 'old',
    dirty: true,
    prepare: () => save,
  };
  editors.register('editor', handle);
  const onError = vi.fn(),
    onNavigationChange = vi.fn();
  const options: ChatKitWorkbenchOptions = {
    navigation: { projectId: 'project', view },
    onNavigationChange,
  };
  const hook = renderHook(
    ({ scopeKey }) => {
      const [queries, setQueries] = React.useState<
        Record<string, XpertViewQuery>
      >({ markdown: { selectionId: 'old' } });
      const [open, setOpen] = React.useState(true);
      const [activeViewKey, selectView] = React.useState('markdown');
      useWorkbenchViewNavigation({
        editors,
        unsavedMessage: 'Unsaved changes',
        enabled: true,
        options,
        historyScope: 'history',
        projectId: 'project',
        scopeKey,
        ready: true,
        open,
        activeViewKey,
        views,
        queries,
        setQueries,
        selectView,
        setOpen,
        onError,
      });
      return { queries, open };
    },
    { initialProps: { scopeKey: 'scope-1' } },
  );
  return {
    ...hook,
    onError,
    onNavigationChange,
    complete(ready: boolean) {
      if (ready) editors.register('editor', { ...handle, dirty: false });
      finish(ready);
    },
  };
}

describe('hosted navigation with collaborative editors', () => {
  it('awaits save before replaying a document address and disables competing local history', async () => {
    const f = fixture();
    expect(f.result.current.queries.markdown.selectionId).toBe('old');
    expect(local).toHaveBeenLastCalledWith(
      expect.objectContaining({ enabled: false }),
    );
    await act(async () => f.complete(true));
    await waitFor(() =>
      expect(f.result.current.queries.markdown.selectionId).toBe('next'),
    );
    expect(f.onError).not.toHaveBeenCalled();
  });

  it.each(['replace', 'close'] as const)(
    'keeps the document and restores its host address when %s cannot save',
    async (action) => {
      const f = fixture(action === 'close' ? null : undefined);
      await act(async () => f.complete(false));
      await waitFor(() => expect(f.onError).toHaveBeenCalled());
      expect(f.result.current.queries.markdown.selectionId).toBe('old');
      expect(f.result.current.open).toBe(true);
      await waitFor(() =>
        expect(f.onNavigationChange).toHaveBeenCalledWith({
          projectId: 'project',
          view: { viewKey: 'markdown', selectionId: 'old' },
        }),
      );
    },
  );

  it('does not apply a completed save to a superseded authorized scope', async () => {
    const f = fixture();
    f.rerender({ scopeKey: 'scope-2' });
    await act(async () => f.complete(false));
    await waitFor(() => expect(f.onError).toHaveBeenCalledTimes(1));
    expect(f.result.current.queries.markdown.selectionId).toBe('old');
  });
});
