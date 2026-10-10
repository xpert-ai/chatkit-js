import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { XpertExtensionViewManifest } from '@xpert-ai/xpert-sdk';
import { useProjectCreationEntry } from './useProjectCreationEntry';

const entry = {
  kind: 'assistant',
  xpertId: 'assistant',
  slug: 'assistant',
  viewKey: 'app.create',
} as const;
const view = { key: 'app.create' } as XpertExtensionViewManifest;

describe('project creation view navigation', () => {
  it('waits for an empty, authorized scope, resets the query, and applies each click once', () => {
    const openView = vi.fn();
    const props = {
      request: { id: 1, entry },
      ready: false,
      projectId: 'old-project',
      conversationId: 'old-conversation',
      views: [view],
      openView,
      onUnavailable: vi.fn(),
    };
    const { rerender } = renderHook(useProjectCreationEntry, {
      initialProps: props,
    });
    rerender({ ...props, ready: true });
    expect(openView).not.toHaveBeenCalled();
    rerender({ ...props, ready: true, projectId: '', conversationId: '' });
    expect(openView).toHaveBeenCalledExactlyOnceWith('app.create', {
      selectionId: undefined,
    });
    rerender({
      ...props,
      ready: true,
      projectId: '',
      conversationId: '',
      views: [view],
    });
    expect(openView).toHaveBeenCalledOnce();
    rerender({
      ...props,
      request: { id: 2, entry },
      ready: true,
      projectId: '',
      conversationId: '',
    });
    expect(openView).toHaveBeenCalledTimes(2);
  });

  it('reports unavailable views without attempting host navigation', () => {
    const openView = vi.fn();
    const onUnavailable = vi.fn();
    renderHook(() =>
      useProjectCreationEntry({
        request: { id: 1, entry },
        ready: true,
        views: [],
        openView,
        onUnavailable,
      }),
    );
    expect(openView).not.toHaveBeenCalled();
    expect(onUnavailable).toHaveBeenCalledOnce();
  });
});
