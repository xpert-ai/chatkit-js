import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import type { ContentClient, ContentScope, XpertExtensionViewManifest } from '@xpert-ai/xpert-sdk';
import { useContentTabs } from './useContentTabs';
import { readContentTabs, writeContentTabs } from './tab-storage';
import { contentTabKey } from './tab-identity';

const id = '11111111-1111-4111-8111-111111111111';
const query = { selectionId: 'old-native', parameters: { contentId: id, contentTitle: 'Do not cache this' } };
const key = contentTabKey('deck', query);
const scope: ContentScope = { assistantId: 'assistant', projectId: 'project' };
const views = [{ key: 'deck' }] as XpertExtensionViewManifest[];
beforeEach(() => sessionStorage.clear());

it('persists only stable IDs and reauthorizes after readiness before restoring provider-native IDs', async () => {
  writeContentTabs('a', [key], { [key]: query });
  expect(readContentTabs('a')).toEqual([{ contentId: id }]);
  const resolve = vi.fn().mockResolvedValue({ viewKey: 'deck', selectionId: 'new-native', parameters: { contentId: id } });
  const restore = vi.fn();
  const { rerender } = renderHook(({ ready }) => useContentTabs({ scope: 'a', enabled: true, ready,
    api: { resolve } as unknown as ContentClient, contentScope: scope, views, keys: [], queries: {}, restore }), { initialProps: { ready: false } });
  expect(resolve).not.toHaveBeenCalled();
  rerender({ ready: true });
  await waitFor(() => expect(restore).toHaveBeenCalledWith({ [key]: { selectionId: 'new-native', parameters: { contentId: id } } }));
  expect(resolve).toHaveBeenCalledWith(scope, { providerKey: 'platform.content.catalog', resourceId: id });
});

it('omits denied resources without falling back to stored titles or native IDs', async () => {
  writeContentTabs('a', [key], { [key]: query });
  const restore = vi.fn(), resolve = vi.fn().mockRejectedValue(new Error('revoked'));
  renderHook(() => useContentTabs({ scope: 'a', enabled: true, ready: true, api: { resolve } as unknown as ContentClient,
    contentScope: scope, views, keys: [], queries: {}, restore }));
  await waitFor(() => expect(restore).toHaveBeenCalledWith({}));
});

it('discards an old Project resolution after scope changes', async () => {
  writeContentTabs('a', [key], { [key]: query });
  let finish!: (value: unknown) => void;
  const resolve = vi.fn().mockImplementation(() => new Promise(r => { finish = r; })), restore = vi.fn();
  const { rerender } = renderHook(({ name }) => useContentTabs({ scope: name, enabled: true, ready: true,
    api: { resolve } as unknown as ContentClient, contentScope: { ...scope, projectId: name }, views, keys: [], queries: {}, restore }), { initialProps: { name: 'a' } });
  await waitFor(() => expect(resolve).toHaveBeenCalledTimes(1));
  rerender({ name: 'b' });
  await waitFor(() => expect(restore).toHaveBeenCalledWith({}));
  await act(async () => finish({ viewKey: 'deck', selectionId: 'old-project-native', parameters: { contentId: id } }));
  expect(restore).toHaveBeenCalledTimes(1);
});
