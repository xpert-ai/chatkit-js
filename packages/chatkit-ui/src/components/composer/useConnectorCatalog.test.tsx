import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Client } from '@xpert-ai/xpert-sdk';
import {
  useConnectorCatalog,
  invalidateConnectionCatalogs,
} from './useConnectorCatalog';

describe('connection catalog scope cache', () => {
  it('shares one request across menus, caches reopening, and refreshes after authorization changes', async () => {
    const client = new Client({ apiUrl: 'https://example.test/api/ai' });
    const fetch = vi
      .spyOn(client.connectors, 'runtimeOptions')
      .mockResolvedValue({
        scope: { type: 'workspace', workspaceId: 'workspace' },
        items: [],
      });
    const first = renderHook(() => useConnectorCatalog(client, 'assistant'));
    const second = renderHook(
      ({ enabled }) =>
        useConnectorCatalog(client, 'assistant', undefined, enabled),
      { initialProps: { enabled: true } },
    );
    await waitFor(() => expect(second.result.current.loading).toBe(false));
    expect(fetch).toHaveBeenCalledTimes(1);
    second.rerender({ enabled: false });
    second.rerender({ enabled: true });
    expect(fetch).toHaveBeenCalledTimes(1);
    act(() => invalidateConnectionCatalogs(client));
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(first.result.current.loading).toBe(false));
  });
  it('isolates project data and distinguishes an access error from an empty result', async () => {
    const client = new Client({ apiUrl: 'https://example.test/api/ai' });
    vi.spyOn(client.connectors, 'runtimeOptions')
      .mockResolvedValueOnce({
        scope: { type: 'project', projectId: 'one' },
        items: [],
      })
      .mockRejectedValue(Object.assign(new Error('scope'), { status: 403 }));
    const hook = renderHook(
      ({ project }) => useConnectorCatalog(client, 'assistant', project),
      { initialProps: { project: 'one' } },
    );
    await waitFor(() => expect(hook.result.current.loading).toBe(false));
    hook.rerender({ project: 'two' });
    expect(hook.result.current.data).toBeUndefined();
    await waitFor(() =>
      expect(hook.result.current.error).toMatchObject({ status: 403 }),
    );
    expect(hook.result.current.loading).toBe(false);
  });
});
