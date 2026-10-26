import { describe, expect, it, vi } from 'vitest';
import { ContentClient } from '@xpert-ai/xpert-sdk';
import { resolveContentEntry } from './entry-navigation';

describe('stable catalog links', () => {
  it('reauthorizes and resolves a link after its editor and provider selection changed', async () => {
    const api = new ContentClient({ json: vi.fn() });
    vi.spyOn(api, 'resolve').mockResolvedValue({ viewKey: 'replacement.editor', selectionId: 'native-id', parameters: { contentProvider: 'replacement' } });
    const scope = { assistantId: 'other-assistant', projectId: 'project' };
    const result = await resolveContentEntry({ target: 'workbench.view', viewKey: 'old.editor', query: {
      selectionId: 'stable-id', parameters: { contentProvider: 'platform.content.catalog', contentEditor: 'replacement.editor', blockId: 'slide-1' },
    } }, api, scope);
    expect(api.resolve).toHaveBeenCalledWith(scope, { resourceId: 'stable-id', providerKey: 'platform.content.catalog', editorKey: 'replacement.editor' });
    expect(result.viewKey).toBe('replacement.editor');
    expect(result.query).toEqual({ selectionId: 'native-id', parameters: { contentProvider: 'replacement', blockId: 'slide-1' } });
  });
  it('never falls back to a stale view on revoked access', async () => {
    const api = new ContentClient({ json: vi.fn() });
    vi.spyOn(api, 'resolve').mockRejectedValue(new Error('Forbidden'));
    await expect(resolveContentEntry({ target: 'workbench.view', viewKey: 'old', query: { selectionId: 'stable-id', parameters: { contentProvider: 'platform.content.catalog' } } }, api, { assistantId: 'a', projectId: 'p' })).rejects.toThrow('Forbidden');
  });
});
